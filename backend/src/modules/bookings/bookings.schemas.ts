import { z } from 'zod';

/** "YYYY-MM-DD" que seja uma data real (rejeita 2026-02-30) */
const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD')
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
  }, 'Data inválida');

export const courtIdParamsSchema = z.object({
  courtId: z.string().uuid('ID de quadra inválido'),
});

export const bookingIdParamsSchema = z.object({
  id: z.string().uuid('ID de reserva inválido'),
});

export const availabilityQuerySchema = z.object({
  date: localDate,
});

export const createBookingSchema = z
  .object({
    courtId: z.string().uuid('ID de quadra inválido'),
    /** ISO 8601 com fuso, ex.: "2026-11-12T18:00:00-03:00" */
    startTime: z
      .string()
      .datetime({ offset: true, message: 'Use data/hora ISO 8601 com fuso (ex.: 2026-11-12T18:00:00-03:00)' })
      .transform((value) => new Date(value)),
    /** Opcional: se omitido, usa a duração padrão do slot da quadra */
    durationMin: z.number().int().positive().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const listMyBookingsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
