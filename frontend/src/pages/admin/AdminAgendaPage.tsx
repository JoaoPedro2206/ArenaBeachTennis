import { useState, type ReactNode } from 'react';
import { AgendaGrid, AgendaLegend } from '@/components/admin/AgendaGrid';
import { BlockDialog, CourtStatusDialog, EventDialog } from '@/components/admin/AgendaDialogs';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { addDays, dateParts } from '@/lib/dates';
import { capitalizeFirst, formatPrice } from '@/lib/format';
import { adminService } from '@/services/adminService';
import type { AgendaCourt, AgendaEvent, AgendaSlot } from '@/types/admin';

type Dialog =
  | { kind: 'block'; court: AgendaCourt; slot: AgendaSlot }
  | { kind: 'event'; court: AgendaCourt; event: AgendaEvent }
  | { kind: 'court'; court: AgendaCourt };

/** Minuto do dia de um instante no fuso da arena */
function minutesInZone(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

/** Agenda operacional: todas as quadras do dia, lado a lado */
export default function AdminAgendaPage() {
  const toast = useToast();
  // undefined = hoje (no fuso da arena, decidido pelo servidor)
  const [date, setDate] = useState<string | undefined>(undefined);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const agenda = useAsync((signal) => adminService.agenda(date, signal), [date]);
  const data = agenda.data;

  const shownDate = date ?? data?.today;
  const isToday = !!data && data.date === data.today;

  function done(message: string, warning?: string) {
    setDialog(null);
    toast.success(message);
    if (warning) toast.info(warning);
    agenda.reload();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Agenda da arena</p>
          <h1 className="mt-1 text-[28px] leading-tight font-extrabold text-ink sm:text-[32px]">
            {shownDate ? capitalizeFirst(dateParts(shownDate).long) : 'Agenda'}
          </h1>
        </div>
        {shownDate && data && (
          <div className="flex items-center gap-2">
            {!isToday && (
              <button
                type="button"
                onClick={() => setDate(undefined)}
                className="h-10 rounded-full bg-surface px-4 text-sm font-bold text-ink shadow-sm transition-transform active:scale-95"
              >
                Hoje
              </button>
            )}
            <div className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-sm">
              <DayArrow label="Dia anterior" onClick={() => setDate(addDays(shownDate, -1))}>
                <ChevronLeftIcon size={18} />
              </DayArrow>
              <input
                type="date"
                aria-label="Escolher data"
                value={shownDate}
                onChange={(e) => e.target.value && setDate(e.target.value === data.today ? undefined : e.target.value)}
                className="h-10 rounded-full bg-transparent px-2 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-primary"
              />
              <DayArrow label="Próximo dia" onClick={() => setDate(addDays(shownDate, 1))}>
                <ChevronRightIcon size={18} />
              </DayArrow>
            </div>
            <button
              type="button"
              onClick={agenda.reload}
              aria-label="Atualizar agenda"
              className="flex size-10 items-center justify-center rounded-full bg-surface text-lg text-ink shadow-sm transition-transform active:scale-95"
            >
              <span aria-hidden className={agenda.loading ? 'animate-spin' : ''}>
                ↻
              </span>
            </button>
          </div>
        )}
      </header>

      {agenda.error && !data ? (
        <div role="alert" className="rounded-xl bg-danger-soft px-6 py-10 text-center">
          <p className="font-bold text-ink">Não foi possível carregar a agenda</p>
          <p className="mt-1 text-sm text-danger">{agenda.error}</p>
          <button type="button" onClick={agenda.reload} className="mt-4 text-sm font-bold text-primary hover:underline">
            Tentar novamente
          </button>
        </div>
      ) : !data ? (
        <div className="space-y-4" aria-busy="true" aria-label="Carregando agenda">
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 flex-1 animate-pulse rounded-lg bg-surface-muted" />
            ))}
          </div>
          <div className="h-[520px] animate-pulse rounded-xl bg-surface-muted" />
        </div>
      ) : (
        <div className={`space-y-5 transition-opacity ${agenda.loading ? 'opacity-60' : ''}`} aria-busy={agenda.loading}>
          {/* Resumo do dia */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Summary label="Reservas" value={String(data.summary.bookings)} hint={data.summary.pendingPayments > 0 ? `${data.summary.pendingPayments} a pagar` : undefined} />
            <Summary label="Recebido" value={formatPrice(data.summary.paidRevenue)} />
            <Summary label="Horários livres" value={String(data.summary.freeSlots)} />
            <Summary label="Aulas · bloqueios" value={`${data.summary.classes} · ${data.summary.blocks}`} />
          </dl>

          <AgendaLegend />

          {data.courts.length === 0 ? (
            <p className="rounded-xl bg-surface-muted px-6 py-12 text-center text-sm text-ink-muted">Nenhuma quadra cadastrada nesta arena.</p>
          ) : (
            <AgendaGrid
              courts={data.courts}
              nowMin={isToday ? minutesInZone(data.now, data.arena.timezone) : null}
              onSlotClick={(court, slot) => setDialog({ kind: 'block', court, slot })}
              onEventClick={(court, event) => setDialog({ kind: 'event', court, event })}
              onCourtMenu={(court) => setDialog({ kind: 'court', court })}
            />
          )}
        </div>
      )}

      {dialog?.kind === 'block' && (
        <BlockDialog court={dialog.court} slot={dialog.slot} onClose={() => setDialog(null)} onDone={(m) => done(m)} />
      )}
      {dialog?.kind === 'event' && data && (
        <EventDialog
          court={dialog.court}
          event={dialog.event}
          timeZone={data.arena.timezone}
          now={data.now}
          onClose={() => setDialog(null)}
          onUnblocked={() => done('Bloqueio removido: o horário está livre para reserva')}
        />
      )}
      {dialog?.kind === 'court' && <CourtStatusDialog court={dialog.court} onClose={() => setDialog(null)} onDone={done} />}
    </div>
  );
}

function Summary({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-surface px-4 py-3 shadow-xs">
      <dt className="text-[11px] font-bold tracking-wider text-ink-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 text-xl font-extrabold text-ink tabular-nums">
        {value}
        {hint && <span className="ml-2 text-xs font-bold text-warning-ink">{hint}</span>}
      </dd>
    </div>
  );
}

function DayArrow({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-muted active:scale-95"
    >
      {children}
    </button>
  );
}
