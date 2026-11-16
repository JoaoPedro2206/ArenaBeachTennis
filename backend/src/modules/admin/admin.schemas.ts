import { z } from 'zod';
import { parseHHmm } from '../bookings/slot-rules';

/** "YYYY-MM-DD" que seja uma data real */
const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD')
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
  }, 'Data inválida');

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:mm');

/** Centavos por hora: até R$ 10.000/h (trava contra digitar um zero a mais) */
const pricePerHour = z
  .number({ message: 'Informe o preço' })
  .int('Preço em centavos')
  .min(0, 'O preço não pode ser negativo')
  .max(1_000_000, 'Preço acima do limite de R$ 10.000/h');

const isoDateTime = (field: string) =>
  z
    .string({ message: `Informe ${field}` })
    .datetime({ offset: true, message: `${field}: use data/hora ISO 8601 com fuso` })
    .transform((value) => new Date(value));

export const arenaQuerySchema = z.object({
  arenaId: z.string().uuid('ID de arena inválido').optional(),
});

export const agendaQuerySchema = arenaQuerySchema.extend({
  /** Dia no fuso da arena; padrão = hoje */
  date: localDate.optional(),
});

export const reportsQuerySchema = arenaQuerySchema.extend({
  /** Mês no fuso da arena; padrão = mês atual */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use o formato YYYY-MM')
    .optional(),
});

/** Bloqueios longos (reforma) são aceitos, mas com teto para evitar erro de digitação */
export const MAX_BLOCK_DAYS = 31;

export const blockSchema = z
  .object({
    courtId: z.string().uuid('ID de quadra inválido'),
    startTime: isoDateTime('o início'),
    endTime: isoDateTime('o fim'),
    reason: z.string().trim().max(200, 'Motivo muito longo').optional(),
  })
  .strict()
  .refine((b) => b.endTime > b.startTime, { message: 'O fim precisa ser depois do início', path: ['endTime'] })
  .refine((b) => b.endTime.getTime() - b.startTime.getTime() <= MAX_BLOCK_DAYS * 24 * 60 * 60_000, {
    message: `Bloqueios podem durar no máximo ${MAX_BLOCK_DAYS} dias. Para mais tempo, coloque a quadra inteira em manutenção.`,
    path: ['endTime'],
  });

export const idParamsSchema = z.object({ id: z.string().uuid('ID inválido') });

export const courtStatusSchema = z
  .object({ status: z.enum(['ACTIVE', 'MAINTENANCE'], { message: 'Status deve ser ACTIVE ou MAINTENANCE' }) })
  .strict();

const pricingRuleSchema = z
  .object({
    name: z.string().trim().min(1, 'Dê um nome à regra').max(60, 'Nome muito longo'),
    /** null = todas as quadras */
    courtId: z.string().uuid('ID de quadra inválido').nullable(),
    daysOfWeek: z
      .array(z.number().int().min(0).max(6), { message: 'Escolha os dias da semana' })
      .min(1, 'Escolha ao menos um dia')
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    startTime: hhmm,
    /** "00:00" = meia-noite (fim do dia) */
    endTime: hhmm,
    pricePerHour,
  })
  .strict()
  .refine(
    (rule) => {
      const end = parseHHmm(rule.endTime) || 24 * 60;
      return parseHHmm(rule.startTime) < end;
    },
    { message: 'O horário final precisa ser depois do inicial', path: ['endTime'] },
  );

/** PUT /admin/pricing — substitui a configuração inteira (preço base + regras) */
export const pricingSchema = z
  .object({
    courts: z.array(z.object({ courtId: z.string().uuid(), pricePerHour }).strict()).max(50),
    rules: z.array(pricingRuleSchema).max(50, 'Máximo de 50 regras de preço'),
  })
  .strict();

export type BlockInput = z.infer<typeof blockSchema>;
export type PricingInput = z.infer<typeof pricingSchema>;
