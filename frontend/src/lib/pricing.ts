import type { PricingRule } from '@/types/admin';

/**
 * Espelho da regra de preço do backend (modules/pricing/pricing.ts), usado só
 * para a PRÉVIA do mapa de preços enquanto o admin edita — quem cobra de
 * verdade é a API, com a mesma precedência:
 *   1. regra da quadra > regra da arena inteira;  2. empate -> maior preço
 */
export const WEEKDAYS = [
  { value: 1, short: 'Seg', long: 'segunda' },
  { value: 2, short: 'Ter', long: 'terça' },
  { value: 3, short: 'Qua', long: 'quarta' },
  { value: 4, short: 'Qui', long: 'quinta' },
  { value: 5, short: 'Sex', long: 'sexta' },
  { value: 6, short: 'Sáb', long: 'sábado' },
  { value: 0, short: 'Dom', long: 'domingo' },
] as const;

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Fim "00:00" = meia-noite (1440) */
export const endMinutes = (hhmm: string): number => toMinutes(hhmm) || 24 * 60;

export function resolvePrice(
  court: { id: string; pricePerHour: number },
  rules: PricingRule[],
  weekday: number,
  minutesOfDay: number,
): { pricePerHour: number; rule: PricingRule | null } {
  const matching = rules.filter(
    (r) =>
      (r.courtId === null || r.courtId === court.id) &&
      r.daysOfWeek.includes(weekday) &&
      minutesOfDay >= toMinutes(r.startTime) &&
      minutesOfDay < endMinutes(r.endTime),
  );
  if (matching.length === 0) return { pricePerHour: court.pricePerHour, rule: null };
  const specific = matching.filter((r) => r.courtId === court.id);
  const pool = specific.length > 0 ? specific : matching;
  const best = pool.reduce((a, b) => (b.pricePerHour > a.pricePerHour ? b : a));
  return { pricePerHour: best.pricePerHour, rule: best };
}

/** "Seg a Sex", "Sáb e Dom", "Seg, Qua e Sex", "Todos os dias" */
export function describeDays(days: number[]): string {
  if (days.length === 7) return 'Todos os dias';
  const ordered = WEEKDAYS.filter((d) => days.includes(d.value));
  const positions = ordered.map((d) => WEEKDAYS.findIndex((w) => w.value === d.value));
  const contiguous = positions.every((p, i) => i === 0 || p === positions[i - 1] + 1);
  if (contiguous && ordered.length >= 3) return `${ordered[0].short} a ${ordered[ordered.length - 1].short}`;
  const names = ordered.map((d) => d.short);
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}

/** Problemas de uma regra antes de enviar (o backend valida de novo) */
export function ruleProblem(rule: PricingRule): string | null {
  if (!rule.name.trim()) return 'Dê um nome à regra';
  if (rule.daysOfWeek.length === 0) return 'Escolha ao menos um dia';
  if (!/^\d{2}:\d{2}$/.test(rule.startTime) || !/^\d{2}:\d{2}$/.test(rule.endTime)) return 'Informe os horários';
  if (toMinutes(rule.startTime) >= endMinutes(rule.endTime)) return 'O horário final precisa ser depois do inicial';
  if (!Number.isFinite(rule.pricePerHour) || rule.pricePerHour < 0) return 'Informe um preço válido';
  return null;
}
