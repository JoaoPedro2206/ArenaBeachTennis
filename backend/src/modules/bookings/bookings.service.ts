import { randomUUID } from 'node:crypto';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { CourtsRepository } from '../courts/courts.repository';
import { BookingsRepository, type BookingView } from './bookings.repository';
import type { CreateBookingInput } from './bookings.schemas';
import {
  CANCELLATION_MIN_HOURS,
  CANCELLATION_REASONS,
  isWithinCancellationWindow,
  paymentDeadline,
  PAYMENT_WINDOW_MIN,
} from './booking-policy';
import { checkSlotRequest } from './slot-rules';
import { PricingRepository } from '../pricing/pricing.repository';
import { priceForRange } from '../pricing/pricing';

/** 410 Gone: a reserva existiu, mas o prazo de pagamento acabou */
function expiredError(): AppError {
  return new AppError(
    `O prazo de ${PAYMENT_WINDOW_MIN} minutos para pagamento expirou. O horário foi liberado.`,
    410,
    'BOOKING_EXPIRED',
  );
}

export class BookingsService {
  constructor(
    private readonly courtsRepository = new CourtsRepository(),
    private readonly bookingsRepository = new BookingsRepository(),
    private readonly pricingRepository = new PricingRepository(),
  ) {}

  /**
   * Cria uma reserva PENDING_PAYMENT com prazo de pagamento.
   * Ordem: quadra -> horário válido -> libera vencidas -> conflito -> grava.
   * O conflito é checado aqui (mensagem amigável) E no banco (constraint),
   * que cobre requisições simultâneas.
   */
  async create(userId: string, input: CreateBookingInput, now = new Date()): Promise<BookingView> {
    const court = await this.courtsRepository.findByIdWithArena(input.courtId);
    if (!court || !court.arena.isActive) throw new NotFoundError('Quadra não encontrada');
    if (court.status !== 'ACTIVE') {
      throw new ConflictError('Quadra indisponível para reservas no momento (manutenção ou inativa)');
    }

    const durationMin = input.durationMin ?? court.slotDurationMin;
    const slot = checkSlotRequest(court, court.arena.timezone, input.startTime, durationMin, now);
    if (!slot.ok) throw new ValidationError(slot.message);

    // Pendentes vencidas desta quadra deixam de bloquear o horário agora,
    // sem esperar a próxima varredura do worker.
    await this.bookingsRepository.expireOverdue(now, court.id);

    const conflicts = await this.bookingsRepository.findBlockingInRange(court.id, input.startTime, slot.end);
    if (conflicts.length > 0) {
      throw new ConflictError('Horário indisponível: já existe uma reserva nesse intervalo');
    }

    return this.bookingsRepository.create({
      courtId: court.id,
      userId,
      startTime: input.startTime,
      endTime: slot.end,
      type: 'REGULAR',
      status: 'PENDING_PAYMENT',
      expiresAt: paymentDeadline(now),
      // Mesmo cálculo da grade pública: o preço exibido é o preço cobrado
      totalPrice: priceForRange(
        court,
        await this.pricingRepository.findForCourt(court.arena.id, court.id),
        court.arena.timezone,
        input.startTime,
        durationMin,
      ),
      notes: input.notes,
    });
  }

  /**
   * Pagamento SIMULADO. Num gateway real (Mercado Pago/Stripe) esta
   * confirmação viria do webhook do provedor, não do app do usuário.
   */
  async pay(userId: string, bookingId: string, now = new Date()): Promise<BookingView> {
    const booking = await this.findOwned(userId, bookingId);

    if (booking.status === 'CONFIRMED') return booking; // idempotente: pagar duas vezes não cobra de novo
    if (booking.status === 'CANCELLED' && booking.cancellationReason === CANCELLATION_REASONS.paymentExpired) {
      throw expiredError();
    }
    if (booking.status !== 'PENDING_PAYMENT') {
      throw new ConflictError('Esta reserva não está aguardando pagamento');
    }

    const confirmed = await this.bookingsRepository.confirmPayment(booking.id, userId, now, `sim_${randomUUID()}`);
    if (!confirmed) {
      // Perdeu a corrida para o prazo: garante que fique cancelada e avisa
      await this.bookingsRepository.expireOverdue(now, booking.court.id);
      throw expiredError();
    }

    return (await this.bookingsRepository.findById(booking.id))!;
  }

  /**
   * Cancelamento pelo próprio usuário.
   * - Aguardando pagamento: pode cancelar a qualquer momento (nada foi pago).
   * - Confirmada: só com pelo menos 24h de antecedência; o valor é estornado.
   */
  async cancel(userId: string, bookingId: string, now = new Date()): Promise<BookingView> {
    const booking = await this.findOwned(userId, bookingId);

    if (booking.type === 'CLASS' || booking.type === 'MAINTENANCE') {
      throw new ConflictError('Bloqueios de aula e de manutenção não podem ser cancelados por aqui');
    }
    if (booking.status === 'CANCELLED') throw new ConflictError('Esta reserva já está cancelada');
    if (booking.status !== 'PENDING_PAYMENT' && booking.status !== 'CONFIRMED') {
      throw new ConflictError('Esta reserva não pode mais ser cancelada');
    }
    if (booking.startTime <= now) throw new ConflictError('Não é possível cancelar uma reserva que já começou');

    if (booking.status === 'CONFIRMED' && !isWithinCancellationWindow(booking.startTime, now)) {
      throw new AppError(
        `Cancelamentos só são aceitos com pelo menos ${CANCELLATION_MIN_HOURS}h de antecedência.`,
        422,
        'CANCELLATION_WINDOW_CLOSED',
      );
    }

    const cancelled = await this.bookingsRepository.cancel(booking.id, {
      now,
      reason: CANCELLATION_REASONS.userCancelled,
      refund: booking.paymentStatus === 'PAID',
      expectedStatus: booking.status,
    });
    // A reserva mudou entre a leitura e a gravação (pagamento ou expiração simultâneos)
    if (!cancelled) throw new ConflictError('A reserva acabou de ser atualizada. Confira o status e tente novamente.');
    return cancelled;
  }

  async listMine(userId: string, scope: 'upcoming' | 'past', now = new Date()): Promise<BookingView[]> {
    // Nunca mostra "aguardando pagamento" para uma reserva que já venceu
    await this.bookingsRepository.expireOverdue(now);
    return this.bookingsRepository.findByUser(userId, scope, now);
  }

  /** Reserva do próprio usuário; a de outra pessoa responde 404 (não revela que existe) */
  private async findOwned(userId: string, bookingId: string) {
    const booking = await this.bookingsRepository.findById(bookingId);
    if (!booking || booking.userId !== userId) throw new NotFoundError('Reserva não encontrada');
    return booking;
  }
}
