/** Espelham as respostas do módulo de aulas do backend */
export type LessonLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export const LESSON_LEVEL_LABELS: Record<LessonLevel, string> = {
  BEGINNER: 'Iniciante',
  INTERMEDIATE: 'Intermediário',
  ADVANCED: 'Avançado',
};

export interface Teacher {
  id: string;
  name: string;
  profilePhoto: string | null;
  bio: string | null;
  levels: LessonLevel[];
  upcomingLessons: number;
  arena: { id: string; name: string };
}

export interface Lesson {
  id: string;
  seriesId: string | null;
  title: string;
  level: LessonLevel;
  startTime: string;
  endTime: string;
  capacity: number;
  enrolledCount: number;
  spotsLeft: number;
  pricePerStudent: number; // centavos
  isEnrolled: boolean;
  teacher: { id: string; name: string; profilePhoto: string | null };
  court: { id: string; name: string };
  arena: { id: string; name: string; timezone: string };
}
