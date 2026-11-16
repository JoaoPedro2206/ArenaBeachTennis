import { randomUUID } from 'node:crypto';
import type { UserRole } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { CourtsRepository } from '../courts/courts.repository';
import { BookingsRepository, isOverlapViolation } from '../bookings/bookings.repository';
import { checkSlotRequest } from '../bookings/slot-rules';
import { utcToZoned } from '../../shared/utils/timezone';
import { LessonsRepository, type LessonRecord } from './lessons.repository';
import type { CreateLessonInput, ListLessonsQuery } from './lessons.schemas';

/** Aulas podem ser planejadas mais à frente que reservas comuns */
const LESSON_MAX_DAYS_AHEAD = 120;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface LessonView {
  id: string;
  seriesId: string | null;
  title: string;
  level: LessonRecord['level'];
  startTime: Date;
  endTime: Date;
  capacity: number;
  enrolledCount: number;
  spotsLeft: number;
  pricePerStudent: number;
  isEnrolled: boolean;
  teacher: { id: string; name: string; profilePhoto: string | null };
  court: { id: string; name: string };
  arena: { id: string; name: string; timezone: string };
}

function toView(lesson: LessonRecord): LessonView {
  const enrolledCount = lesson._count.enrollments;
  return {
    id: lesson.id,
    seriesId: lesson.seriesId,
    title: lesson.title,
    level: lesson.level,
    startTime: lesson.booking.startTime,
    endTime: lesson.booking.endTime,
    capacity: lesson.capacity,
    enrolledCount,
    spotsLeft: Math.max(lesson.capacity - enrolledCount, 0),
    pricePerStudent: lesson.pricePerStudent,
    isEnrolled: lesson.enrollments.length > 0,
    teacher: { id: lesson.teacher.id, name: lesson.teacher.user.name, profilePhoto: lesson.teacher.user.profilePhoto },
    court: { id: lesson.booking.court.id, name: lesson.booking.court.name },
    arena: lesson.booking.court.arena,
  };
}

interface Actor {
  id: string;
  role: UserRole;
}

export class LessonsService {
  constructor(
    private readonly lessonsRepository = new LessonsRepository(),
    private readonly courtsRepository = new CourtsRepository(),
    private readonly bookingsRepository = new BookingsRepository(),
  ) {}

  async listTeachers(arenaId?: string, now = new Date()) {
    const teachers = await this.lessonsRepository.listTeachers(now, arenaId);
    return teachers.map(({ _count, user, ...teacher }) => ({
      ...teacher,
      name: user.name,
      profilePhoto: user.profilePhoto,
      upcomingLessons: _count.lessons,
    }));
  }

  async listLessons(query: ListLessonsQuery, userId?: string, now = new Date()): Promise<LessonView[]> {
    const to = new Date(now.getTime() + query.days * 24 * 60 * 60 * 1000);
    const lessons = await this.lessonsRepository.listUpcoming({
      from: now,
      to,
      teacherId: query.teacherId,
      level: query.level,
      userId,
    });
    return lessons.map(toView);
  }

  /**
   * Cria uma aula avulsa (repeatWeeks = 1) ou recorrente (semanal).
   * Cada ocorrência vira uma Booking do tipo CLASS — a mesma constraint do
   * banco que impede reservas sobrepostas impede aula x reserva e aula x aula.
   * Tudo ou nada: se UMA semana conflitar, nenhuma é criada.
   */
  async createLesson(actor: Actor, input: CreateLessonInput, now = new Date()): Promise<LessonView[]> {
    const teacher = await this.resolveTeacher(actor, input.teacherId);

    const court = await this.courtsRepository.findByIdWithArena(input.courtId);
    if (!court || !court.arena.isActive) throw new NotFoundError('Quadra não encontrada');
    if (court.arena.id !== teacher.arenaId) throw new ValidationError('A quadra não pertence à arena do professor');
    if (court.status !== 'ACTIVE') throw new ConflictError('Quadra indisponível (manutenção ou inativa)');
    if (actor.role === 'ARENA_ADMIN' && court.arena.ownerId !== actor.id) {
      throw new ForbiddenError('Você só pode criar aulas nas quadras da sua arena');
    }

    // Monta e valida cada ocorrência semanal
    const occurrences = Array.from({ length: input.repeatWeeks }, (_, week) => {
      const start = new Date(input.startTime.getTime() + week * WEEK_MS);
      const check = checkSlotRequest(court, court.arena.timezone, start, input.durationMin, now, LESSON_MAX_DAYS_AHEAD);
      if (!check.ok) throw new ValidationError(`Semana ${week + 1}: ${check.message}`);
      return { start, end: check.end };
    });

    await this.bookingsRepository.expireOverdue(now, court.id);

    // Checagem amigável: lista exatamente quais datas conflitam
    const conflicts: string[] = [];
    for (const { start, end } of occurrences) {
      const blocking = await this.bookingsRepository.findBlockingInRange(court.id, start, end);
      if (blocking.length > 0) {
        const local = utcToZoned(start, court.arena.timezone);
        conflicts.push(local.date);
      }
    }
    if (conflicts.length > 0) {
      throw new ConflictError(`Quadra ocupada nas datas: ${conflicts.join(', ')}`);
    }

    const seriesId = input.repeatWeeks > 1 ? randomUUID() : null;
    try {
      const ids = await this.lessonsRepository.transaction(async (tx) => {
        const created: string[] = [];
        for (const { start, end } of occurrences) {
          const booking = await tx.booking.create({
            data: {
              courtId: court.id,
              userId: teacher.userId,
              startTime: start,
              endTime: end,
              type: 'CLASS',
              status: 'CONFIRMED',
              totalPrice: 0,
              paymentStatus: 'PAID',
              notes: input.title,
            },
            select: { id: true },
          });
          const lesson = await tx.lesson.create({
            data: {
              teacherId: teacher.id,
              bookingId: booking.id,
              seriesId,
              title: input.title,
              level: input.level,
              capacity: input.capacity,
              pricePerStudent: input.pricePerStudent,
            },
            select: { id: true },
          });
          created.push(lesson.id);
        }
        return created;
      });

      const lessons = await Promise.all(ids.map((id) => this.lessonsRepository.findById(id)));
      return lessons.filter((l): l is LessonRecord => l !== null).map(toView);
    } catch (error) {
      if (isOverlapViolation(error)) throw new ConflictError('Outro agendamento ocupou a quadra agora há pouco. Tente novamente.');
      throw error;
    }
  }

  /**
   * Inscreve o aluno respeitando o limite de vagas mesmo com cliques
   * simultâneos: a linha da aula é travada (SELECT ... FOR UPDATE) enquanto
   * contamos as vagas e gravamos a inscrição.
   */
  async enroll(userId: string, lessonId: string, now = new Date()): Promise<LessonView> {
    const lesson = await this.lessonsRepository.findById(lessonId, userId);
    if (!lesson) throw new NotFoundError('Aula não encontrada');
    if (lesson.booking.startTime <= now) throw new ConflictError('Esta aula já começou');
    if (lesson.teacher.user.id === userId) throw new ConflictError('Você é o professor desta aula');
    if (lesson.enrollments.length > 0) throw new ConflictError('Você já está inscrito nesta aula');

    await this.lessonsRepository.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM lessons WHERE id = ${lessonId}::uuid FOR UPDATE`;
      const enrolled = await tx.lessonEnrollment.count({ where: { lessonId, status: 'ENROLLED' } });
      if (enrolled >= lesson.capacity) throw new ConflictError('Turma lotada');

      await tx.lessonEnrollment.upsert({
        where: { lessonId_userId: { lessonId, userId } },
        create: { lessonId, userId },
        update: { status: 'ENROLLED' }, // reinscrição após ter cancelado
      });
    });

    return toView((await this.lessonsRepository.findById(lessonId, userId))!);
  }

  async unenroll(userId: string, lessonId: string, now = new Date()): Promise<LessonView> {
    const lesson = await this.lessonsRepository.findById(lessonId, userId);
    if (!lesson) throw new NotFoundError('Aula não encontrada');
    if (lesson.enrollments.length === 0) throw new ConflictError('Você não está inscrito nesta aula');
    if (lesson.booking.startTime <= now) throw new ConflictError('Esta aula já começou');

    await this.lessonsRepository.transaction((tx) =>
      tx.lessonEnrollment.update({
        where: { lessonId_userId: { lessonId, userId } },
        data: { status: 'CANCELLED' },
      }),
    );

    return toView((await this.lessonsRepository.findById(lessonId, userId))!);
  }

  /** Professor cria para si; admin escolhe o professor */
  private async resolveTeacher(actor: Actor, teacherId?: string) {
    const teacher =
      actor.role === 'TEACHER'
        ? await this.lessonsRepository.findTeacherByUserId(actor.id)
        : teacherId
          ? await this.lessonsRepository.findTeacherById(teacherId)
          : null;

    if (!teacher) {
      throw actor.role === 'TEACHER'
        ? new ForbiddenError('Seu usuário não tem perfil de professor')
        : new ValidationError('Informe o professor (teacherId)');
    }
    if (!teacher.isActive) throw new ConflictError('Professor inativo');
    return teacher;
  }
}
