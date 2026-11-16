import type { Teacher } from '@/types/lesson';
import { LevelBadge } from './LevelBadge';

interface TeacherCardProps {
  teacher: Teacher;
  selected: boolean;
  onSelect: () => void;
}

/** Cartão do professor; tocar filtra as aulas por ele (tocar de novo limpa) */
export function TeacherCard({ teacher, selected, onSelect }: TeacherCardProps) {
  const initials = teacher.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-[272px] shrink-0 snap-start flex-col rounded-lg p-5 text-left transition-all duration-200 ease-out active:scale-[0.98] ${
        selected ? 'bg-ink text-white shadow-md' : 'bg-surface text-ink shadow-sm hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex size-12 shrink-0 items-center justify-center rounded-full text-base font-extrabold ${
            selected ? 'bg-cta text-cta-ink' : 'bg-ink text-cta'
          }`}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold">{teacher.name}</p>
          <p className={`text-xs font-medium ${selected ? 'text-white/70' : 'text-ink-subtle'}`}>
            {teacher.upcomingLessons} {teacher.upcomingLessons === 1 ? 'aula agendada' : 'aulas agendadas'}
          </p>
        </div>
      </div>

      {teacher.bio && (
        <p className={`mt-3 line-clamp-3 text-[13px] leading-relaxed ${selected ? 'text-white/80' : 'text-ink-muted'}`}>
          {teacher.bio}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {teacher.levels.map((level) => (
          <LevelBadge key={level} level={level} />
        ))}
      </div>
    </button>
  );
}
