import type { Booking } from '@/types/booking';

/**
 * Espelho das regras do backend (modules/bookings/booking-policy.ts) — usado
 * só para orientar o usuário na tela. Quem decide de verdade é a API.
 */
export const PAYMENT_WINDOW_MIN = 15;
export const CANCELLATION_MIN_HOURS = 24;

export type CancelEligibility =
  | { allowed: true; refund: boolean }
  | { allowed: false; reason: string };

export function cancelEligibility(booking: Booking, now = Date.now()): CancelEligibility {
  if (booking.status === 'PENDING_PAYMENT') return { allowed: true, refund: false };
  if (booking.status !== 'CONFIRMED') return { allowed: false, reason: 'Esta reserva não pode ser cancelada.' };

  const hoursUntilStart = (new Date(booking.startTime).getTime() - now) / 3_600_000;
  if (hoursUntilStart < CANCELLATION_MIN_HOURS) {
    return { allowed: false, reason: `Cancelamento só até ${CANCELLATION_MIN_HOURS}h antes do jogo.` };
  }
  return { allowed: true, refund: booking.paymentStatus === 'PAID' };
}
