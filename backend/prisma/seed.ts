/**
 * Dados de desenvolvimento. Idempotente (upsert): pode rodar várias vezes.
 *   npx prisma db seed
 *
 * Credenciais APENAS para ambiente local:
 *   admin@arenabeach.test / Admin1234
 */
import { PrismaClient, type LessonLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { LessonsService } from '../src/modules/lessons/lessons.service';
import { utcToZoned, zonedDateTimeToUtc } from '../src/shared/utils/timezone';

const prisma = new PrismaClient();

// IDs fixos para facilitar testes manuais (Postman/Insomnia)
const IDS = {
  admin: '00000000-0000-4000-8000-000000000001',
  arena: '00000000-0000-4000-8000-000000000010',
  court1: '00000000-0000-4000-8000-000000000101',
  court2: '00000000-0000-4000-8000-000000000102',
  court3: '00000000-0000-4000-8000-000000000103',
};

async function main(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@arenabeach.test' },
    update: {},
    create: {
      id: IDS.admin,
      name: 'Admin Arena Sol',
      email: 'admin@arenabeach.test',
      passwordHash: await bcrypt.hash('Admin1234', 10),
      role: 'ARENA_ADMIN',
      eloScore: 1600, // Categoria B
    },
  });

  await prisma.arena.upsert({
    where: { id: IDS.arena },
    update: {},
    create: {
      id: IDS.arena,
      name: 'Arena Sol',
      slug: 'arena-sol',
      address: 'Av. Beira Mar, 1000',
      city: 'Florianópolis',
      state: 'SC',
      latitude: -27.5954,
      longitude: -48.548,
      timezone: 'America/Sao_Paulo',
      ownerId: admin.id,
    },
  });

  const courts = [
    { id: IDS.court1, name: 'Quadra 1', pricePerHour: 12000, slotDurationMin: 60, openTime: '06:00', closeTime: '23:00' },
    { id: IDS.court2, name: 'Quadra 2 (Coberta)', pricePerHour: 15000, slotDurationMin: 90, openTime: '07:00', closeTime: '00:00', isCovered: true },
    { id: IDS.court3, name: 'Quadra 3', pricePerHour: 10000, slotDurationMin: 60, openTime: '06:00', closeTime: '22:00', status: 'MAINTENANCE' as const },
  ];

  for (const court of courts) {
    await prisma.court.upsert({
      where: { id: court.id },
      update: {},
      create: { ...court, arenaId: IDS.arena },
    });
  }

  await seedTeachersAndLessons(admin.id);

  console.log('🌱 Seed concluído: 1 admin, 1 arena, 3 quadras, 2 professores com aulas');
}

// -----------------------------------------------------------------------------
// Professores e aulas (criadas pelo LessonsService: mesmas validações da API)
// Senha dos professores (APENAS local): Professor1234
// -----------------------------------------------------------------------------

const TIMEZONE = 'America/Sao_Paulo';

/** Próxima data (a partir de amanhã) com o dia da semana pedido (0 = domingo) */
function nextWeekday(weekday: number): string {
  const today = utcToZoned(new Date(), TIMEZONE).date;
  const d = new Date(`${today}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== weekday);
  return d.toISOString().slice(0, 10);
}

const at = (weekday: number, hh: number, mm = 0) => zonedDateTimeToUtc(nextWeekday(weekday), hh * 60 + mm, TIMEZONE);

async function seedTeachersAndLessons(adminId: string): Promise<void> {
  const passwordHash = await bcrypt.hash('Professor1234', 10);

  const teachers = [
    {
      email: 'carla.prof@arenabeach.test',
      name: 'Carla Mendes',
      bio: 'Ex-atleta do circuito nacional. Especialista em quem está começando: fundamentos, posicionamento e confiança na areia.',
      levels: ['BEGINNER', 'INTERMEDIATE'] as LessonLevel[],
      lessons: [
        { title: 'Fundamentos do Beach Tennis', level: 'BEGINNER', courtId: IDS.court1, start: at(2, 7), durationMin: 60, capacity: 4, pricePerStudent: 6000, repeatWeeks: 4 },
        { title: 'Saque e Voleio', level: 'INTERMEDIATE', courtId: IDS.court1, start: at(4, 7), durationMin: 60, capacity: 4, pricePerStudent: 7000, repeatWeeks: 4 },
      ],
    },
    {
      email: 'rafael.prof@arenabeach.test',
      name: 'Rafael Costa',
      bio: 'Técnico certificado pela federação. Treinos de alta intensidade com foco em tática de duplas e jogo de rede.',
      levels: ['INTERMEDIATE', 'ADVANCED'] as LessonLevel[],
      lessons: [
        { title: 'Tática e Jogo Avançado', level: 'ADVANCED', courtId: IDS.court2, start: at(6, 8, 30), durationMin: 90, capacity: 4, pricePerStudent: 9000, repeatWeeks: 4 },
        { title: 'Aulão Intermediário', level: 'INTERMEDIATE', courtId: IDS.court2, start: at(3, 19), durationMin: 90, capacity: 6, pricePerStudent: 5000, repeatWeeks: 1 },
      ],
    },
  ];

  const lessonsService = new LessonsService();

  for (const t of teachers) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { name: t.name, email: t.email, passwordHash, role: 'TEACHER', eloScore: 1800 }, // Categoria A
    });
    const teacher = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, arenaId: IDS.arena, bio: t.bio, levels: t.levels },
    });

    // Idempotente: só cria aulas se o professor ainda não tiver nenhuma
    if ((await prisma.lesson.count({ where: { teacherId: teacher.id } })) > 0) continue;

    for (const lesson of t.lessons) {
      await lessonsService.createLesson(
        { id: adminId, role: 'ARENA_ADMIN' },
        {
          teacherId: teacher.id,
          courtId: lesson.courtId,
          title: lesson.title,
          level: lesson.level as LessonLevel,
          startTime: lesson.start,
          durationMin: lesson.durationMin,
          capacity: lesson.capacity,
          pricePerStudent: lesson.pricePerStudent,
          repeatWeeks: lesson.repeatWeeks,
        },
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
