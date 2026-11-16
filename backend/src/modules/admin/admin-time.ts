import { utcToZoned, zonedDateTimeToUtc } from '../../shared/utils/timezone';

/** Utilitários de calendário no fuso da arena, usados pela agenda e pelos relatórios */

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayIn(timeZone: string, now = new Date()): string {
  return utcToZoned(now, timeZone).date;
}

/** [início, fim) de um dia local em UTC (23h ou 25h em dias de horário de verão) */
export function dayBounds(date: string, timeZone: string): { start: Date; end: Date } {
  return { start: zonedDateTimeToUtc(date, 0, timeZone), end: zonedDateTimeToUtc(addDays(date, 1), 0, timeZone) };
}

/** Datas locais ("YYYY-MM-DD") de todos os dias do mês "YYYY-MM" */
export function daysOfMonth(month: string): string[] {
  const days: string[] = [];
  for (let date = `${month}-01`; date.startsWith(month); date = addDays(date, 1)) days.push(date);
  return days;
}

export function nextMonth(month: string): string {
  return addDays(`${month}-28`, 7).slice(0, 7);
}

export function previousMonth(month: string): string {
  return addDays(`${month}-01`, -1).slice(0, 7);
}

/** Minutos de interseção entre [aStart, aEnd) e [bStart, bEnd) */
export function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return end > start ? (end - start) / 60_000 : 0;
}
