import type { ComponentType } from 'react';
import { MoonIcon, SunIcon, SunsetIcon } from '@/components/icons';
import { formatPriceShort } from '@/lib/format';
import type { TimeSlot } from '@/types/booking';

interface TimeSlotGridProps {
  slots: TimeSlot[];
  /** startTime do slot selecionado */
  selected: string | null;
  onSelect: (slot: TimeSlot) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

interface Period {
  id: string;
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** hora local de início (inclusiva) e fim (exclusiva) */
  from: number;
  to: number;
}

const PERIODS: Period[] = [
  { id: 'morning', title: 'Manhã', icon: SunIcon, from: 0, to: 12 },
  { id: 'afternoon', title: 'Tarde', icon: SunsetIcon, from: 12, to: 18 },
  { id: 'evening', title: 'Noite', icon: MoonIcon, from: 18, to: 24 },
];

const hourOf = (slot: TimeSlot) => Number(slot.label.slice(0, 2));

/**
 * Grade de horários agrupada por período do dia.
 * Componente "burro": recebe os slots prontos e só avisa qual foi tocado —
 * buscar dados e reservar é responsabilidade da página.
 */
export function TimeSlotGrid({ slots: allSlots, selected, onSelect, loading, error, onRetry }: TimeSlotGridProps) {
  if (loading) return <TimeSlotGridSkeleton />;

  if (error) {
    return (
      <div role="alert" className="rounded-lg bg-danger-soft p-6 text-center">
        <p className="text-sm font-medium text-danger">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-3 text-sm font-bold text-primary hover:underline">
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  // Horários que já começaram não são "ocupados" — simplesmente não aparecem
  const now = Date.now();
  const slots = allSlots.filter((s) => new Date(s.startTime).getTime() > now);
  const freeCount = slots.filter((s) => s.available).length;

  if (freeCount === 0) {
    return (
      <div className="rounded-lg bg-surface-muted px-6 py-12 text-center">
        <p className="text-4xl" aria-hidden>
          🏝️
        </p>
        <p className="mt-4 text-base font-bold text-ink">Nenhum horário livre neste dia</p>
        <p className="mt-1 text-sm text-ink-muted">Tente outra data ou outra quadra.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {PERIODS.map(({ id, title, icon: Icon, from, to }) => {
        const periodSlots = slots.filter((s) => hourOf(s) >= from && hourOf(s) < to);
        if (periodSlots.length === 0) return null;
        const free = periodSlots.filter((s) => s.available).length;

        return (
          <section key={id} aria-labelledby={`period-${id}`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 id={`period-${id}`} className="flex items-center gap-2 text-[15px] font-bold text-ink">
                <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon size={16} />
                </span>
                {title}
              </h3>
              <span className="text-xs font-medium text-ink-subtle">
                {free} {free === 1 ? 'livre' : 'livres'}
              </span>
            </div>

            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {periodSlots.map((slot) => (
                <li key={slot.startTime}>
                  <SlotButton slot={slot} selected={slot.startTime === selected} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SlotButton({ slot, selected, onSelect }: { slot: TimeSlot; selected: boolean; onSelect: (s: TimeSlot) => void }) {
  const base =
    'flex h-[68px] w-full flex-col items-center justify-center gap-0.5 rounded-md transition-all duration-200 ease-out';

  if (!slot.available) {
    const isClass = slot.blockedBy === 'CLASS';
    const reason = isClass ? 'Aula' : slot.blockedBy === 'MAINTENANCE' ? 'Manutenção' : 'Ocupado';
    return (
      <button
        type="button"
        disabled
        aria-label={`${slot.label}, ${reason.toLowerCase()}`}
        className={`${base} cursor-not-allowed ${isClass ? 'bg-accent-soft/70 text-accent-strong/70' : 'bg-surface-muted/70 text-ink-subtle'}`}
      >
        <span className="text-[15px] font-semibold line-through decoration-1">{slot.label}</span>
        <span className="text-[11px] font-medium">{reason}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${slot.label}, ${formatPriceShort(slot.price)}`}
      onClick={() => onSelect(slot)}
      className={`${base} active:scale-[0.96] ${
        selected
          ? 'bg-primary text-white shadow-primary -translate-y-0.5'
          : 'bg-surface text-ink shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-primary/25'
      }`}
    >
      <span className="text-[17px] font-extrabold tracking-tight tabular-nums">{slot.label}</span>
      <span className={`text-xs font-semibold ${selected ? 'text-white/80' : 'text-ink-subtle'}`}>
        {formatPriceShort(slot.price)}
      </span>
    </button>
  );
}

function TimeSlotGridSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando horários">
      {[0, 1].map((group) => (
        <div key={group}>
          <div className="mb-3 h-7 w-24 animate-pulse rounded-full bg-surface-sunken" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
