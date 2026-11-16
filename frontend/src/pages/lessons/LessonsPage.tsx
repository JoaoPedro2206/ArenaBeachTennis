import { useState } from 'react';
import { EnrollDialog } from '@/components/lessons/EnrollDialog';
import { LessonCard } from '@/components/lessons/LessonCard';
import { LevelFilter } from '@/components/lessons/LevelFilter';
import { TeacherCard } from '@/components/lessons/TeacherCard';
import { useAsync } from '@/hooks/useAsync';
import { capitalizeFirst } from '@/lib/format';
import { lessonService } from '@/services/lessonService';
import type { Lesson, LessonLevel } from '@/types/lesson';

/** Agrupa as aulas por dia (no fuso da arena), mantendo a ordem cronológica */
function groupByDay(lessons: Lesson[]): Array<{ key: string; label: string; lessons: Lesson[] }> {
  const groups = new Map<string, { label: string; lessons: Lesson[] }>();
  for (const lesson of lessons) {
    const tz = lesson.arena.timezone;
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(lesson.startTime));
    const label = capitalizeFirst(
      new Intl.DateTimeFormat('pt-BR', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(
        new Date(lesson.startTime),
      ),
    );
    if (!groups.has(key)) groups.set(key, { label, lessons: [] });
    groups.get(key)!.lessons.push(lesson);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}

export default function LessonsPage() {
  const [level, setLevel] = useState<LessonLevel | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ lesson: Lesson; mode: 'enroll' | 'unenroll' } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const teachers = useAsync((signal) => lessonService.listTeachers(signal), []);
  const lessons = useAsync(
    (signal) => lessonService.listLessons({ level: level ?? undefined, teacherId: teacherId ?? undefined, days: 21 }, signal),
    [level, teacherId],
  );

  const selectedTeacher = teachers.data?.find((t) => t.id === teacherId);
  const days = groupByDay(lessons.data ?? []);

  function handleDone(_lesson: Lesson, message: string) {
    setDialog(null);
    setNotice(message);
    lessons.reload();
    teachers.reload();
  }

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Aulas</p>
        <h1 className="mt-1 text-[28px] leading-tight font-extrabold text-ink sm:text-[32px]">Evolua com quem entende</h1>
        <p className="mt-2 max-w-lg text-[15px] text-ink-muted">
          Turmas pequenas com os professores da arena. Escolha seu nível e garanta sua vaga.
        </p>
      </header>

      {/* Professores */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Professores</h2>
        {teachers.loading && !teachers.data ? (
          <div className="flex gap-3" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-[196px] w-[272px] shrink-0 animate-pulse rounded-lg bg-surface-muted" />
            ))}
          </div>
        ) : teachers.error ? (
          <p role="alert" className="rounded-lg bg-danger-soft p-4 text-sm font-medium text-danger">
            {teachers.error}{' '}
            <button type="button" onClick={teachers.reload} className="font-bold text-primary hover:underline">
              Tentar novamente
            </button>
          </p>
        ) : (
          <div className="scrollbar-none -mx-4 -my-2 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 py-2 sm:mx-0 sm:scroll-px-0 sm:px-0">
            {(teachers.data ?? []).map((teacher) => (
              <TeacherCard
                key={teacher.id}
                teacher={teacher}
                selected={teacher.id === teacherId}
                onSelect={() => setTeacherId((current) => (current === teacher.id ? null : teacher.id))}
              />
            ))}
          </div>
        )}
      </section>

      {/* Agenda de aulas */}
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-extrabold text-ink">Próximas aulas</h2>
          {selectedTeacher && (
            <button
              type="button"
              onClick={() => setTeacherId(null)}
              className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white transition-transform active:scale-95"
            >
              {selectedTeacher.name} ✕
            </button>
          )}
        </div>

        <LevelFilter value={level} onChange={setLevel} />

        {notice && (
          <p role="status" className="mt-4 animate-rise rounded-md bg-success-soft px-4 py-3 text-sm font-semibold text-success">
            {notice}
          </p>
        )}

        <div className="mt-6">
          {lessons.loading && !lessons.data ? (
            <div className="space-y-3" aria-busy="true" aria-label="Carregando aulas">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-lg bg-surface-muted" />
              ))}
            </div>
          ) : lessons.error ? (
            <div role="alert" className="rounded-lg bg-danger-soft p-6 text-center text-sm font-medium text-danger">
              {lessons.error}{' '}
              <button type="button" onClick={lessons.reload} className="font-bold text-primary hover:underline">
                Tentar novamente
              </button>
            </div>
          ) : days.length === 0 ? (
            <div className="rounded-lg bg-surface-muted px-6 py-12 text-center">
              <p className="text-4xl" aria-hidden>
                📋
              </p>
              <p className="mt-4 font-bold text-ink">Nenhuma aula com esses filtros</p>
              <p className="mt-1 text-sm text-ink-muted">Tente outro nível ou professor.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {days.map((day) => (
                <section key={day.key} aria-label={day.label}>
                  <h3 className="mb-3 text-[15px] font-bold text-ink-muted">{day.label}</h3>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {day.lessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        onEnroll={() => setDialog({ lesson, mode: 'enroll' })}
                        onUnenroll={() => setDialog({ lesson, mode: 'unenroll' })}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>

      {dialog && (
        <EnrollDialog lesson={dialog.lesson} mode={dialog.mode} onClose={() => setDialog(null)} onDone={handleDone} />
      )}
    </div>
  );
}
