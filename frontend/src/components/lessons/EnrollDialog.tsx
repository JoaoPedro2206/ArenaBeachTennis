import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatInZone } from '@/lib/dates';
import { capitalizeFirst, formatPrice } from '@/lib/format';
import { ApiError } from '@/services/api';
import { lessonService } from '@/services/lessonService';
import type { Lesson } from '@/types/lesson';
import { LevelBadge } from './LevelBadge';

interface EnrollDialogProps {
  lesson: Lesson;
  /** enroll = inscrever; unenroll = sair da turma */
  mode: 'enroll' | 'unenroll';
  onClose: () => void;
  onDone: (lesson: Lesson, message: string) => void;
}

/** Confirmação de inscrição (ou saída) numa aula */
export function EnrollDialog({ lesson, mode, onClose, onDone }: EnrollDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tz = lesson.arena.timezone;
  const { date, time } = formatInZone(lesson.startTime, tz);
  const end = formatInZone(lesson.endTime, tz).time;
  const enrolling = mode === 'enroll';

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = enrolling ? await lessonService.enroll(lesson.id) : await lessonService.unenroll(lesson.id);
      onDone(
        updated,
        enrolling ? `Inscrição confirmada em "${lesson.title}". Até lá! 🎾` : `Você saiu da turma "${lesson.title}".`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir. Tente novamente.');
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!submitting}
      title={enrolling ? 'Inscrever-se na aula' : 'Sair da turma?'}
      description={enrolling ? 'Confira os detalhes da aula.' : 'Sua vaga ficará disponível para outro aluno.'}
    >
      <div className="rounded-lg bg-surface-muted p-4">
        <LevelBadge level={lesson.level} />
        <p className="mt-2 text-base font-extrabold text-ink">{lesson.title}</p>
        <p className="text-sm text-ink-muted">com {lesson.teacher.name}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <Item label="Quando" value={`${capitalizeFirst(date)}, ${time}–${end}`} wide />
          <Item label="Quadra" value={lesson.court.name} />
          <Item label="Valor" value={formatPrice(lesson.pricePerStudent)} />
        </dl>
      </div>

      {error && (
        <p role="alert" className="mt-4 animate-fade-in rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-3">
        <Button variant={enrolling ? 'cta' : 'destructive'} size="lg" onClick={confirm} loading={submitting}>
          {enrolling ? 'Confirmar inscrição' : 'Sim, sair da turma'}
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Voltar
        </Button>
      </div>
      {enrolling && (
        <p className="mt-3 text-center text-xs text-ink-subtle">O valor da aula é acertado diretamente com a arena.</p>
      )}
    </Modal>
  );
}

function Item({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-md bg-surface px-3 py-2.5 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-[11px] font-bold tracking-wider text-ink-subtle uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-bold text-ink">{value}</dd>
    </div>
  );
}
