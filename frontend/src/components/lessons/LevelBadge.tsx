import { LESSON_LEVEL_LABELS, type LessonLevel } from '@/types/lesson';

/** Cor por nível: azul (início), amarelo-sol (meio), laranja (avançado) */
const STYLES: Record<LessonLevel, string> = {
  BEGINNER: 'bg-primary-soft text-primary-strong',
  INTERMEDIATE: 'bg-warning-soft text-warning-ink',
  ADVANCED: 'bg-accent-soft text-accent-strong',
};

export function LevelBadge({ level, className = '' }: { level: LessonLevel; className?: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STYLES[level]} ${className}`}>
      {LESSON_LEVEL_LABELS[level]}
    </span>
  );
}
