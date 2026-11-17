/** Espelham as respostas do backend (módulos auth e users) */
export type UserRole = 'PLAYER' | 'TEACHER' | 'ARENA_ADMIN' | 'SUPER_ADMIN';

/** Categorias do Beach Tennis, da menor para a maior */
export type PlayerLevel = 'INICIANTE' | 'D' | 'C' | 'B' | 'A';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** URL da foto de perfil (null = mostra as iniciais) */
  profilePhoto: string | null;
  bio: string | null;
  role: UserRole;
  /** ISO de quando o e-mail foi confirmado (null = pendente) */
  emailVerifiedAt: string | null;
  /** Pontuação ELO — a categoria é derivada dela pelo backend */
  eloScore: number;
  /** Categoria atual (calculada, não editável) */
  level: PlayerLevel;
  /** Categoria + progresso para a próxima, calculados pelo backend */
  rank: RankInfo;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RankInfo {
  eloScore: number;
  level: PlayerLevel;
  name: string;
  minElo: number;
  /** null quando já está na categoria máxima (A) */
  next: { level: PlayerLevel; name: string; minElo: number; pointsToGo: number } | null;
  /** 0–100 dentro da faixa atual */
  progress: number;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  /** null/"" apaga o telefone */
  phone?: string | null;
  bio?: string | null;
}

export interface PlayerLevelInfo {
  value: PlayerLevel;
  /** Texto curto para destaques (ex.: "D", "Ini") */
  code: string;
  name: string;
  description: string;
}

/** Fonte única das categorias, na ordem de progressão */
export const PLAYER_LEVELS: PlayerLevelInfo[] = [
  { value: 'INICIANTE', code: 'Ini', name: 'Iniciante', description: 'Primeiros passos na areia' },
  { value: 'D', code: 'D', name: 'Categoria D', description: 'Já joga partidas e mantém a troca de bola' },
  { value: 'C', code: 'C', name: 'Categoria C', description: 'Intermediário: domina saque e voleio' },
  { value: 'B', code: 'B', name: 'Categoria B', description: 'Intermediário avançado, joga torneios' },
  { value: 'A', code: 'A', name: 'Categoria A', description: 'Avançado / competitivo' },
];

export const LEVEL_INFO = Object.fromEntries(PLAYER_LEVELS.map((level) => [level.value, level])) as Record<
  PlayerLevel,
  PlayerLevelInfo
>;
