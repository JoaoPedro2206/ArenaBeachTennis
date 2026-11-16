import { z } from 'zod';
import { LessonLevel } from '@prisma/client';

export const lessonIdParamsSchema = z.object({
  id: z.string().uuid('ID de aula inválido'),
});

export const listTeachersQuerySchema = z.object({
  arenaId: z.string().uuid().optional(),
});

export const listLessonsQuerySchema = z.object({
  teacherId: z.string().uuid().optional(),
  level: z.nativeEnum(LessonLevel).optional(),
  /** Quantos dias à frente listar (padrão: 14) */
  days: z.coerce.number().int().min(1).max(60).default(14),
});

export const createLessonSchema = z
  .object({
    /** Obrigatório para admin; o professor logado usa o próprio perfil */
    teacherId: z.string().uuid().optional(),
    courtId: z.string().uuid('ID de quadra inválido'),
    title: z.string().trim().min(3).max(120),
    level: z.nativeEnum(LessonLevel),
    /** Primeira ocorrência, ISO 8601 com fuso */
    startTime: z
      .string()
      .datetime({ offset: true, message: 'Use data/hora ISO 8601 com fuso' })
      .transform((value) => new Date(value)),
    durationMin: z.number().int().positive(),
    capacity: z.number().int().min(1).max(12),
    pricePerStudent: z.number().int().min(0),
    /** 1 = aula avulsa; 2..12 = repete semanalmente no mesmo dia/horário */
    repeatWeeks: z.number().int().min(1).max(12).default(1),
  })
  .strict();

export type ListLessonsQuery = z.infer<typeof listLessonsQuerySchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
