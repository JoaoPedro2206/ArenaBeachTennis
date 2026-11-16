import { LESSON_LEVEL_LABELS, type LessonLevel } from '@/types/lesson';

interface LevelFilterProps {
  value: LessonLevel | null;
  onChange: (level: LessonLevel | null) => void;
}

const OPTIONS: Array<{ value: LessonLevel | null; label: string }> = [
  { value: null, label: 'Todas' },
  ...(Object.entries(LESSON_LEVEL_LABELS) as Array<[LessonLevel, string]>).map(([value, label]) => ({ value, label })),
];

/** Chips de modalidade (Todas / Iniciante / Intermediário / Avançado) */
export function LevelFilter({ value, onChange }: LevelFilterProps) {
  return (
    <div role="radiogroup" aria-label="Filtrar por nível" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`h-10 shrink-0 rounded-full px-5 text-sm font-bold whitespace-nowrap transition-all duration-200 active:scale-95 ${
              selected ? 'bg-ink text-white shadow-md' : 'bg-surface text-ink-muted shadow-xs hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
