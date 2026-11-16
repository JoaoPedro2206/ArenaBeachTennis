import type { LessonLevel, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

const teacherSelect = {
  id: true,
  bio: true,
  levels: true,
  user: { select: { id: true, name: true, profilePhoto: true } },
  arena: { select: { id: true, name: true } },
} satisfies Prisma.TeacherSelect;

const lessonSelect = (userId?: string) =>
  ({
    id: true,
    seriesId: true,
    title: true,
    level: true,
    capacity: true,
    pricePerStudent: true,
    booking: {
      select: {
        startTime: true,
        endTime: true,
        court: { select: { id: true, name: true, arena: { select: { id: true, name: true, timezone: true } } } },
      },
    },
    teacher: { select: { id: true, user: { select: { id: true, name: true, profilePhoto: true } } } },
    _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
    // Só a inscrição do usuário logado (para marcar "inscrito"); visitante: nenhuma
    enrollments: { where: { userId, status: 'ENROLLED' as const }, select: { id: true }, take: userId ? 1 : 0 },
  }) satisfies Prisma.LessonSelect;

export type LessonRecord = Prisma.LessonGetPayload<{ select: ReturnType<typeof lessonSelect> }>;

/** Aula "ativa" = o bloqueio de quadra dela não foi cancelado */
const activeLesson = { booking: { status: { not: 'CANCELLED' as const } } } satisfies Prisma.LessonWhereInput;

export class LessonsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  listTeachers(now: Date, arenaId?: string) {
    return this.db.teacher.findMany({
      where: { isActive: true, ...(arenaId && { arenaId }) },
      select: {
        ...teacherSelect,
        _count: { select: { lessons: { where: { ...activeLesson, booking: { ...activeLesson.booking, startTime: { gt: now } } } } } },
      },
      orderBy: { user: { name: 'asc' } },
    });
  }

  findTeacherById(id: string) {
    return this.db.teacher.findUnique({ where: { id }, select: { id: true, userId: true, arenaId: true, isActive: true } });
  }

  findTeacherByUserId(userId: string) {
    return this.db.teacher.findUnique({ where: { userId }, select: { id: true, userId: true, arenaId: true, isActive: true } });
  }

  listUpcoming(filters: { from: Date; to: Date; teacherId?: string; level?: LessonLevel; userId?: string }) {
    return this.db.lesson.findMany({
      where: {
        ...(filters.teacherId && { teacherId: filters.teacherId }),
        ...(filters.level && { level: filters.level }),
        teacher: { isActive: true },
        booking: { status: { not: 'CANCELLED' }, startTime: { gte: filters.from, lt: filters.to } },
      },
      select: lessonSelect(filters.userId),
      orderBy: { booking: { startTime: 'asc' } },
      take: 200,
    });
  }

  findById(id: string, userId?: string) {
    return this.db.lesson.findFirst({ where: { id, ...activeLesson }, select: lessonSelect(userId) });
  }

  /** Executa `work` numa transação (criação de séries e inscrições) */
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(work);
  }
}
