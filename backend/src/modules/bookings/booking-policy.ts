/**
 * Regras de negócio do ciclo de vida da reserva, num único lugar.
 * Valores que o produto pode querer mudar ficam aqui, não espalhados no código.
 */

/** Tempo que o usuário tem para pagar depois de reservar */
export const PAYMENT_WINDOW_MIN = 15;

/** Antecedência mínima para cancelar uma reserva já paga */
export const CANCELLATION_MIN_HOURS = 24;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function paymentDeadline(from: Date): Date {
  return new Date(from.getTime() + PAYMENT_WINDOW_MIN * MINUTE);
}

/** true se ainda dá para cancelar uma reserva CONFIRMED que começa em `startTime` */
export function isWithinCancellationWindow(startTime: Date, now = new Date()): boolean {
  return startTime.getTime() - now.getTime() >= CANCELLATION_MIN_HOURS * HOUR;
}

/** Motivos gravados em bookings.cancellation_reason */
export const CANCELLATION_REASONS = {
  paymentExpired: 'PAYMENT_EXPIRED',
  userCancelled: 'USER_CANCELLED',
  /** Admin removeu um bloqueio de manutenção */
  adminUnblocked: 'ADMIN_UNBLOCKED',
} as const;
