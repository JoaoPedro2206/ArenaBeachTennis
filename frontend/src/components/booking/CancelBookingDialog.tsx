import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CANCELLATION_MIN_HOURS, cancelEligibility } from '@/lib/bookingPolicy';
import { formatInZone } from '@/lib/dates';
import { capitalizeFirst, formatPrice } from '@/lib/format';
import { ApiError } from '@/services/api';
import { bookingService } from '@/services/bookingService';
import type { Booking } from '@/types/booking';

interface CancelBookingDialogProps {
  booking: Booking;
  onClose: () => void;
  onCancelled: (booking: Booking) => void;
}

/** Confirmação de cancelamento, explicando prazo e reembolso antes de agir */
export function CancelBookingDialog({ booking, onClose, onCancelled }: CancelBookingDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibility = cancelEligibility(booking);
  const { date, time } = formatInZone(booking.startTime, booking.court.arena.timezone);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      onCancelled(await bookingService.cancel(booking.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cancelar. Tente novamente.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      title="Cancelar reserva?"
      description={`${booking.court.name} · ${capitalizeFirst(date)} às ${time}`}
    >
      {/* Política de cancelamento e reembolso */}
      <div className="space-y-3 rounded-lg bg-surface-muted p-4 text-sm">
        <p className="font-bold text-ink">Política de cancelamento</p>
        <ul className="space-y-2 text-ink-muted">
          <li className="flex gap-2">
            <span aria-hidden>•</span>
            {/* Texto num único <span>: num <li> flex, o <strong> viraria uma "coluna" separada */}
            <span>
              Reservas pagas podem ser canceladas até <strong className="text-ink">{CANCELLATION_MIN_HOURS}h antes</strong>{' '}
              do horário, com reembolso integral.
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden>•</span>
            <span>Reservas aguardando pagamento podem ser canceladas a qualquer momento, sem cobrança.</span>
          </li>
        </ul>
      </div>

      <div
        className={`mt-4 rounded-md px-4 py-3 text-sm font-semibold ${
          eligibility.allowed ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}
      >
        {eligibility.allowed
          ? eligibility.refund
            ? `Você receberá ${formatPrice(booking.totalPrice)} de volta.`
            : 'Nenhuma cobrança foi feita nesta reserva.'
          : eligibility.reason}
      </div>

      {error && (
        <p role="alert" className="mt-4 animate-fade-in rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-3">
        {eligibility.allowed && (
          <Button variant="destructive" size="lg" onClick={confirm} loading={submitting}>
            Sim, cancelar reserva
          </Button>
        )}
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Manter reserva
        </Button>
      </div>
    </Modal>
  );
}
