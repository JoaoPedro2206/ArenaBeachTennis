import type { Court } from '@/types/booking';
import { formatPriceShort } from '@/lib/format';

interface CourtSelectorProps {
  courts: Court[];
  value: string | null;
  onChange: (courtId: string) => void;
}

/** Cartões horizontais para escolher a quadra (nome + preço/hora + tipo) */
export function CourtSelector({ courts, value, onChange }: CourtSelectorProps) {
  if (courts.length === 0) {
    return (
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-hidden px-4 py-2 sm:mx-0 sm:px-0" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[72px] w-44 shrink-0 animate-pulse rounded-lg bg-surface-muted" />
        ))}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Escolha a quadra"
      className="scrollbar-none -mx-4 -my-2 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 py-4 sm:mx-0 sm:scroll-px-0 sm:px-0"
    >
      {courts.map((court) => {
        const selected = court.id === value;
        const inMaintenance = court.status === 'MAINTENANCE';
        return (
          <button
            key={court.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(court.id)}
            className={`flex shrink-0 snap-start flex-col items-start rounded-lg px-4 py-3 text-left transition-all duration-200 ease-out active:scale-[0.97] ${
              selected ? 'bg-ink text-white shadow-md' : 'bg-surface text-ink shadow-xs hover:-translate-y-0.5 hover:shadow-sm'
            }`}
          >
            <span className="text-[15px] font-bold whitespace-nowrap">{court.name}</span>
            <span className={`mt-0.5 text-xs font-medium whitespace-nowrap ${selected ? 'text-white/70' : 'text-ink-subtle'}`}>
              {inMaintenance ? (
                <span className={selected ? 'text-cta' : 'text-accent-strong'}>Em manutenção</span>
              ) : (
                <>
                  {formatPriceShort(court.pricePerHour)}/h · {court.isCovered ? 'Coberta' : 'Ao ar livre'}
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
