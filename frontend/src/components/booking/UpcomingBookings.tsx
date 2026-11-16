import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { formatInZone } from '@/lib/dates';
import { capitalizeFirst, formatPrice } from '@/lib/format';
import { cancelEligibility } from '@/lib/bookingPolicy';
import { PATHS } from '@/routes/paths';
import { bookingService } from '@/services/bookingService';
import type { Booking, BookingStatus } from '@/types/booking';
import { CancelBookingDialog } from './CancelBookingDialog';

// Rótulos curtos: o selo divide a linha com nome da quadra e preço no celular
const STATUS: Record<BookingStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: { label: 'A pagar', className: 'bg-accent-soft text-accent-strong' },
  CONFIRMED: { label: 'Confirmada', className: 'bg-success-soft text-success' },
  CANCELLED: { label: 'Cancelada', className: 'bg-surface-muted text-ink-subtle' },
  COMPLETED: { label: 'Realizada', className: 'bg-surface-muted text-ink-muted' },
  NO_SHOW: { label: 'Não compareceu', className: 'bg-danger-soft text-danger' },
};

interface UpcomingBookingsProps {
  limit?: number;
  /** Mostra o botão "Cancelar reserva" em cada card (tela de Perfil) */
  cancellable?: boolean;
}

/** Próximas reservas do usuário logado (GET /bookings/me) */
export function UpcomingBookings({ limit = 5, cancellable = false }: UpcomingBookingsProps) {
  const { data, loading, error, reload } = useAsync((signal) => bookingService.listMine('upcoming', signal), []);
  const [toCancel, setToCancel] = useState<Booking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <ul className="space-y-3" aria-busy="true" aria-label="Carregando reservas">
        {[0, 1].map((i) => (
          <li key={i} className="h-[76px] animate-pulse rounded-lg bg-surface-muted" />
        ))}
      </ul>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg bg-danger-soft p-4 text-sm font-medium text-danger">
        {error}{' '}
        <button type="button" onClick={reload} className="font-bold text-primary hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  // "Próximos" = ainda vão acontecer: canceladas e já jogadas (COMPLETED) ficam de fora
  const bookings = (data ?? [])
    .filter((b) => b.status === 'PENDING_PAYMENT' || b.status === 'CONFIRMED')
    .slice(0, limit);

  function handleCancelled(booking: Booking) {
    setToCancel(null);
    setNotice(
      booking.paymentStatus === 'REFUNDED'
        ? `Reserva cancelada. ${formatPrice(booking.totalPrice)} serão estornados.`
        : 'Reserva cancelada. O horário foi liberado.',
    );
    reload();
  }

  return (
    <>
      {notice && (
        <p role="status" className="mb-3 animate-rise rounded-md bg-success-soft px-4 py-3 text-sm font-semibold text-success">
          {notice}
        </p>
      )}

      {bookings.length === 0 ? (
        <div className="rounded-lg bg-surface-muted px-6 py-10 text-center">
          <p className="text-3xl" aria-hidden>
            🎾
          </p>
          <p className="mt-3 font-bold text-ink">Nenhum jogo marcado</p>
          <p className="mt-1 text-sm text-ink-muted">Que tal garantir sua quadra para esta semana?</p>
          <Link
            to={PATHS.booking}
            className="mt-4 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-95"
          >
            Reservar agora
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking, index) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              index={index}
              onCancel={cancellable ? () => setToCancel(booking) : undefined}
            />
          ))}
        </ul>
      )}

      {toCancel && (
        <CancelBookingDialog booking={toCancel} onClose={() => setToCancel(null)} onCancelled={handleCancelled} />
      )}
    </>
  );
}

function BookingRow({ booking, index, onCancel }: { booking: Booking; index: number; onCancel?: () => void }) {
  const tz = booking.court.arena.timezone;
  const { date, time } = formatInZone(booking.startTime, tz);
  // Status novo/desconhecido vindo da API não pode derrubar a tela inteira
  const status = STATUS[booking.status] ?? { label: booking.status, className: 'bg-surface-muted text-ink-muted' };
  const eligibility = cancelEligibility(booking);
  const payUntil = booking.status === 'PENDING_PAYMENT' && booking.expiresAt ? formatInZone(booking.expiresAt, tz).time : null;

  return (
    <li className="animate-rise rounded-lg bg-surface p-3 pr-4 shadow-sm" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-primary-soft text-primary-strong">
          <span className="text-[15px] leading-none font-extrabold tabular-nums">{time}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-ink">{booking.court.name}</p>
          <p className="mt-0.5 truncate text-[13px] text-ink-muted">
            {capitalizeFirst(date)} · {formatPrice(booking.totalPrice)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
      </div>

      {(payUntil || onCancel) && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-surface-muted pt-3 text-[13px]">
          <span className="text-ink-muted">
            {payUntil ? (
              <>
                Pague até <strong className="text-accent-strong">{payUntil}</strong> ou o horário é liberado
              </>
            ) : !eligibility.allowed ? (
              eligibility.reason
            ) : null}
          </span>
          {onCancel && eligibility.allowed && (
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 rounded-full px-3 py-1.5 font-bold text-danger transition-colors hover:bg-danger-soft active:scale-95"
            >
              Cancelar reserva
            </button>
          )}
        </div>
      )}
    </li>
  );
}
