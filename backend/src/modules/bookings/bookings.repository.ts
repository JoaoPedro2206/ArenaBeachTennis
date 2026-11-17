import { Prisma, type BookingStatus, type PrismaClient } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { ConflictError } from '../../shared/errors/AppError';
import { CANCELLATION_REASONS } from './booking-policy';

/** Campos devolvidos pela API para uma reserva. */
export const bookingSelect = {
  id: true,
  startTime: true,
  endTime: true,
  type: true,
  status: true,
  totalPrice: true,
  paymentStatus: true,
  expiresAt: true,
  paidAt: true,
  cancelledAt: true,
  notes: true,
  createdAt: true,
  court: { select: { id: true, name: true, arena: { select: { id: true, name: true, timezone: true } } } },
} satisfies Prisma.BookingSelect;

export type BookingView = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;

/** Nome da EXCLUSION CONSTRAINT criada na migration booking_no_overlap */
const OVERLAP_CONSTRAINT = 'bookings_no_overlap';

/**
 * A inserção perdeu para outra reserva no mesmo horário.
 *
 * Além da violação (23P01), dois INSERTs simultâneos e conflitantes podem
 * terminar em DEADLOCK (40P01): cada um espera a transação do outro para
 * checar a EXCLUDE constraint, e o Postgres aborta um deles. Num INSERT de
 * uma única reserva o único motivo para isso é o conflito de horário — então
 * é o mesmo 409, não um 500.
 */
export function isOverlapViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes(OVERLAP_CONSTRAINT) || error.message.includes('23P01') || error.message.includes('40P01');
}

type Db = PrismaClient | Prisma.TransactionClient;

export class BookingsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /**
   * Reservas que ocupam a quadra em algum momento de [from, to).
   * Qualquer status diferente de CANCELLED bloqueia o horário — mesma
   * regra da constraint no banco. (Pendentes vencidas são canceladas antes
   * pela rotina de expiração, então não aparecem aqui.)
   */
  findBlockingInRange(courtId: string, from: Date, to: Date, db: Db = this.db) {
    return db.booking.findMany({
      where: {
        courtId,
        status: { not: 'CANCELLED' },
        startTime: { lt: to },
        endTime: { gt: from },
      },
      select: { id: true, startTime: true, endTime: true, type: true },
      orderBy: { startTime: 'asc' },
    });
  }

  findById(id: string) {
    return this.db.booking.findUnique({ where: { id }, select: { ...bookingSelect, userId: true, cancellationReason: true } });
  }

  async create(data: Prisma.BookingUncheckedCreateInput): Promise<BookingView> {
    try {
      return await this.db.booking.create({ data, select: bookingSelect });
    } catch (error) {
      // Corrida: outra reserva passou na checagem do service ao mesmo tempo
      if (isOverlapViolation(error)) {
        throw new ConflictError('Este horário acabou de ser reservado por outra pessoa');
      }
      throw error;
    }
  }

  /**
   * Cancela, numa única instrução, toda reserva PENDING_PAYMENT cujo prazo
   * venceu. Opcionalmente restrito a uma quadra (usado antes de mostrar a
   * grade ou criar reserva, para liberar o horário no segundo exato).
   */
  async expireOverdue(now = new Date(), courtId?: string): Promise<number> {
    const { count } = await this.db.booking.updateMany({
      where: { status: 'PENDING_PAYMENT', expiresAt: { lte: now }, ...(courtId && { courtId }) },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
        cancelledAt: now,
        cancellationReason: CANCELLATION_REASONS.paymentExpired,
      },
    });
    return count;
  }

  /**
   * Confirma o pagamento só se a reserva AINDA estiver pendente e no prazo.
   * A condição fica no WHERE para que pagamento e expiração nunca "ganhem"
   * os dois: o banco aplica um ou outro.
   */
  async confirmPayment(id: string, userId: string, now: Date, externalId: string): Promise<boolean> {
    const { count } = await this.db.booking.updateMany({
      where: { id, userId, status: 'PENDING_PAYMENT', expiresAt: { gt: now } },
      data: { status: 'CONFIRMED', paymentStatus: 'PAID', paidAt: now, paymentExternalId: externalId, expiresAt: null },
    });
    return count === 1;
  }

  /**
   * Cancela só se a reserva AINDA estiver no status em que o service a leu.
   * Devolve null se ela mudou no meio (ex.: foi paga entre a leitura e o
   * cancelamento) — sem essa condição, uma reserva recém-paga seria cancelada
   * como "não paga" e o estorno nunca aconteceria.
   */
  async cancel(
    id: string,
    data: { now: Date; reason: string; refund: boolean; expectedStatus: BookingStatus },
  ): Promise<BookingView | null> {
    const { count } = await this.db.booking.updateMany({
      where: { id, status: data.expectedStatus },
      data: {
        status: 'CANCELLED',
        cancelledAt: data.now,
        cancellationReason: data.reason,
        expiresAt: null,
        paymentStatus: data.refund ? 'REFUNDED' : 'FAILED',
      },
    });
    if (count === 0) return null;
    return this.db.booking.findUnique({ where: { id }, select: bookingSelect });
  }

  findByUser(userId: string, scope: 'upcoming' | 'past', now = new Date()): Promise<BookingView[]> {
    return this.db.booking.findMany({
      where: {
        userId,
        // Bloqueios de aula (professor) e de manutenção (admin) não são "reservas" de quem os criou
        type: { notIn: ['CLASS', 'MAINTENANCE'] },
        ...(scope === 'upcoming' ? { endTime: { gte: now } } : { endTime: { lt: now } }),
      },
      select: bookingSelect,
      orderBy: { startTime: scope === 'upcoming' ? 'asc' : 'desc' },
      take: 50,
    });
  }
}
