/**
 * Regras puras de horários (sem acesso a banco), compartilhadas entre a
 * listagem de disponibilidade e a criação de reservas. Por serem funções
 * puras, são o primeiro alvo de testes unitários.
 */
import { utcToZoned, zonedDateTimeToUtc } from '../../shared/utils/timezone';

/** Até quantos dias no futuro é possível reservar */
export const BOOKING_MAX_DAYS_AHEAD = 60;
/** Duração máxima de uma reserva única */
export const BOOKING_MAX_DURATION_MIN = 240;

export interface CourtSchedule {
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm" — "00:00" significa meia-noite (fim do dia)
  slotDurationMin: number;
  pricePerHour: number; // centavos
}

export interface TimeRange {
  start: Date;
  end: Date;
}

/** "HH:mm" -> minutos desde a meia-noite */
export function parseHHmm(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/** minutos desde a meia-noite -> "HH:mm" (1440 vira "00:00") */
export function formatHHmm(minutesOfDay: number): string {
  const normalized = minutesOfDay % (24 * 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

/** Janela de funcionamento em minutos locais. Fechamento "00:00" = 1440. */
export function getOperatingMinutes(schedule: CourtSchedule): { open: number; close: number } {
  const open = parseHHmm(schedule.openTime);
  const rawClose = parseHHmm(schedule.closeTime);
  return { open, close: rawClose === 0 ? 24 * 60 : rawClose };
}

/** Todos os slots do dia (horário local da arena), já convertidos para UTC. */
export function generateDailySlots(schedule: CourtSchedule, date: string, timeZone: string): TimeRange[] {
  const { open, close } = getOperatingMinutes(schedule);
  const slots: TimeRange[] = [];

  for (let start = open; start + schedule.slotDurationMin <= close; start += schedule.slotDurationMin) {
    slots.push({
      start: zonedDateTimeToUtc(date, start, timeZone),
      end: zonedDateTimeToUtc(date, start + schedule.slotDurationMin, timeZone),
    });
  }
  return slots;
}

/** Intervalos semiabertos [start, end): encostar não é sobrepor. */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export type SlotCheck = { ok: true; end: Date } | { ok: false; message: string };

/**
 * Valida se [start, start+duração) cabe na quadra: duração múltipla do slot,
 * no futuro, dentro da antecedência máxima, no horário de funcionamento e
 * alinhado à grade. Usado por reservas comuns e por aulas.
 */
export function checkSlotRequest(
  schedule: CourtSchedule,
  timeZone: string,
  start: Date,
  durationMin: number,
  now: Date,
  maxDaysAhead = BOOKING_MAX_DAYS_AHEAD,
): SlotCheck {
  if (durationMin % schedule.slotDurationMin !== 0 || durationMin <= 0 || durationMin > BOOKING_MAX_DURATION_MIN) {
    return {
      ok: false,
      message: `A duração deve ser múltipla de ${schedule.slotDurationMin} min e no máximo ${BOOKING_MAX_DURATION_MIN} min`,
    };
  }
  if (start <= now) return { ok: false, message: 'Não é possível reservar um horário no passado' };

  const maxStart = new Date(now.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000);
  if (start > maxStart) {
    return { ok: false, message: `Só é possível agendar com até ${maxDaysAhead} dias de antecedência` };
  }

  const { open, close } = getOperatingMinutes(schedule);
  const { minutesOfDay } = utcToZoned(start, timeZone);
  if (minutesOfDay < open || minutesOfDay + durationMin > close) {
    return { ok: false, message: `Fora do horário de funcionamento da quadra (${schedule.openTime} às ${formatHHmm(close)})` };
  }

  const alignedToGrid =
    start.getUTCSeconds() === 0 && start.getUTCMilliseconds() === 0 && (minutesOfDay - open) % schedule.slotDurationMin === 0;
  if (!alignedToGrid) {
    return {
      ok: false,
      message: `O início deve coincidir com a grade de horários (a cada ${schedule.slotDurationMin} min a partir de ${schedule.openTime})`,
    };
  }

  return { ok: true, end: new Date(start.getTime() + durationMin * 60_000) };
}

/** Preço em centavos, proporcional à duração. */
export function calculatePrice(pricePerHour: number, durationMin: number): number {
  return Math.round((pricePerHour * durationMin) / 60);
}
