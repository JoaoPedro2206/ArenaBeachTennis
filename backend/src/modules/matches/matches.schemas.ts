import { z } from 'zod';
import { PIN_LENGTH } from './match-policy';

export const createMatchSchema = z.object({
  bookingId: z.string().uuid('ID de reserva inválido'),
});

export const joinMatchSchema = z.object({
  /** Aceita "123 456" ou "123-456": só os dígitos importam */
  pin: z
    .string({ message: 'Informe o código da partida' })
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().length(PIN_LENGTH, `O código tem ${PIN_LENGTH} dígitos`)),
});

export const matchIdBodySchema = z.object({
  matchId: z.string().uuid('ID de partida inválido'),
});

const team = z
  .array(z.string().uuid('Jogador inválido'), { message: 'Informe os jogadores do time' })
  .min(1, 'Cada time precisa de ao menos 1 jogador')
  .max(2, 'Cada time tem no máximo 2 jogadores');

/** Formação dos times: 1x1 ou 2x2, sem ninguém nos dois lados */
export const teamsSchema = z
  .object({ team1: team, team2: team })
  .refine((t) => t.team1.length === t.team2.length, { message: 'Os dois times precisam ter o mesmo número de jogadores' })
  .refine((t) => new Set([...t.team1, ...t.team2]).size === t.team1.length + t.team2.length, {
    message: 'Um jogador não pode estar nos dois times',
  });

/** Formato por times: { team1, team2, winnerTeam } (usado pelo app) */
const byTeamsSchema = z.object({
  team1: team,
  team2: team,
  winnerTeam: z.union([z.literal(1), z.literal(2)], { message: 'Informe o time vencedor (1 ou 2)' }),
});

/** Formato direto: { winners: [ids], losers: [ids] } — vira Dupla 1 = vencedores */
const byOutcomeSchema = z
  .object({ winners: team, losers: team })
  .transform(({ winners, losers }) => ({ team1: winners, team2: losers, winnerTeam: 1 as const }));

/** POST /matches/:id/result — aceita os dois formatos acima */
export const matchResultSchema = z
  .union([byTeamsSchema, byOutcomeSchema], {
    message: 'Envie { team1, team2, winnerTeam } ou { winners, losers }',
  })
  .refine((t) => t.team1.length === t.team2.length, { message: 'Os dois times precisam ter o mesmo número de jogadores' })
  .refine((t) => new Set([...t.team1, ...t.team2]).size === t.team1.length + t.team2.length, {
    message: 'Um jogador não pode estar nos dois times',
  });

export type MatchResultInput = z.infer<typeof matchResultSchema>;
export type TeamsInput = z.infer<typeof teamsSchema>;

export const matchIdParamsSchema = z.object({
  id: z.string().uuid('ID de partida inválido'),
});
