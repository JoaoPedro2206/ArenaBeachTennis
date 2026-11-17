import { describe, expect, it } from 'vitest';
import {
  K_FACTOR,
  MIN_ELO,
  applyDelta,
  calculateMatch,
  expectedScore,
  previewMatch,
  teamAverage,
} from '../../src/modules/rating/elo.service';

describe('expectedScore', () => {
  it('times iguais têm 50% de chance', () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
  });

  it('400 pontos de diferença ≈ 91% para o mais forte', () => {
    expect(expectedScore(1400, 1000)).toBeCloseTo(10 / 11, 10);
    expect(expectedScore(1000, 1400)).toBeCloseTo(1 / 11, 10);
  });

  it('as duas probabilidades somam 1', () => {
    for (const [a, b] of [[1000, 1200], [1550, 980], [2400, 100]]) {
      expect(expectedScore(a, b) + expectedScore(b, a)).toBeCloseTo(1, 12);
    }
  });
});

describe('teamAverage', () => {
  it('média arredondada dos jogadores', () => {
    expect(teamAverage([1200])).toBe(1200);
    expect(teamAverage([1200, 1000])).toBe(1100);
    expect(teamAverage([1001, 1000])).toBe(1001); // 1000,5 arredonda para cima
  });

  it('time vazio é erro de programação', () => {
    expect(() => teamAverage([])).toThrow('Time vazio');
  });
});

describe('calculateMatch', () => {
  it('1x1 entre iguais: +16 / −16 com K=32', () => {
    const outcome = calculateMatch([1000], [1000], 1);
    expect(outcome).toMatchObject({ team1Avg: 1000, team2Avg: 1000, winnerTeam: 1, winnerDelta: 16, loserDelta: -16, kFactor: K_FACTOR });
    expect(outcome.winnerExpected).toBe(0.5);
  });

  it('soma zero: o que o vencedor ganha o perdedor perde (1x1 e 2x2)', () => {
    for (const [t1, t2, winner] of [
      [[1000], [1400], 1],
      [[1300, 1100], [1250, 1500], 2],
      [[1800, 1700], [900, 1000], 1],
    ] as const) {
      const { winnerDelta, loserDelta } = calculateMatch([...t1], [...t2], winner);
      const winners = winner === 1 ? t1.length : t2.length;
      const losers = winner === 1 ? t2.length : t1.length;
      expect(winnerDelta * winners + loserDelta * losers).toBe(0);
    }
  });

  it('vitória de zebra vale mais que vitória do favorito', () => {
    const upset = calculateMatch([1000], [1400], 1); // azarão vence
    const expected = calculateMatch([1000], [1400], 2); // favorito vence
    expect(upset.winnerDelta).toBe(29); // 32 × (1 − 1/11)
    expect(expected.winnerDelta).toBe(3); // 32 × (1/11)
    expect(upset.winnerExpected).toBeCloseTo(1 / 11, 10);
  });

  it('2x2 usa a média de cada dupla', () => {
    const outcome = calculateMatch([1200, 1000], [1100, 1100], 2);
    expect(outcome.team1Avg).toBe(1100);
    expect(outcome.team2Avg).toBe(1100);
    expect(outcome.winnerDelta).toBe(16);
  });

  it('vitória contra time muito mais fraco ainda vale ao menos 1 ponto', () => {
    const outcome = calculateMatch([2400], [100], 1);
    expect(outcome.winnerDelta).toBe(1);
    expect(outcome.loserDelta).toBe(-1);
  });

  it('aceita outro fator K', () => {
    expect(calculateMatch([1000], [1000], 2, 20).winnerDelta).toBe(10);
  });
});

describe('applyDelta', () => {
  it('soma a variação', () => {
    expect(applyDelta(1000, 16)).toBe(1016);
    expect(applyDelta(1000, -16)).toBe(984);
  });

  it(`nunca deixa o ELO abaixo do piso (${MIN_ELO})`, () => {
    expect(applyDelta(110, -16)).toBe(MIN_ELO);
    expect(applyDelta(MIN_ELO, -30)).toBe(MIN_ELO);
  });
});

describe('previewMatch', () => {
  it('iguais: 50% de chance, +16 / −16 para os dois lados', () => {
    expect(previewMatch([1000], [1000])).toEqual({
      team1: { avgElo: 1000, winChance: 50, ifWin: 16, ifLose: -16 },
      team2: { avgElo: 1000, winChance: 50, ifWin: 16, ifLose: -16 },
    });
  });

  it('bate com o que calculateMatch aplica de fato', () => {
    const t1 = [1300, 1100];
    const t2 = [1250, 1500];
    const preview = previewMatch(t1, t2);
    expect(preview.team1.ifWin).toBe(calculateMatch(t1, t2, 1).winnerDelta);
    expect(preview.team1.ifLose).toBe(calculateMatch(t1, t2, 2).loserDelta);
    expect(preview.team2.ifWin).toBe(calculateMatch(t1, t2, 2).winnerDelta);
    expect(preview.team2.ifLose).toBe(calculateMatch(t1, t2, 1).loserDelta);
    expect(preview.team1.winChance + preview.team2.winChance).toBe(100);
  });

  it('aceita outro fator K', () => {
    expect(previewMatch([1000], [1000], 20).team1.ifWin).toBe(10);
  });
});
