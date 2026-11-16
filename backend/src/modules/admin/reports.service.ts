import { utcToZoned, zonedDateTimeToUtc } from '../../shared/utils/timezone';
import { BookingsRepository } from '../bookings/bookings.repository';
import { getOperatingMinutes, type CourtSchedule } from '../bookings/slot-rules';
import { dayBounds, daysOfMonth, nextMonth, overlapMinutes, previousMonth, todayIn } from './admin-time';
import { AdminRepository, CUSTOMER_TYPES } from './admin.repository';
import { AdminService } from './admin.service';

type ReportBooking = Awaited<ReturnType<AdminRepository['findBookingsForReport']>>[number];

const MINUTE = 60_000;

/** Percentual com 1 casa (0 quando não há capacidade) */
const rate = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/**
 * Minutos de funcionamento REAL de uma quadra por dia: só slots inteiros
 * contam (06:00–23:00 com slots de 90 min = 11 slots = 990 min, não 1020).
 */
function bookableMinutesPerDay(court: CourtSchedule): number {
  const { open, close } = getOperatingMinutes(court);
  return Math.floor((close - open) / court.slotDurationMin) * court.slotDurationMin;
}

/** Distribui os minutos de [start, end) pelas horas locais do dia (0–23) */
function addToHourBuckets(buckets: number[], start: Date, end: Date, timeZone: string): void {
  let cursor = start.getTime();
  while (cursor < end.getTime()) {
    const { minutesOfDay } = utcToZoned(new Date(cursor), timeZone);
    const chunk = Math.min(60 - (minutesOfDay % 60), (end.getTime() - cursor) / MINUTE);
    buckets[Math.floor(minutesOfDay / 60)] += chunk;
    cursor += chunk * MINUTE;
  }
}

/**
 * Indicadores do mês para o dashboard do dono.
 *
 * - Faturamento: reservas PAGAS (estornadas ficam de fora) com início no mês.
 *   Aulas não entram: o valor é acertado com o professor.
 * - Ocupação: minutos reservados (clientes + aulas) ÷ minutos reserváveis
 *   (horário de funcionamento das quadras ativas − bloqueios de manutenção).
 *   Inclui reservas futuras do mês: mostra como o mês está "vendido".
 * - Pico: ocupação por hora do dia — onde vale cobrar mais (horário nobre).
 */
export class ReportsService {
  constructor(
    private readonly adminService = new AdminService(),
    private readonly adminRepository = new AdminRepository(),
    private readonly bookingsRepository = new BookingsRepository(),
  ) {}

  async getReports(ownerId: string, query: { arenaId?: string; month?: string }, now = new Date()) {
    const arena = await this.adminService.resolveArena(ownerId, query.arenaId);
    const tz = arena.timezone;
    const today = todayIn(tz, now);
    const month = query.month ?? today.slice(0, 7);
    const monthStart = zonedDateTimeToUtc(`${month}-01`, 0, tz);
    const monthEnd = zonedDateTimeToUtc(`${nextMonth(month)}-01`, 0, tz);
    const prev = previousMonth(month);
    const days = daysOfMonth(month);

    await this.bookingsRepository.expireOverdue(now);

    const courts = await this.adminRepository.findCourts(arena.id);
    const courtIds = courts.map((c) => c.id);
    const todayRange = dayBounds(today, tz);

    const [bookings, previousRevenue, todayBookings] = await Promise.all([
      this.adminRepository.findBookingsForReport(courtIds, monthStart, monthEnd),
      this.adminRepository.sumPaidRevenue(courtIds, zonedDateTimeToUtc(`${prev}-01`, 0, tz), monthStart),
      this.adminRepository.findBookingsForReport(courtIds, todayRange.start, todayRange.end),
    ]);

    const isCustomer = (b: ReportBooking) => CUSTOMER_TYPES.includes(b.type);
    const occupies = (b: ReportBooking) => isCustomer(b) || b.type === 'CLASS';
    const startsIn = (b: ReportBooking, from: Date, to: Date) => b.startTime >= from && b.startTime < to;

    // ---------------- faturamento
    const paid = bookings.filter((b) => isCustomer(b) && b.paymentStatus === 'PAID' && startsIn(b, monthStart, monthEnd));
    const revenue = paid.reduce((sum, b) => sum + b.totalPrice, 0);
    const pendingRevenue = bookings
      .filter((b) => isCustomer(b) && b.status === 'PENDING_PAYMENT' && startsIn(b, monthStart, monthEnd))
      .reduce((sum, b) => sum + b.totalPrice, 0);

    const revenueByDay = days.map((date) => {
      const { start, end } = dayBounds(date, tz);
      return { date, revenue: paid.filter((b) => startsIn(b, start, end)).reduce((sum, b) => sum + b.totalPrice, 0) };
    });

    // ---------------- ocupação (por quadra e total)
    const activeCourts = courts.filter((c) => c.status === 'ACTIVE');
    const perCourt = courts.map((court) => {
      const active = court.status === 'ACTIVE';
      const capacity = active ? bookableMinutesPerDay(court) * days.length : 0;
      const { open, close } = getOperatingMinutes(court);
      const courtBookings = bookings.filter((b) => b.courtId === court.id);

      const occupied = courtBookings
        .filter(occupies)
        .reduce((sum, b) => sum + overlapMinutes(b.startTime, b.endTime, monthStart, monthEnd), 0);

      // Bloqueio só desconta o que cai DENTRO do horário de funcionamento
      const blocked = active
        ? courtBookings
            .filter((b) => b.type === 'MAINTENANCE')
            .reduce(
              (sum, b) =>
                sum +
                days.reduce(
                  (daySum, date) =>
                    daySum +
                    overlapMinutes(b.startTime, b.endTime, zonedDateTimeToUtc(date, open, tz), zonedDateTimeToUtc(date, close, tz)),
                  0,
                ),
              0,
            )
        : 0;

      const courtRevenue = paid.filter((b) => b.courtId === court.id).reduce((sum, b) => sum + b.totalPrice, 0);
      return {
        courtId: court.id,
        name: court.name,
        status: court.status,
        capacityMin: capacity,
        blockedMin: blocked,
        occupiedMin: occupied,
        occupancyRate: rate(occupied, capacity - blocked),
        revenue: courtRevenue,
      };
    });

    const totals = perCourt.reduce(
      (acc, c) => (c.status === 'ACTIVE' ? { capacity: acc.capacity + c.capacityMin - c.blockedMin, occupied: acc.occupied + c.occupiedMin } : acc),
      { capacity: 0, occupied: 0 },
    );

    // ---------------- horários de pico (ocupação por hora do dia, quadras ativas)
    const bookedByHour = Array<number>(24).fill(0);
    const capacityByHour = Array<number>(24).fill(0);
    for (const court of activeCourts) {
      const { open, close } = getOperatingMinutes(court);
      for (let hour = 0; hour < 24; hour++) {
        const minutes = Math.max(0, Math.min(close, (hour + 1) * 60) - Math.max(open, hour * 60));
        capacityByHour[hour] += minutes * days.length;
      }
    }
    for (const b of bookings) {
      if (!occupies(b) || !activeCourts.some((c) => c.id === b.courtId)) continue;
      const start = new Date(Math.max(b.startTime.getTime(), monthStart.getTime()));
      const end = new Date(Math.min(b.endTime.getTime(), monthEnd.getTime()));
      addToHourBuckets(bookedByHour, start, end, tz);
    }
    const peakHours = capacityByHour
      .map((capacity, hour) => ({
        hour,
        bookedHours: Math.round((bookedByHour[hour] / 60) * 10) / 10,
        occupancyRate: rate(bookedByHour[hour], capacity),
      }))
      .filter((_, hour) => capacityByHour[hour] > 0);
    const topHours = [...peakHours]
      .filter((h) => h.bookedHours > 0)
      .sort((a, b) => b.occupancyRate - a.occupancyRate || b.bookedHours - a.bookedHours)
      .slice(0, 3)
      .map((h) => h.hour);

    // ---------------- hoje (sempre o dia atual, independente do mês consultado)
    const todayCustomer = todayBookings.filter((b) => isCustomer(b) && startsIn(b, todayRange.start, todayRange.end));

    return {
      arena,
      month,
      generatedAt: now,
      revenue: {
        total: revenue,
        previousMonth: previousRevenue,
        /** null quando o mês anterior não faturou (variação indefinida) */
        changeRate: previousRevenue > 0 ? rate(revenue - previousRevenue, previousRevenue) : null,
        pending: pendingRevenue,
        paidBookings: paid.length,
        averageTicket: paid.length > 0 ? Math.round(revenue / paid.length) : 0,
        byDay: revenueByDay,
      },
      occupancy: {
        rate: rate(totals.occupied, totals.capacity),
        bookedHours: Math.round((totals.occupied / 60) * 10) / 10,
        availableHours: Math.round((totals.capacity / 60) * 10) / 10,
        byCourt: perCourt.map(({ capacityMin: _c, blockedMin, occupiedMin, ...court }) => ({
          ...court,
          bookedHours: Math.round((occupiedMin / 60) * 10) / 10,
          blockedHours: Math.round((blockedMin / 60) * 10) / 10,
        })),
      },
      peakHours: { byHour: peakHours, top: topHours },
      today: {
        date: today,
        bookings: todayCustomer.length,
        classes: todayBookings.filter((b) => b.type === 'CLASS' && startsIn(b, todayRange.start, todayRange.end)).length,
        paidRevenue: todayCustomer.filter((b) => b.paymentStatus === 'PAID').reduce((sum, b) => sum + b.totalPrice, 0),
        pendingPayments: todayCustomer.filter((b) => b.status === 'PENDING_PAYMENT').length,
      },
    };
  }
}
