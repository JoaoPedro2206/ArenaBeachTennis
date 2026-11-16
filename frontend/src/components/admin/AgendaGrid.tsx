import type { CSSProperties } from 'react';
import { WrenchIcon } from '@/components/icons';
import { minutesToHHmm } from '@/lib/adminFormat';
import { formatPriceShort } from '@/lib/format';
import type { AgendaCourt, AgendaEvent, AgendaSlot } from '@/types/admin';

/** Altura de 1 minuto na grade: 1 hora = 72px (cabe nome + horário de um slot de 60 min) */
const PX_PER_MIN = 1.2;
/** Respiro entre blocos consecutivos (encostados não se confundem) */
const GAP_PX = 3;

/** Listras diagonais: manutenção se distingue pela TEXTURA, não só pela cor (daltonismo/impressão) */
export const STRIPES: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(135deg, var(--surface-muted) 0 7px, var(--surface-sunken) 7px 14px)',
};

export const EVENT_STYLES = {
  paid: { box: 'bg-primary-soft border-primary', label: 'Reserva paga' },
  pending: { box: 'bg-warning-soft border-warning-ink', label: 'Aguardando pagamento' },
  class: { box: 'bg-accent-soft border-accent', label: 'Aula' },
  maintenance: { box: 'border-ink-subtle', label: 'Manutenção' },
} as const;

export function eventStyle(event: AgendaEvent): keyof typeof EVENT_STYLES {
  if (event.kind === 'CLASS') return 'class';
  if (event.kind === 'MAINTENANCE') return 'maintenance';
  return event.status === 'PENDING_PAYMENT' ? 'pending' : 'paid';
}

interface AgendaGridProps {
  courts: AgendaCourt[];
  /** Minuto atual no fuso da arena (null = o dia exibido não é hoje) */
  nowMin: number | null;
  onSlotClick: (court: AgendaCourt, slot: AgendaSlot) => void;
  onEventClick: (court: AgendaCourt, event: AgendaEvent) => void;
  onCourtMenu: (court: AgendaCourt) => void;
}

/**
 * Quadras lado a lado, eixo de horas à esquerda. Cada item é posicionado pelo
 * minuto exato (e não por linha de tabela), então quadras com slots de 60 e
 * 90 min e bloqueios de duração livre convivem na mesma régua.
 */
export function AgendaGrid({ courts, nowMin, onSlotClick, onEventClick, onCourtMenu }: AgendaGridProps) {
  const start = Math.floor(Math.min(...courts.map((c) => c.openMin)) / 60) * 60;
  const end = Math.ceil(Math.max(...courts.map((c) => c.closeMin)) / 60) * 60;
  const height = (end - start) * PX_PER_MIN;
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start + i * 60);
  const y = (minute: number) => (Math.min(Math.max(minute, start), end) - start) * PX_PER_MIN;

  return (
    // Rolagem horizontal no celular: cada quadra mantém largura legível
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="min-w-fit rounded-xl bg-surface shadow-sm">
        {/* Cabeçalho das quadras (gruda no topo ao rolar a página) */}
        <div className="sticky top-0 z-20 flex rounded-t-xl border-b border-surface-muted bg-surface">
          <div className="w-14 shrink-0" />
          {courts.map((court) => (
            <div key={court.id} className="flex min-w-[220px] flex-1 items-center justify-between gap-2 border-l border-surface-muted px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-extrabold text-ink">{court.name}</p>
                <p className="text-xs text-ink-subtle">
                  {minutesToHHmm(court.openMin)}–{minutesToHHmm(court.closeMin)} · slots de {court.slotDurationMin} min
                </p>
              </div>
              <button
                type="button"
                onClick={() => onCourtMenu(court)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  court.status === 'MAINTENANCE'
                    ? 'bg-warning-soft text-warning-ink hover:bg-warning-soft/70'
                    : 'bg-success-soft text-success hover:bg-success-soft/70'
                }`}
                aria-label={`${court.name}: ${court.status === 'MAINTENANCE' ? 'em manutenção' : 'ativa'}. Alterar status`}
              >
                {court.status === 'MAINTENANCE' ? 'Manutenção' : 'Ativa'} ▾
              </button>
            </div>
          ))}
        </div>

        <div className="relative flex">
          {/* Eixo de horas */}
          <div className="relative w-14 shrink-0" style={{ height }} aria-hidden>
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold text-ink-subtle tabular-nums first:translate-y-0"
                style={{ top: y(h) }}
              >
                {minutesToHHmm(h)}
              </span>
            ))}
          </div>

          {/* Linhas de hora (recessivas) atravessando todas as quadras */}
          <div className="pointer-events-none absolute inset-y-0 right-0 left-14" aria-hidden>
            {hours.map((h) => (
              <span key={h} className="absolute inset-x-0 h-px bg-ink/[0.06]" style={{ top: y(h) }} />
            ))}
          </div>

          {courts.map((court) => (
            <CourtColumn
              key={court.id}
              court={court}
              height={height}
              y={y}
              onSlotClick={onSlotClick}
              onEventClick={onEventClick}
            />
          ))}

          {/* Agora */}
          {nowMin !== null && nowMin >= start && nowMin <= end && (
            <div className="pointer-events-none absolute right-0 left-12 z-10 flex items-center" style={{ top: y(nowMin) }} aria-label={`Agora, ${minutesToHHmm(nowMin)}`}>
              <span className="size-2.5 -translate-y-[1px] rounded-full bg-danger" />
              <span className="h-0.5 flex-1 bg-danger" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CourtColumn({
  court,
  height,
  y,
  onSlotClick,
  onEventClick,
}: {
  court: AgendaCourt;
  height: number;
  y: (minute: number) => number;
  onSlotClick: AgendaGridProps['onSlotClick'];
  onEventClick: AgendaGridProps['onEventClick'];
}) {
  const inMaintenance = court.status === 'MAINTENANCE';
  const box = (startMin: number, endMin: number): CSSProperties => ({
    top: y(startMin) + GAP_PX / 2,
    height: Math.max(y(endMin) - y(startMin) - GAP_PX, 18),
  });

  return (
    <div className="relative min-w-[220px] flex-1 border-l border-surface-muted" style={{ height }}>
      {/* Fora do horário de funcionamento */}
      <div className="absolute inset-x-0 top-0 bg-surface-muted/50" style={{ height: y(court.openMin) }} aria-hidden />
      <div className="absolute inset-x-0 bottom-0 bg-surface-muted/50" style={{ top: y(court.closeMin) }} aria-hidden />

      {inMaintenance && (
        <div className="absolute inset-0 z-[1] flex items-start justify-center pt-6" style={{ ...STRIPES, opacity: 0.85 }}>
          <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-warning-ink shadow-sm">
            <WrenchIcon size={14} /> Quadra em manutenção
          </span>
        </div>
      )}

      {/* Horários livres */}
      {!inMaintenance &&
        court.slots.map((slot) => (
          <button
            key={slot.startTime}
            type="button"
            disabled={slot.past}
            onClick={() => onSlotClick(court, slot)}
            style={box(slot.startMin, slot.endMin)}
            aria-label={`${court.name}, ${slot.label}, livre${slot.past ? ' (já passou)' : ', bloquear para manutenção'}`}
            className="group absolute inset-x-1.5 flex items-center justify-between gap-2 rounded-md border border-dashed border-ink/15 px-2.5 text-left transition-all duration-150 hover:border-primary hover:bg-primary-soft/50 disabled:cursor-default disabled:opacity-40 disabled:hover:border-ink/15 disabled:hover:bg-transparent"
          >
            <span className="text-[13px] font-semibold text-ink-muted tabular-nums">{slot.label}</span>
            <span className="text-right text-[11px] text-ink-subtle tabular-nums">
              <span className="group-hover:hidden group-disabled:inline">{formatPriceShort(slot.price)}</span>
              <span className="hidden font-bold text-primary group-hover:inline group-disabled:hidden">+ Bloquear</span>
              {slot.priceRule && <span className="block text-[10px] font-bold text-accent-strong group-hover:hidden">{slot.priceRule}</span>}
            </span>
          </button>
        ))}

      {/* Reservas, aulas e bloqueios */}
      {court.events.map((event) => {
        const style = EVENT_STYLES[eventStyle(event)];
        const isMaintenance = event.kind === 'MAINTENANCE';
        const tall = y(event.endMin) - y(event.startMin) >= 60;
        return (
          <button
            key={event.id}
            type="button"
            onClick={() => onEventClick(court, event)}
            style={{ ...box(event.startMin, event.endMin), ...(isMaintenance ? STRIPES : {}) }}
            className={`absolute inset-x-1.5 z-[2] overflow-hidden rounded-md border-l-4 px-2.5 py-1.5 text-left shadow-xs transition-all duration-150 hover:-translate-y-px hover:shadow-md ${style.box}`}
            aria-label={`${style.label}: ${event.title}, ${event.timeLabel}`}
          >
            <span className="flex items-center gap-1 truncate text-[13px] leading-tight font-bold text-ink">
              {isMaintenance && <WrenchIcon size={13} className="shrink-0" />}
              <span className="truncate">{event.title}</span>
            </span>
            <span className="block truncate text-[11px] leading-snug text-ink-muted tabular-nums">
              {event.timeLabel}
              {event.kind === 'BOOKING' && event.status === 'PENDING_PAYMENT' && ' · a pagar'}
            </span>
            {tall && event.subtitle && <span className="mt-0.5 block truncate text-[11px] text-ink-muted">{event.subtitle}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Legenda: identidade de cada tipo de bloco nunca depende só da cor */
export function AgendaLegend() {
  const items: Array<{ key: keyof typeof EVENT_STYLES | 'free'; label: string }> = [
    { key: 'paid', label: EVENT_STYLES.paid.label },
    { key: 'pending', label: EVENT_STYLES.pending.label },
    { key: 'class', label: EVENT_STYLES.class.label },
    { key: 'maintenance', label: EVENT_STYLES.maintenance.label },
    { key: 'free', label: 'Livre (toque para bloquear)' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-ink-muted" aria-label="Legenda da agenda">
      {items.map(({ key, label }) => (
        <li key={key} className="flex items-center gap-2">
          <span
            aria-hidden
            className={`size-3.5 rounded-[4px] ${
              key === 'free' ? 'border border-dashed border-ink/30' : `border-l-[3px] ${EVENT_STYLES[key].box}`
            }`}
            style={key === 'maintenance' ? STRIPES : undefined}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}
