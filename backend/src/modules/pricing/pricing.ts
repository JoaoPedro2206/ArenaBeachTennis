/**
 * Precificação dinâmica — funções puras (sem banco), usadas pela grade
 * pública, pela criação de reservas e pela agenda do admin. Mesma regra em
 * todo lugar: o preço que o jogador vê é o preço que ele paga.
 *
 * Precedência (ver PricingRule no schema.prisma):
 *   1. regra da quadra específica > regra da arena inteira
 *   2. empate de nível -> maior preço
 *   3. nenhuma regra -> preço base da quadra
 */
import { utcToZoned } from '../../shared/utils/timezone';
import { calculatePrice, parseHHmm } from '../bookings/slot-rules';

export interface PricingRuleInput {
  id?: string;
  name: string;
  courtId: string | null;
  daysOfWeek: number[];
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm" — "00:00" = meia-noite
  pricePerHour: number;
}

export interface PricedCourt {
  id: string;
  pricePerHour: number;
  slotDurationMin: number;
}

export interface HourlyPrice {
  pricePerHour: number;
  /** Nome da regra aplicada (null = preço base) */
  ruleName: string | null;
}

/** Janela da regra em minutos locais; fim "00:00" vira 1440 */
export function ruleWindow(rule: Pick<PricingRuleInput, 'startTime' | 'endTime'>): { start: number; end: number } {
  const start = parseHHmm(rule.startTime);
  const rawEnd = parseHHmm(rule.endTime);
  return { start, end: rawEnd === 0 ? 24 * 60 : rawEnd };
}

/** Dia da semana (0 = domingo) de uma data local "YYYY-MM-DD" */
export function weekdayOf(localDate: string): number {
  return new Date(`${localDate}T12:00:00Z`).getUTCDay();
}

/** Preço/hora vigente para uma quadra num dia da semana e minuto local */
export function resolveHourlyPrice(
  court: PricedCourt,
  rules: readonly PricingRuleInput[],
  weekday: number,
  minutesOfDay: number,
): HourlyPrice {
  const matching = rules.filter((rule) => {
    if (rule.courtId !== null && rule.courtId !== court.id) return false;
    if (!rule.daysOfWeek.includes(weekday)) return false;
    const { start, end } = ruleWindow(rule);
    return minutesOfDay >= start && minutesOfDay < end;
  });
  if (matching.length === 0) return { pricePerHour: court.pricePerHour, ruleName: null };

  const specific = matching.filter((rule) => rule.courtId === court.id);
  const pool = specific.length > 0 ? specific : matching;
  const best = pool.reduce((a, b) => (b.pricePerHour > a.pricePerHour ? b : a));
  return { pricePerHour: best.pricePerHour, ruleName: best.name };
}

/**
 * Preço total (centavos) de uma reserva que começa em `start` e dura
 * `durationMin`. Cada slot da grade é cobrado pela regra do seu início — uma
 * reserva das 17h às 19h com nobre a partir das 18h paga 1h base + 1h nobre.
 */
export function priceForRange(
  court: PricedCourt,
  rules: readonly PricingRuleInput[],
  timeZone: string,
  start: Date,
  durationMin: number,
): number {
  const step = court.slotDurationMin;
  let total = 0;
  for (let offset = 0; offset < durationMin; offset += step) {
    const segmentStart = new Date(start.getTime() + offset * 60_000);
    const { date, minutesOfDay } = utcToZoned(segmentStart, timeZone);
    const { pricePerHour } = resolveHourlyPrice(court, rules, weekdayOf(date), minutesOfDay);
    total += calculatePrice(pricePerHour, Math.min(step, durationMin - offset));
  }
  return total;
}
