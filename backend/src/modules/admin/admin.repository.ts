import type { BookingType, CourtStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

export const adminCourtSelect = {
  id: true,
  name: true,
  status: true,
  isCovered: true,
  openTime: true,
  closeTime: true,
  slotDurationMin: true,
  pricePerHour: true,
} satisfies Prisma.CourtSelect;

export type AdminCourt = Prisma.CourtGetPayload<{ select: typeof adminCourtSelect }>;

const agendaBookingSelect = {
  id: true,
  courtId: true,
  type: true,
  status: true,
  paymentStatus: true,
  totalPrice: true,
  notes: true,
  startTime: true,
  endTime: true,
  expiresAt: true,
  user: { select: { name: true, phone: true } },
  lesson: {
    select: {
      title: true,
      capacity: true,
      _count: { select: { enrollments: { where: { status: 'ENROLLED' as const } } } },
    },
  },
} satisfies Prisma.BookingSelect;

export type AgendaBooking = Prisma.BookingGetPayload<{ select: typeof agendaBookingSelect }>;

/** Reservas que ocupam a quadra (o que não é bloqueio administrativo) */
export const CUSTOMER_TYPES: BookingType[] = ['REGULAR', 'OPEN_MATCH'];

/** Consultas do painel do dono da arena — sempre filtradas pela arena dele */
export class AdminRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Arena do dono (a primeira em ordem alfabética, ou a pedida em `arenaId`) */
  findOwnedArena(ownerId: string, arenaId?: string) {
    return this.db.arena.findFirst({
      where: { ownerId, ...(arenaId && { id: arenaId }) },
      select: { id: true, name: true, timezone: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Quadras da arena (inativas ficam de fora do painel operacional) */
  findCourts(arenaId: string): Promise<AdminCourt[]> {
    return this.db.court.findMany({
      where: { arenaId, status: { not: 'INACTIVE' } },
      select: adminCourtSelect,
      orderBy: { name: 'asc' },
    });
  }

  findCourt(arenaId: string, courtId: string) {
    return this.db.court.findFirst({ where: { id: courtId, arenaId }, select: adminCourtSelect });
  }

  /** Tudo que ocupa as quadras em [from, to): reservas, aulas e bloqueios */
  findAgendaBookings(courtIds: string[], from: Date, to: Date): Promise<AgendaBooking[]> {
    return this.db.booking.findMany({
      where: { courtId: { in: courtIds }, status: { not: 'CANCELLED' }, startTime: { lt: to }, endTime: { gt: from } },
      select: agendaBookingSelect,
      orderBy: { startTime: 'asc' },
    });
  }

  /** Versão enxuta para os relatórios (sem joins) */
  findBookingsForReport(courtIds: string[], from: Date, to: Date) {
    return this.db.booking.findMany({
      where: { courtId: { in: courtIds }, status: { not: 'CANCELLED' }, startTime: { lt: to }, endTime: { gt: from } },
      select: { courtId: true, type: true, status: true, paymentStatus: true, totalPrice: true, startTime: true, endTime: true },
    });
  }

  /** Faturamento (reservas pagas) com início em [from, to) */
  async sumPaidRevenue(courtIds: string[], from: Date, to: Date): Promise<number> {
    const { _sum } = await this.db.booking.aggregate({
      where: {
        courtId: { in: courtIds },
        type: { in: CUSTOMER_TYPES },
        status: { not: 'CANCELLED' },
        paymentStatus: 'PAID',
        startTime: { gte: from, lt: to },
      },
      _sum: { totalPrice: true },
    });
    return _sum.totalPrice ?? 0;
  }

  findMaintenanceBlock(arenaId: string, bookingId: string) {
    return this.db.booking.findFirst({
      where: { id: bookingId, type: 'MAINTENANCE', court: { arenaId } },
      select: { id: true, status: true, startTime: true, endTime: true },
    });
  }

  /** Reservas de clientes ainda por acontecer numa quadra */
  countUpcomingCustomerBookings(courtId: string, now: Date): Promise<number> {
    return this.db.booking.count({
      where: { courtId, type: { in: CUSTOMER_TYPES }, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, endTime: { gt: now } },
    });
  }

  updateCourtStatus(courtId: string, status: CourtStatus) {
    return this.db.court.update({ where: { id: courtId }, data: { status }, select: adminCourtSelect });
  }

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(work);
  }
}
