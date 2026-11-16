import type { CourtStatus } from '@prisma/client';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { utcToZoned } from '../../shared/utils/timezone';
import { BookingsRepository, isOverlapViolation } from '../bookings/bookings.repository';
import { CANCELLATION_REASONS } from '../bookings/booking-policy';
import { calculatePrice, formatHHmm, generateDailySlots, getOperatingMinutes, rangesOverlap } from '../bookings/slot-rules';
import { resolveHourlyPrice, weekdayOf } from '../pricing/pricing';
import { PricingRepository } from '../pricing/pricing.repository';
import { dayBounds, todayIn } from './admin-time';
import { AdminRepository, type AdminCourt, type AgendaBooking } from './admin.repository';
import type { BlockInput, PricingInput } from './admin.schemas';

export interface AdminArena {
  id: string;
  name: string;
  timezone: string;
}

export type AgendaEventKind = 'BOOKING' | 'CLASS' | 'MAINTENANCE';

export interface AgendaEvent {
  id: string;
  kind: AgendaEventKind;
  status: AgendaBooking['status'];
  paymentStatus: AgendaBooking['paymentStatus'];
  startTime: Date;
  endTime: Date;
  /** Posição no dia (minutos desde a meia-noite local), já recortada ao dia */
  startMin: number;
  endMin: number;
  /** "10:00–11:00" no fuso da arena (horário real, mesmo se atravessa o dia) */
  timeLabel: string;
  title: string;
  subtitle: string | null;
  customer: { name: string; phone: string | null } | null;
  totalPrice: number;
  notes: string | null;
  expiresAt: Date | null;
}

export interface AgendaSlot {
  startTime: Date;
  endTime: Date;
  startMin: number;
  endMin: number;
  label: string;
  price: number;
  priceRule: string | null;
  /** Já terminou: não dá mais para bloquear */
  past: boolean;
}

const MINUTE = 60_000;

/** Painel do dono da arena: operação do dia, bloqueios e preços */
export class AdminService {
  constructor(
    private readonly adminRepository = new AdminRepository(),
    private readonly bookingsRepository = new BookingsRepository(),
    private readonly pricingRepository = new PricingRepository(),
  ) {}

  async resolveArena(ownerId: string, arenaId?: string): Promise<AdminArena> {
    const arena = await this.adminRepository.findOwnedArena(ownerId, arenaId);
    if (!arena) throw new NotFoundError(arenaId ? 'Arena não encontrada' : 'Nenhuma arena vinculada à sua conta');
    return arena;
  }

  // ---------------------------------------------------------------- agenda

  /** Dia inteiro da arena, quadra por quadra: reservas, aulas, bloqueios e horários livres */
  async getAgenda(ownerId: string, query: { arenaId?: string; date?: string }, now = new Date()) {
    const arena = await this.resolveArena(ownerId, query.arenaId);
    const date = query.date ?? todayIn(arena.timezone, now);
    const day = dayBounds(date, arena.timezone);
    const dayLengthMin = (day.end.getTime() - day.start.getTime()) / MINUTE;

    // Pendentes vencidas não podem aparecer como "ocupando" o horário
    await this.bookingsRepository.expireOverdue(now);

    const courts = await this.adminRepository.findCourts(arena.id);
    const [bookings, rules] = await Promise.all([
      this.adminRepository.findAgendaBookings(courts.map((c) => c.id), day.start, day.end),
      this.pricingRepository.findForArena(arena.id),
    ]);

    const toMin = (instant: Date) =>
      Math.min(Math.max((instant.getTime() - day.start.getTime()) / MINUTE, 0), dayLengthMin);
    const weekday = weekdayOf(date);

    const agendaCourts = courts.map((court) => {
      const events = bookings
        .filter((b) => b.courtId === court.id)
        .map((b) => this.toEvent(b, arena.timezone, toMin));

      const { open, close } = getOperatingMinutes(court);
      const slots: AgendaSlot[] = generateDailySlots(court, date, arena.timezone)
        // Só os horários livres: os ocupados já aparecem como eventos
        .filter((slot) => !events.some((e) => rangesOverlap(slot, { start: e.startTime, end: e.endTime })))
        .map((slot) => {
          const { minutesOfDay } = utcToZoned(slot.start, arena.timezone);
          const { pricePerHour, ruleName } = resolveHourlyPrice(court, rules, weekday, minutesOfDay);
          return {
            startTime: slot.start,
            endTime: slot.end,
            startMin: toMin(slot.start),
            endMin: toMin(slot.end),
            label: formatHHmm(minutesOfDay),
            price: calculatePrice(pricePerHour, court.slotDurationMin),
            priceRule: ruleName,
            past: slot.end <= now,
          };
        });

      return {
        id: court.id,
        name: court.name,
        status: court.status,
        isCovered: court.isCovered,
        slotDurationMin: court.slotDurationMin,
        openMin: open,
        closeMin: close,
        events,
        slots,
      };
    });

    const customerEvents = agendaCourts.flatMap((c) => c.events).filter((e) => e.kind === 'BOOKING');
    return {
      arena,
      date,
      today: todayIn(arena.timezone, now),
      now,
      courts: agendaCourts,
      summary: {
        bookings: customerEvents.length,
        classes: agendaCourts.flatMap((c) => c.events).filter((e) => e.kind === 'CLASS').length,
        blocks: agendaCourts.flatMap((c) => c.events).filter((e) => e.kind === 'MAINTENANCE').length,
        freeSlots: agendaCourts.reduce((sum, c) => sum + (c.status === 'ACTIVE' ? c.slots.filter((s) => !s.past).length : 0), 0),
        paidRevenue: customerEvents.filter((e) => e.paymentStatus === 'PAID').reduce((sum, e) => sum + e.totalPrice, 0),
        pendingPayments: customerEvents.filter((e) => e.status === 'PENDING_PAYMENT').length,
      },
    };
  }

  private toEvent(booking: AgendaBooking, timeZone: string, toMin: (d: Date) => number): AgendaEvent {
    const kind: AgendaEventKind =
      booking.type === 'CLASS' ? 'CLASS' : booking.type === 'MAINTENANCE' ? 'MAINTENANCE' : 'BOOKING';
    const time = (d: Date) => formatHHmm(utcToZoned(d, timeZone).minutesOfDay);

    let title: string;
    let subtitle: string | null = null;
    if (kind === 'CLASS') {
      title = booking.lesson?.title ?? booking.notes ?? 'Aula';
      const enrolled = booking.lesson?._count.enrollments ?? 0;
      subtitle = `${booking.user.name} · ${enrolled}/${booking.lesson?.capacity ?? '?'} alunos`;
    } else if (kind === 'MAINTENANCE') {
      title = 'Manutenção';
      subtitle = booking.notes;
    } else {
      title = booking.user.name;
      subtitle = booking.type === 'OPEN_MATCH' ? 'Partida aberta' : null;
    }

    return {
      id: booking.id,
      kind,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      startTime: booking.startTime,
      endTime: booking.endTime,
      startMin: toMin(booking.startTime),
      endMin: toMin(booking.endTime),
      timeLabel: `${time(booking.startTime)}–${time(booking.endTime)}`,
      title,
      subtitle,
      // Telefone do cliente só para reservas (o admin liga para confirmar/avisar)
      customer: kind === 'BOOKING' ? { name: booking.user.name, phone: booking.user.phone } : null,
      totalPrice: kind === 'BOOKING' ? booking.totalPrice : 0,
      notes: kind === 'MAINTENANCE' ? null : booking.notes,
      expiresAt: booking.expiresAt,
    };
  }

  // ---------------------------------------------------------------- bloqueios

  /**
   * Bloqueia um período de uma quadra (manutenção, evento, chuva...).
   * Nunca derruba reserva de cliente: se houver alguma no período, recusa e
   * lista quais são — o admin decide (avisar o cliente, escolher outro horário).
   */
  async blockSlot(adminId: string, arenaId: string | undefined, input: BlockInput, now = new Date()) {
    const arena = await this.resolveArena(adminId, arenaId);
    const court = await this.adminRepository.findCourt(arena.id, input.courtId);
    if (!court) throw new NotFoundError('Quadra não encontrada');
    if (input.endTime <= now) throw new ValidationError('Esse horário já passou');

    await this.bookingsRepository.expireOverdue(now, court.id);
    const conflicts = await this.bookingsRepository.findBlockingInRange(court.id, input.startTime, input.endTime);

    if (conflicts.some((c) => c.type === 'MAINTENANCE')) {
      throw new ConflictError('Já existe um bloqueio de manutenção nesse período');
    }
    if (conflicts.length > 0) {
      const time = (d: Date) => formatHHmm(utcToZoned(d, arena.timezone).minutesOfDay);
      const list = conflicts.map((c) => `${utcToZoned(c.startTime, arena.timezone).date} ${time(c.startTime)}–${time(c.endTime)}`);
      throw new AppError(
        `Há ${conflicts.length === 1 ? 'uma reserva ou aula' : `${conflicts.length} reservas/aulas`} nesse período. Cancele ou remaneje antes de bloquear.`,
        409,
        'BLOCK_CONFLICT',
        { conflicts: list },
      );
    }

    try {
      const created = await this.adminRepository.transaction((tx) =>
        tx.booking.create({
          data: {
            courtId: court.id,
            userId: adminId,
            startTime: input.startTime,
            endTime: input.endTime,
            type: 'MAINTENANCE',
            status: 'CONFIRMED',
            totalPrice: 0,
            paymentStatus: 'PAID', // nada a cobrar
            notes: input.reason || null,
          },
          select: { id: true, startTime: true, endTime: true, notes: true },
        }),
      );
      return { block: { ...created, courtId: court.id } };
    } catch (error) {
      // Corrida: um cliente reservou entre a checagem e a gravação
      if (isOverlapViolation(error)) throw new ConflictError('Alguém acabou de reservar esse horário. Atualize a agenda.');
      throw error;
    }
  }

  /** Remove um bloqueio (o horário volta a ficar livre para reserva) */
  async unblock(adminId: string, arenaId: string | undefined, blockId: string, now = new Date()) {
    const arena = await this.resolveArena(adminId, arenaId);
    const block = await this.adminRepository.findMaintenanceBlock(arena.id, blockId);
    if (!block || block.status === 'CANCELLED') throw new NotFoundError('Bloqueio não encontrado');
    if (block.endTime <= now) throw new ConflictError('Este bloqueio já terminou');

    await this.adminRepository.transaction((tx) =>
      tx.booking.update({
        where: { id: block.id },
        data: { status: 'CANCELLED', cancelledAt: now, cancellationReason: CANCELLATION_REASONS.adminUnblocked },
      }),
    );
  }

  /**
   * Quadra inteira em manutenção (por tempo indeterminado) ou de volta à ativa.
   * Reservas futuras NÃO são canceladas automaticamente: a resposta informa
   * quantas existem para o admin tratar com os clientes.
   */
  async setCourtStatus(adminId: string, arenaId: string | undefined, courtId: string, status: CourtStatus, now = new Date()) {
    const arena = await this.resolveArena(adminId, arenaId);
    const court = await this.adminRepository.findCourt(arena.id, courtId);
    if (!court) throw new NotFoundError('Quadra não encontrada');

    const updated = await this.adminRepository.updateCourtStatus(court.id, status);
    const upcomingBookings =
      status === 'MAINTENANCE' ? await this.adminRepository.countUpcomingCustomerBookings(court.id, now) : 0;
    return { court: updated, upcomingBookings };
  }

  // ---------------------------------------------------------------- preços

  async getPricing(adminId: string, arenaId?: string) {
    const arena = await this.resolveArena(adminId, arenaId);
    const [courts, rules] = await Promise.all([
      this.adminRepository.findCourts(arena.id),
      this.pricingRepository.findForArena(arena.id),
    ]);
    return { arena, courts: courts.map(pricingCourt), rules };
  }

  /**
   * Substitui a configuração de preços inteira numa transação (preço base de
   * cada quadra + todas as regras). Reservas já feitas mantêm o valor pago.
   */
  async updatePricing(adminId: string, arenaId: string | undefined, input: PricingInput) {
    const arena = await this.resolveArena(adminId, arenaId);
    const courts = await this.adminRepository.findCourts(arena.id);
    const ownCourtIds = new Set(courts.map((c) => c.id));

    const foreign = [...input.courts.map((c) => c.courtId), ...input.rules.flatMap((r) => (r.courtId ? [r.courtId] : []))].filter(
      (id) => !ownCourtIds.has(id),
    );
    if (foreign.length > 0) throw new ValidationError('Há quadras que não pertencem à sua arena');

    await this.adminRepository.transaction(async (tx) => {
      for (const { courtId, pricePerHour } of input.courts) {
        await tx.court.update({ where: { id: courtId }, data: { pricePerHour } });
      }
      await tx.pricingRule.deleteMany({ where: { arenaId: arena.id } });
      if (input.rules.length > 0) {
        await tx.pricingRule.createMany({ data: input.rules.map((rule) => ({ ...rule, arenaId: arena.id })) });
      }
    });

    return this.getPricing(adminId, arena.id);
  }
}

function pricingCourt(court: AdminCourt) {
  const { close } = getOperatingMinutes(court);
  return {
    id: court.id,
    name: court.name,
    status: court.status,
    pricePerHour: court.pricePerHour,
    slotDurationMin: court.slotDurationMin,
    openTime: court.openTime,
    closeTime: formatHHmm(close),
  };
}
