/**
 * Algoritmo ELO para partidas de beach tennis (simples 1x1 ou duplas 2x2).
 *
 * 1. Força de cada time = média do ELO dos jogadores.
 * 2. Probabilidade esperada de vitória do time A contra o B:
 *        E_A = 1 / (1 + 10^((R_B − R_A) / 400))
 *    (400 pontos de diferença ≈ 91% de chance para o mais forte)
 * 3. Variação = K × (resultado − esperado), resultado = 1 (vitória) ou 0.
 *    Vencer um time mais forte rende MAIS; perder para um mais fraco custa MAIS.
 * 4. Todos os jogadores do time recebem a mesma variação, e o que um time
 *    ganha o outro perde (soma zero, como no xadrez).
 *
 * Funções puras: sem banco, fáceis de testar e de auditar.
 */

/** Fator K: quanto um único jogo pode mover o ELO (32 = padrão para amadores) */
export const K_FACTOR = 32;
/** Nenhum jogador fica abaixo disso (evita ELO negativo e "poço sem fundo") */
export const MIN_ELO = 100;
/** Mesmo vencendo um time muito mais fraco, a vitória vale ao menos 1 ponto */
const MIN_WIN_DELTA = 1;

export type Team = 1 | 2;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function teamAverage(ratings: number[]): number {
  if (ratings.length === 0) throw new Error('Time vazio');
  return Math.round(ratings.reduce((sum, r) => sum + r, 0) / ratings.length);
}

/** Pontos que o time ganha se vencer, dado que tinha `expected` de chance */
function winDelta(expected: number, k: number): number {
  return Math.max(MIN_WIN_DELTA, Math.round(k * (1 - expected)));
}

export interface EloOutcome {
  team1Avg: number;
  team2Avg: number;
  winnerTeam: Team;
  /** Chance (0–1) que o vencedor tinha — baixa = "zebra" */
  winnerExpected: number;
  /** Positivo, aplicado a cada vencedor */
  winnerDelta: number;
  /** Negativo, aplicado a cada perdedor */
  loserDelta: number;
  kFactor: number;
}

export function calculateMatch(team1: number[], team2: number[], winnerTeam: Team, k = K_FACTOR): EloOutcome {
  const team1Avg = teamAverage(team1);
  const team2Avg = teamAverage(team2);
  const winnerExpected = winnerTeam === 1 ? expectedScore(team1Avg, team2Avg) : expectedScore(team2Avg, team1Avg);
  const delta = winDelta(winnerExpected, k);

  return { team1Avg, team2Avg, winnerTeam, winnerExpected, winnerDelta: delta, loserDelta: -delta, kFactor: k };
}

/** Novo ELO de um jogador, respeitando o piso */
export function applyDelta(elo: number, delta: number): number {
  return Math.max(MIN_ELO, elo + delta);
}

export interface TeamPreview {
  avgElo: number;
  /** 0–100 */
  winChance: number;
  ifWin: number;
  ifLose: number;
}

/** "Se ganhar +X / se perder −Y" para cada time, antes de registrar o resultado */
export function previewMatch(team1: number[], team2: number[], k = K_FACTOR): { team1: TeamPreview; team2: TeamPreview } {
  const team1Avg = teamAverage(team1);
  const team2Avg = teamAverage(team2);
  const e1 = expectedScore(team1Avg, team2Avg);
  const e2 = 1 - e1;
  return {
    team1: { avgElo: team1Avg, winChance: Math.round(e1 * 100), ifWin: winDelta(e1, k), ifLose: -winDelta(e2, k) },
    team2: { avgElo: team2Avg, winChance: Math.round(e2 * 100), ifWin: winDelta(e2, k), ifLose: -winDelta(e1, k) },
  };
}
