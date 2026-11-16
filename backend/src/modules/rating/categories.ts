import type { PlayerLevel } from '@prisma/client';

/**
 * Faixas de categoria por ELO — FONTE ÚNICA da regra (o app recebe tudo
 * calculado em `rank`, sem repetir os números no frontend).
 *
 *   Iniciante  <1200
 *   D          1200 – 1399
 *   C          1400 – 1599
 *   B          1600 – 1799
 *   A          1800+
 */
export const CATEGORY_THRESHOLDS: ReadonlyArray<{ level: PlayerLevel; name: string; minElo: number }> = [
  { level: 'INICIANTE', name: 'Iniciante', minElo: 0 },
  { level: 'D', name: 'Categoria D', minElo: 1200 },
  { level: 'C', name: 'Categoria C', minElo: 1400 },
  { level: 'B', name: 'Categoria B', minElo: 1600 },
  { level: 'A', name: 'Categoria A', minElo: 1800 },
];

export const INITIAL_ELO = 1000;

export interface RankInfo {
  eloScore: number;
  level: PlayerLevel;
  name: string;
  /** Piso da categoria atual */
  minElo: number;
  /** Próxima categoria (null se já está na A) */
  next: { level: PlayerLevel; name: string; minElo: number; pointsToGo: number } | null;
  /** 0–100: quanto da faixa atual já foi percorrido */
  progress: number;
}

export function categoryFor(elo: number): (typeof CATEGORY_THRESHOLDS)[number] {
  let current = CATEGORY_THRESHOLDS[0];
  for (const category of CATEGORY_THRESHOLDS) if (elo >= category.minElo) current = category;
  return current;
}

export function rankInfo(elo: number): RankInfo {
  const index = CATEGORY_THRESHOLDS.indexOf(categoryFor(elo));
  const current = CATEGORY_THRESHOLDS[index];
  const next = CATEGORY_THRESHOLDS[index + 1] ?? null;

  // Iniciante começa no ELO inicial (1000) para a barra não parecer "travada" no início
  const floor = index === 0 ? Math.min(INITIAL_ELO, elo) : current.minElo;
  // Enquanto não atingir a próxima categoria, a barra nunca mostra 100% (1999 = 99%)
  const progress = next ? Math.min(99, Math.floor(((elo - floor) / (next.minElo - floor)) * 100)) : 100;

  return {
    eloScore: elo,
    level: current.level,
    name: current.name,
    minElo: current.minElo,
    next: next ? { level: next.level, name: next.name, minElo: next.minElo, pointsToGo: next.minElo - elo } : null,
    progress: Math.max(0, Math.min(100, progress)),
  };
}
