import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { WrenchIcon } from '@/components/icons';
import { minutesToHHmm, whatsappLink } from '@/lib/adminFormat';
import { formatInZone } from '@/lib/dates';
import { formatPrice } from '@/lib/format';
import { maskPhone } from '@/lib/profileForm';
import { ApiError } from '@/services/api';
import { adminService } from '@/services/adminService';
import type { AgendaCourt, AgendaEvent, AgendaSlot } from '@/types/admin';
import { EVENT_STYLES, STRIPES, eventStyle } from './AgendaGrid';

const REASON_SUGGESTIONS = ['Manutenção da areia', 'Troca da rede', 'Evento da arena', 'Chuva'];

type BlockSpan = 'slot' | 'untilClose' | 'wholeDay';

/** ISO de um minuto local do mesmo dia, a partir de um slot conhecido (evita reimplementar fuso no app) */
function shiftIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

// ---------------------------------------------------------------- bloquear

export function BlockDialog({
  court,
  slot,
  onClose,
  onDone,
}: {
  court: AgendaCourt;
  slot: AgendaSlot;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [span, setSpan] = useState<BlockSpan>('slot');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; conflicts: string[] } | null>(null);

  const ranges: Record<BlockSpan, { label: string; start: string; end: string; startMin: number; endMin: number }> = {
    slot: { label: 'Só este horário', start: slot.startTime, end: slot.endTime, startMin: slot.startMin, endMin: slot.endMin },
    untilClose: {
      label: 'Até o fim do expediente',
      start: slot.startTime,
      end: shiftIso(slot.endTime, court.closeMin - slot.endMin),
      startMin: slot.startMin,
      endMin: court.closeMin,
    },
    wholeDay: {
      label: 'O dia inteiro',
      start: shiftIso(slot.startTime, court.openMin - slot.startMin),
      end: shiftIso(slot.endTime, court.closeMin - slot.endMin),
      startMin: court.openMin,
      endMin: court.closeMin,
    },
  };
  const range = ranges[span];

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      await adminService.block({ courtId: court.id, startTime: range.start, endTime: range.end, reason: reason.trim() || undefined });
      onDone(`${court.name} bloqueada das ${minutesToHHmm(range.startMin)} às ${minutesToHHmm(range.endMin)}`);
    } catch (err) {
      const conflicts = err instanceof ApiError ? ((err.details as { conflicts?: string[] } | undefined)?.conflicts ?? []) : [];
      setError({ message: err instanceof ApiError ? err.message : 'Não foi possível bloquear. Tente novamente.', conflicts });
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      title="Bloquear para manutenção"
      description={`${court.name} · ninguém consegue reservar o período bloqueado`}
    >
      <fieldset disabled={submitting} className="space-y-5">
        <div>
          <legend className="mb-2 text-sm font-semibold text-ink">Período</legend>
          <div className="grid gap-2" role="radiogroup">
            {(Object.keys(ranges) as BlockSpan[]).map((key) => {
              const r = ranges[key];
              const selected = span === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSpan(key)}
                  className={`flex items-center justify-between rounded-md px-4 py-3 text-left transition-all ${
                    selected ? 'bg-primary-soft ring-2 ring-primary' : 'bg-surface-muted hover:bg-surface-sunken'
                  }`}
                >
                  <span className="text-[15px] font-bold text-ink">{r.label}</span>
                  <span className="text-sm text-ink-muted tabular-nums">
                    {minutesToHHmm(r.startMin)}–{minutesToHHmm(r.endMin)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="block-reason" className="mb-2 block text-sm font-semibold text-ink">
            Motivo <span className="font-normal text-ink-subtle">(opcional)</span>
          </label>
          <input
            id="block-reason"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: troca da rede"
            className="h-12 w-full rounded-md bg-surface-muted px-4 text-base text-ink outline-none transition-all placeholder:text-ink-subtle focus:bg-surface focus:ring-2 focus:ring-primary"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {REASON_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setReason(s)}
                className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      {error && (
        <div role="alert" className="mt-5 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          <p className="font-semibold">{error.message}</p>
          {error.conflicts.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-[13px] tabular-nums">
              {error.conflicts.map((c) => (
                <li key={c}>{`${c.slice(8, 10)}/${c.slice(5, 7)} ${c.slice(11)}`}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-3">
        <Button variant="primary" size="lg" onClick={confirm} loading={submitting}>
          <WrenchIcon size={18} /> Bloquear {minutesToHHmm(range.startMin)}–{minutesToHHmm(range.endMin)}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Voltar
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- detalhes

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Aguardando pagamento',
  CONFIRMED: 'Confirmada',
  COMPLETED: 'Realizada',
  NO_SHOW: 'Não compareceu',
};

export function EventDialog({
  court,
  event,
  timeZone,
  now,
  onClose,
  onUnblocked,
}: {
  court: AgendaCourt;
  event: AgendaEvent;
  timeZone: string;
  now: string;
  onClose: () => void;
  onUnblocked: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const style = EVENT_STYLES[eventStyle(event)];
  const isMaintenance = event.kind === 'MAINTENANCE';
  const canUnblock = isMaintenance && new Date(event.endTime) > new Date(now);
  const startDay = formatInZone(event.startTime, timeZone).date;
  const endDay = formatInZone(event.endTime, timeZone).date;

  async function unblock() {
    setSubmitting(true);
    setError(null);
    try {
      await adminService.unblock(event.id);
      onUnblocked();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível remover o bloqueio.');
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} dismissible={!submitting} title={event.title} description={`${court.name} · ${event.timeLabel}`}>
      <div
        className={`rounded-lg border-l-4 p-4 ${style.box}`}
        style={isMaintenance ? STRIPES : undefined}
      >
        <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">{style.label}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          {startDay !== endDay && <Item label="Período" value={`${startDay} → ${endDay}`} wide />}
          {event.kind === 'BOOKING' && (
            <>
              <Item label="Situação" value={STATUS_LABEL[event.status] ?? event.status} />
              <Item label="Valor" value={formatPrice(event.totalPrice)} />
              {event.status === 'PENDING_PAYMENT' && event.expiresAt && (
                <Item label="Paga até" value={formatInZone(event.expiresAt, timeZone).time} />
              )}
            </>
          )}
          {event.subtitle && <Item label={event.kind === 'CLASS' ? 'Professor · turma' : isMaintenance ? 'Motivo' : 'Tipo'} value={event.subtitle} wide />}
          {event.notes && <Item label="Observação" value={event.notes} wide />}
        </dl>
      </div>

      {event.customer?.phone && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-ink">{event.customer.name}</p>
            <p className="text-sm text-ink-muted tabular-nums">{maskPhone(event.customer.phone)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <a
              href={`tel:${event.customer.phone}`}
              className="flex h-9 items-center rounded-full bg-surface px-3 text-xs font-bold text-ink shadow-xs transition-transform active:scale-95"
            >
              Ligar
            </a>
            <a
              href={whatsappLink(event.customer.phone)}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center rounded-full bg-success px-3 text-xs font-bold text-white transition-transform active:scale-95"
            >
              WhatsApp
            </a>
          </div>
        </div>
      )}
      {event.customer && !event.customer.phone && (
        <p className="mt-4 text-sm text-ink-subtle">{event.customer.name} não cadastrou telefone.</p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-3">
        {canUnblock && (
          <Button variant="destructive" size="lg" onClick={unblock} loading={submitting}>
            Remover bloqueio
          </Button>
        )}
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Fechar
        </Button>
      </div>
    </Modal>
  );
}

function Item({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-md bg-surface/80 px-3 py-2 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-[11px] font-bold tracking-wider text-ink-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 font-bold text-ink">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------- status da quadra

export function CourtStatusDialog({
  court,
  onClose,
  onDone,
}: {
  court: AgendaCourt;
  onClose: () => void;
  onDone: (message: string, warning?: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toMaintenance = court.status !== 'MAINTENANCE';

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const { upcomingBookings } = await adminService.setCourtStatus(court.id, toMaintenance ? 'MAINTENANCE' : 'ACTIVE');
      onDone(
        toMaintenance ? `${court.name} em manutenção` : `${court.name} reativada`,
        upcomingBookings > 0
          ? `Atenção: ${upcomingBookings} ${upcomingBookings === 1 ? 'reserva futura continua marcada' : 'reservas futuras continuam marcadas'} nesta quadra. Avise os clientes.`
          : undefined,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível alterar a quadra.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      title={toMaintenance ? `Colocar ${court.name} em manutenção?` : `Reativar ${court.name}?`}
      description={
        toMaintenance
          ? 'Nenhum horário desta quadra poderá ser reservado até você reativá-la. Reservas já feitas não são canceladas.'
          : 'Os horários livres voltam a aparecer para reserva imediatamente.'
      }
    >
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="grid gap-3">
        <Button variant={toMaintenance ? 'destructive' : 'primary'} size="lg" onClick={confirm} loading={submitting}>
          {toMaintenance ? 'Sim, colocar em manutenção' : 'Sim, reativar quadra'}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Voltar
        </Button>
      </div>
    </Modal>
  );
}
