/**
 * Datas de calendário como string "YYYY-MM-DD" (sem hora), o mesmo formato
 * que a API espera. Operar sobre strings evita o clássico bug de fuso em que
 * `new Date('2026-11-12')` vira dia 11 às 21h no Brasil.
 */

/** "Hoje" no fuso informado (padrão: fuso do navegador) */
export function todayIn(timeZone?: string): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`); // meio-dia UTC: imune a fuso/horário de verão
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Instante ISO -> "qui, 12 nov" e "18:00" no fuso informado */
export function formatInZone(iso: string, timeZone: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: new Intl.DateTimeFormat('pt-BR', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })
      .format(d)
      .replace(/\./g, ''),
    time: new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(d),
  };
}

/** Partes para exibição: { weekday: 'qui', day: '12', month: 'nov' } */
export function dateParts(date: string): { weekday: string; day: string; month: string; long: string } {
  const d = new Date(`${date}T12:00:00Z`);
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...options }).format(d).replace('.', '');
  return {
    weekday: fmt({ weekday: 'short' }),
    day: fmt({ day: '2-digit' }),
    month: fmt({ month: 'short' }),
    long: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
  };
}
