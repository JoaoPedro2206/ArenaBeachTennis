import type { BookingType } from '@prisma/client';
import { NotFoundError } from '../../shared/errors/AppError';
import { PricingRepository } from '../pricing/pricing.repository';
import { resolveHourlyPrice, weekdayOf } from '../pricing/pricing';
import { utcToZoned } from '../../shared/utils/timezone';
import { CourtsRepository, type CourtWithArena } from '../courts/courts.repository';
import { BookingsRepository } from './bookings.repository';
import {
  BOOKING_MAX_DAYS_AHEAD,
  calculatePrice,
  formatHHmm,
  generateDailySlots,
  rangesOverlap,
} from './slot-rules';

export interface TimeSlotView {
  startTime: Date;
  endTime: Date;
  /** Horário local da arena, ex.: "18:00" — pronto para exibir no app */
  label: string;
  price: number;
  /** Nome da regra de preço aplicada (ex.: "Horário nobre"); null = preço base */
  priceRule: string | null;
  available: boolean;
  /** Por que está indisponível: reserva de alguém, aula ou manutenção */
  blockedBy: 'BOOKING' | 'CLASS' | 'MAINTENANCE' | null;
}

function blockedByOf(type: BookingType): NonNullable<TimeSlotView['blockedBy']> {
  if (type === 'CLASS') return 'CLASS';
  if (type === 'MAINTENANCE') return 'MAINTENANCE';
  return 'BOOKING';
}

export interface CourtAvailability {
  court: { id: string; name: string; status: CourtWithArena['status'] };
  arena: { id: string; name: string };
  date: string;
  timeZone: string;
  slotDurationMin: number;
  slots: TimeSlotView[];
}

export class AvailabilityService {
  constructor(
    private readonly courtsRepository = new CourtsRepository(),
    private readonly bookingsRepository = new BookingsRepository(),
    private readonly pricingRepository = new PricingRepository(),
  ) {}

  /** Grade de horários de uma quadra em um dia (data no fuso da arena). */
  async getCourtAvailability(courtId: string, date: string, now = new Date()): Promise<CourtAvailability> {
    const court = await this.courtsRepository.findByIdWithArena(courtId);
    if (!court || !court.arena.isActive) throw new NotFoundError('Quadra não encontrada');

    const { timezone } = court.arena;
    const slots = generateDailySlots(court, date, timezone);
    const weekday = weekdayOf(date);
    const bookingWindowEnd = new Date(now.getTime() + BOOKING_MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000);

    // Reservas não pagas no prazo deixam de bloquear no segundo exato
    await this.bookingsRepository.expireOverdue(now, courtId);

    // Uma única consulta cobre o dia inteiro
    const blocking =
      slots.length > 0
        ? await this.bookingsRepository.findBlockingInRange(courtId, slots[0].start, slots[slots.length - 1].end)
        : [];

    const rules = await this.pricingRepository.findForCourt(court.arena.id, court.id);
    const courtIsBookable = court.status === 'ACTIVE';

    return {
      court: { id: court.id, name: court.name, status: court.status },
      arena: { id: court.arena.id, name: court.arena.name },
      date,
      timeZone: timezone,
      slotDurationMin: court.slotDurationMin,
      slots: slots.map((slot) => {
        const { minutesOfDay } = utcToZoned(slot.start, timezone);
        const blocker = blocking.find((b) => rangesOverlap(slot, { start: b.startTime, end: b.endTime }));
        const { pricePerHour, ruleName } = resolveHourlyPrice(court, rules, weekday, minutesOfDay);
        return {
          startTime: slot.start,
          endTime: slot.end,
          label: formatHHmm(minutesOfDay),
          price: calculatePrice(pricePerHour, court.slotDurationMin),
          priceRule: ruleName,
          available: courtIsBookable && slot.start > now && slot.start <= bookingWindowEnd && !blocker,
          blockedBy: blocker ? blockedByOf(blocker.type) : null,
        };
      }),
    };
  }
}
