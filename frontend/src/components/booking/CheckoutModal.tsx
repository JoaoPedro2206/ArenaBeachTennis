import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CalendarIcon, CheckIcon } from '@/components/icons';
import { formatMmSs, useCountdown } from '@/hooks/useCountdown';
import { PAYMENT_WINDOW_MIN } from '@/lib/bookingPolicy';
import { dateParts } from '@/lib/dates';
import { capitalizeFirst, formatPrice } from '@/lib/format';
import { PATHS } from '@/routes/paths';
import { ApiError } from '@/services/api';
import { bookingService } from '@/services/bookingService';
import type { Booking, Court, TimeSlot } from '@/types/booking';

type Step =
  | { name: 'review' }
  | { name: 'creating' }
  | { name: 'checkout'; booking: Booking; deadline: number; error?: string }
  | { name: 'paying'; booking: Booking; deadline: number }
  | { name: 'cancelling'; booking: Booking; deadline: number }
  | { name: 'success'; booking: Booking }
  | { name: 'error'; message: string };

type PaymentMethod = 'PIX' | 'CARD';

interface CheckoutModalProps {
  open: boolean;
  court: Court;
  slot: TimeSlot;
  date: string;
  /** Fechou (reservou, cancelou, desistiu ou deu erro) — a página atualiza a grade */
  onClose: () => void;
  /** O prazo de pagamento acabou: a página avisa "Reserva expirada" */
  onExpired: () => void;
}

/**
 * Checkout da reserva: revisar -> reservar (segura o horário) -> pagar em até
 * 15 min -> confirmado. O pagamento é SIMULADO (POST /bookings/:id/pay).
 */
export function CheckoutModal({ open, court, slot, date, onClose, onExpired }: CheckoutModalProps) {
  const [step, setStep] = useState<Step>({ name: 'review' });
  const [method, setMethod] = useState<PaymentMethod>('PIX');

  const deadline = 'deadline' in step ? step.deadline : null;
  // Com o pagamento em voo, quem decide é a resposta do servidor: o relógio do
  // celular pode zerar um instante antes de chegar um "pago" — e a tela não
  // pode dizer "expirada" para uma reserva que foi cobrada.
  const remaining = useCountdown(deadline, () => {
    if (step.name !== 'paying') onExpired();
  });

  const endLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: court.arena.timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(slot.endTime));
  const when = `${capitalizeFirst(dateParts(date).long)}, ${slot.label}–${endLabel}`;

  async function reserve() {
    setStep({ name: 'creating' });
    try {
      const booking = await bookingService.createBooking({ courtId: court.id, startTime: slot.startTime });
      // Prazo relativo ao que o servidor concedeu: imune a relógio errado no celular
      const windowMs = booking.expiresAt
        ? new Date(booking.expiresAt).getTime() - new Date(booking.createdAt).getTime()
        : PAYMENT_WINDOW_MIN * 60_000;
      setStep({ name: 'checkout', booking, deadline: Date.now() + windowMs });
    } catch (err) {
      setStep({ name: 'error', message: err instanceof ApiError ? err.message : 'Não foi possível reservar.' });
    }
  }

  async function pay() {
    if (step.name !== 'checkout') return;
    const { booking, deadline } = step;
    setStep({ name: 'paying', booking, deadline });
    try {
      const paid = await bookingService.pay(booking.id);
      setStep({ name: 'success', booking: paid });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'BOOKING_EXPIRED') return onExpired();
      // O prazo zerou durante a tentativa (o timer não dispara de novo): encerra aqui
      if (Date.now() >= deadline) return onExpired();
      setStep({
        name: 'checkout',
        booking,
        deadline,
        error: err instanceof ApiError ? err.message : 'Pagamento não aprovado. Tente novamente.',
      });
    }
  }

  /** Desistir no checkout libera a quadra na hora (sem esperar o prazo) */
  async function giveUp() {
    if (step.name !== 'checkout') return onClose();
    setStep({ name: 'cancelling', booking: step.booking, deadline: step.deadline });
    await bookingService.cancel(step.booking.id).catch(() => undefined); // se falhar, o prazo expira sozinho
    onClose();
  }

  // ---------------------------------------------------------------- sucesso
  if (step.name === 'success') {
    return (
      <Modal open={open} onClose={onClose} title="Pagamento aprovado!" description="Sua quadra está garantida. 🏖️">
        <div className="flex flex-col items-center text-center">
          <span className="-mt-2 mb-6 flex size-20 animate-pop items-center justify-center rounded-full bg-cta text-cta-ink shadow-cta">
            <CheckIcon size={40} strokeWidth={3} />
          </span>
          <p className="text-[15px] text-ink-muted">
            <strong className="text-ink">{court.name}</strong> · {when}
          </p>
          <p className="mt-2 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success">
            Confirmada · {formatPrice(step.booking.totalPrice)} pago
          </p>
        </div>
        <div className="mt-8 grid gap-3">
          <Link
            to={PATHS.profile}
            className="inline-flex h-12 items-center justify-center rounded-md bg-ink text-[15px] font-bold text-white transition-all hover:-translate-y-0.5 active:scale-[0.97]"
          >
            Ver minhas reservas
          </Link>
          <Button variant="ghost" onClick={onClose}>
            Reservar outro horário
          </Button>
        </div>
      </Modal>
    );
  }

  // ---------------------------------------------------------------- erro ao reservar
  if (step.name === 'error') {
    return (
      <Modal open={open} onClose={onClose} title="Não deu certo" description={step.message}>
        <Button variant="primary" size="lg" onClick={onClose}>
          Escolher outro horário
        </Button>
      </Modal>
    );
  }

  // ---------------------------------------------------------------- checkout (pagamento)
  if (step.name === 'checkout' || step.name === 'paying' || step.name === 'cancelling') {
    const urgent = remaining < 2 * 60_000;
    const progress = Math.min(remaining / (PAYMENT_WINDOW_MIN * 60_000), 1);
    const busy = step.name !== 'checkout';

    return (
      <Modal
        open={open}
        onClose={giveUp}
        dismissible={false}
        title="Pagamento"
        description="O horário fica reservado para você enquanto o tempo corre."
      >
        {/* Timer regressivo */}
        <div
          className={`flex items-center justify-between rounded-lg px-5 py-4 transition-colors ${
            urgent ? 'bg-danger-soft text-danger' : 'bg-ink text-white'
          }`}
          role="timer"
          aria-live="off"
          aria-label={`Tempo restante para pagar: ${formatMmSs(remaining)}`}
        >
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider ${urgent ? '' : 'text-white/60'}`}>
              {urgent ? 'Últimos minutos' : 'Pague em até'}
            </p>
            <p className="text-[34px] leading-none font-extrabold tabular-nums tracking-tight">{formatMmSs(remaining)}</p>
          </div>
          <svg viewBox="0 0 36 36" className="size-12 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" className={urgent ? 'stroke-danger/20' : 'stroke-white/15'} />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${progress * 94.25} 94.25`}
              className={`transition-[stroke-dasharray] duration-300 ${urgent ? 'stroke-danger' : 'stroke-cta'}`}
            />
          </svg>
        </div>

        <div className="mt-4 rounded-lg bg-surface-muted p-4">
          <p className="font-extrabold text-ink">{court.name}</p>
          <p className="text-sm text-ink-muted">{when}</p>
        </div>

        {/* Forma de pagamento (simulada) */}
        <fieldset className="mt-6" disabled={busy}>
          <legend className="mb-3 text-sm font-bold text-ink">Forma de pagamento</legend>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['PIX', 'Pix', 'Aprovação na hora'],
                ['CARD', 'Cartão', 'Crédito ou débito'],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-md px-4 py-3 transition-all ${
                  method === value ? 'bg-primary-soft ring-2 ring-primary' : 'bg-surface-muted hover:bg-surface-sunken'
                }`}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={value}
                  checked={method === value}
                  onChange={() => setMethod(value)}
                  className="sr-only"
                />
                <span className="block text-[15px] font-bold text-ink">{label}</span>
                <span className="block text-xs text-ink-muted">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {step.name === 'checkout' && step.error && (
          <p role="alert" className="mt-4 animate-fade-in rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {step.error}
          </p>
        )}

        <div className="mt-6 grid gap-3">
          <Button size="lg" onClick={pay} loading={step.name === 'paying'} disabled={busy}>
            {step.name === 'paying' ? 'Processando…' : `Pagar ${formatPrice(step.booking.totalPrice)}`}
          </Button>
          <Button variant="ghost" onClick={giveUp} loading={step.name === 'cancelling'} disabled={busy}>
            Desistir e liberar o horário
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-ink-subtle">Ambiente de demonstração: nenhuma cobrança real é feita.</p>
      </Modal>
    );
  }

  // ---------------------------------------------------------------- revisão
  const creating = step.name === 'creating';
  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!creating}
      title="Confirmar reserva"
      description="Confira os detalhes antes de garantir sua quadra."
    >
      <div className="rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-ink text-cta">
            <CalendarIcon size={22} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold text-ink">{court.name}</p>
            <p className="truncate text-sm text-ink-muted">{court.arena.name}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <SummaryItem label="Data" value={capitalizeFirst(dateParts(date).long)} wide />
          <SummaryItem label="Horário" value={`${slot.label} – ${endLabel}`} />
          <SummaryItem label="Total" value={formatPrice(slot.price)} />
        </dl>
      </div>

      <p className="mt-5 flex items-start gap-2 rounded-md bg-warning-soft px-4 py-3 text-sm text-warning-ink">
        <span aria-hidden>⏱️</span>
        Ao continuar, o horário fica reservado por {PAYMENT_WINDOW_MIN} minutos para você concluir o pagamento.
      </p>

      <div className="mt-6 grid gap-3">
        <Button size="lg" onClick={reserve} loading={creating}>
          {creating ? 'Reservando…' : 'Reservar e pagar'}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={creating}>
          Voltar
        </Button>
      </div>
    </Modal>
  );
}

function SummaryItem({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-md bg-surface px-3 py-2.5 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-[11px] font-bold tracking-wider text-ink-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-bold text-ink">{value}</dd>
    </div>
  );
}
