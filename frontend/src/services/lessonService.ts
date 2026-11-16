import { api } from './api';
import type { Lesson, LessonLevel, Teacher } from '@/types/lesson';

/** Professores, aulas e inscrições */
export const lessonService = {
  listTeachers: (signal?: AbortSignal): Promise<Teacher[]> =>
    api<{ teachers: Teacher[] }>('/teachers', { signal }).then((r) => r.teachers),

  /** Público; com sessão, cada aula vem com `isEnrolled` do usuário */
  listLessons: (filters: { level?: LessonLevel; teacherId?: string; days?: number } = {}, signal?: AbortSignal) =>
    api<{ lessons: Lesson[] }>('/lessons', { params: filters, signal }).then((r) => r.lessons),

  enroll: (lessonId: string): Promise<Lesson> =>
    api<{ lesson: Lesson }>(`/lessons/${lessonId}/enroll`, { method: 'POST' }).then((r) => r.lesson),

  unenroll: (lessonId: string): Promise<Lesson> =>
    api<{ lesson: Lesson }>(`/lessons/${lessonId}/enroll`, { method: 'DELETE' }).then((r) => r.lesson),
};
