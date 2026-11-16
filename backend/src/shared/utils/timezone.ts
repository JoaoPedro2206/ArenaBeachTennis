/**
 * Conversões entre horário local de uma arena (ex.: America/Sao_Paulo)
 * e instantes UTC, usando apenas Intl (sem dependências externas).
 * O banco guarda tudo em UTC; regras de funcionamento são em horário local.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = Object.fromEntries(
    getFormatter(timeZone)
      .formatToParts(instant)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
  return parts as unknown as ZonedParts;
}

/** Diferença (ms) entre o horário local do fuso e o UTC naquele instante. */
function getOffsetMs(instant: Date, timeZone: string): number {
  const p = getZonedParts(instant, timeZone);
  const localAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return localAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Converte "data local + minutos desde a meia-noite" em um instante UTC.
 * Ex.: ('2026-11-12', 18*60, 'America/Sao_Paulo') -> 2026-11-12T21:00:00Z
 * Minutos = 1440 representa a meia-noite do dia seguinte.
 */
export function zonedDateTimeToUtc(date: string, minutesOfDay: number, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, 0, minutesOfDay);
  const offset = getOffsetMs(new Date(guess), timeZone);
  let utc = guess - offset;
  // Recalcula uma vez para acertar dias de mudança de horário de verão
  const correctedOffset = getOffsetMs(new Date(utc), timeZone);
  if (correctedOffset !== offset) utc = guess - correctedOffset;
  return new Date(utc);
}

/** Data local (YYYY-MM-DD) e minutos desde a meia-noite de um instante. */
export function utcToZoned(instant: Date, timeZone: string): { date: string; minutesOfDay: number } {
  const p = getZonedParts(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    minutesOfDay: p.hour * 60 + p.minute,
  };
}
