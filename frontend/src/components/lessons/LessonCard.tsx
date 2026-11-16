import { PinIcon, UsersIcon } from '@/components/icons';
import { formatInZone } from '@/lib/dates';
import { formatPrice } from '@/lib/format';
import type { Lesson } from '@/types/lesson';
import { LevelBadge } from './LevelBadge';

interface LessonCardProps {
  lesson: Lesson;
  onEnroll: () => void;
  onUnenroll: () => void;
}

/** Uma aula: horário, nível, professor, quadra, vagas e a ação de inscrição */
export function LessonCard({ lesson, onEnroll, onUnenroll }: LessonCardProps) {
  const tz = lesson.arena.timezone;
  const start = formatInZone(lesson.startTime, tz).time;
  const end = formatInZone(lesson.endTime, tz).time;
  const full = lesson.spotsLeft === 0 && !lesson.isEnrolled;
  const fillPercent = Math.round((lesson.enrolledCount / lesson.capacity) * 100);

  return (
    <article
      className={`rounded-lg bg-surface p-4 shadow-sm transition-all duration-200 sm:p-5 ${
        lesson.isEnrolled ? 'ring-2 ring-primary' : 'hover:shadow-md'
      }`}
    >
      <div className="flex gap-4">
        <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-md bg-ink py-2 text-white">
          <span className="text-[17px] leading-none font-extrabold tabular-nums">{start}</span>
          <span className="mt-1 text-[11px] text-white/60 tabular-nums">até {end}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={lesson.level} />
            {lesson.seriesId && <span className="text-[11px] font-semibold text-ink-subtle">Semanal</span>}
          </div>
          <h3 className="mt-1.5 text-base leading-snug font-extrabold text-ink">{lesson.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
            <span>com {lesson.teacher.name}</span>
            <span className="inline-flex items-center gap-1">
              <PinIcon size={14} />
              {lesson.court.name}
            </span>
          </p>
        </div>
      </div>

      {/* Vagas */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <UsersIcon size={14} />
            {lesson.enrolledCount} de {lesson.capacity} alunos
          </span>
          <span className={full ? 'text-danger' : lesson.spotsLeft <= 1 ? 'text-accent-strong' : 'text-success'}>
            {full ? 'Turma lotada' : `${lesson.spotsLeft} ${lesson.spotsLeft === 1 ? 'vaga' : 'vagas'}`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${full ? 'bg-danger' : 'bg-primary'}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          <strong className="text-lg font-extrabold text-ink">{formatPrice(lesson.pricePerStudent)}</strong> /aluno
        </p>

        {lesson.isEnrolled ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary-strong">✓ Inscrito</span>
            <button
              type="button"
              onClick={onUnenroll}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-danger transition-colors hover:bg-danger-soft"
            >
              Sair
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onEnroll}
            disabled={full}
            className="h-10 rounded-md bg-cta px-5 text-sm font-bold text-cta-ink shadow-cta transition-all duration-200 hover:-translate-y-0.5 active:scale-95 disabled:pointer-events-none disabled:bg-surface-muted disabled:text-ink-subtle disabled:shadow-none"
          >
            {full ? 'Lotada' : 'Inscrever-se'}
          </button>
        )}
      </div>
    </article>
  );
}
