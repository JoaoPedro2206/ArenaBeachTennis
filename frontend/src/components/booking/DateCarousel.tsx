import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { addDays, dateParts, todayIn } from '@/lib/dates';

interface DateCarouselProps {
  /** Data selecionada (YYYY-MM-DD) */
  value: string;
  onChange: (date: string) => void;
  /** Quantos dias exibir a partir de hoje */
  days?: number;
  /** Fuso da arena — define o que é "hoje" */
  timeZone?: string;
}

/**
 * Seletor horizontal de datas.
 * - Celular: arrastar com o dedo (scroll-snap)
 * - Desktop: setas laterais
 * - Teclado: ← → Home End (padrão ARIA de radiogroup, com "roving tabindex")
 */
export function DateCarousel({ value, onChange, days = 14, timeZone }: DateCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const today = todayIn(timeZone);

  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(today, i)), [today, days]);

  // Mantém a data selecionada visível (ex.: ao navegar pelo teclado)
  useEffect(() => {
    const selected = scrollerRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [value]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = dates.indexOf(value);
    const nextIndex =
      event.key === 'ArrowRight' ? Math.min(index + 1, dates.length - 1)
      : event.key === 'ArrowLeft' ? Math.max(index - 1, 0)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? dates.length - 1
      : null;
    if (nextIndex === null) return;

    event.preventDefault();
    onChange(dates[nextIndex]);
    scrollerRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[nextIndex]?.focus();
  }

  const scrollBy = (direction: 1 | -1) =>
    scrollerRef.current?.scrollBy({ left: direction * scrollerRef.current.clientWidth * 0.8, behavior: 'smooth' });

  const arrowClasses =
    'absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-md transition-all duration-200 hover:scale-105 hover:text-primary active:scale-95 sm:flex';

  return (
    <div className="relative -mx-4 sm:mx-0">
      <button type="button" onClick={() => scrollBy(-1)} aria-label="Datas anteriores" className={`${arrowClasses} left-0`}>
        <ChevronLeftIcon size={18} />
      </button>

      <div
        ref={scrollerRef}
        role="radiogroup"
        aria-label="Escolha a data"
        onKeyDown={handleKeyDown}
        className="scrollbar-none -my-2 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 py-4 sm:scroll-px-14 sm:px-14"
      >
        {dates.map((date) => {
          const selected = date === value;
          const { weekday, day, month, long } = dateParts(date);
          const relative = date === today ? 'Hoje' : date === addDays(today, 1) ? 'Amanhã' : null;

          return (
            <button
              key={date}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={relative ? `${relative}, ${long}` : long}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(date)}
              className={`relative flex w-[64px] shrink-0 snap-start flex-col items-center gap-0.5 rounded-lg py-3 transition-all duration-200 ease-out active:scale-95 ${
                selected
                  ? 'bg-ink text-white shadow-md'
                  : 'bg-surface text-ink shadow-xs hover:-translate-y-0.5 hover:shadow-sm'
              }`}
            >
              <span className={`text-[11px] font-semibold capitalize ${selected ? 'text-white/70' : 'text-ink-subtle'}`}>
                {relative ?? weekday}
              </span>
              <span className="text-[22px] leading-none font-extrabold tabular-nums">{day}</span>
              <span className={`text-[11px] font-medium capitalize ${selected ? 'text-white/70' : 'text-ink-subtle'}`}>
                {month}
              </span>
              {/* Ponto amarelo-sol marca o dia escolhido */}
              <span
                aria-hidden
                className={`absolute -bottom-1 size-2 rounded-full bg-cta ring-2 ring-background transition-transform duration-200 ${
                  selected ? 'scale-100' : 'scale-0'
                }`}
              />
            </button>
          );
        })}
      </div>

      <button type="button" onClick={() => scrollBy(1)} aria-label="Próximas datas" className={`${arrowClasses} right-0`}>
        <ChevronRightIcon size={18} />
      </button>
    </div>
  );
}
