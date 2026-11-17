import { describe, expect, it } from 'vitest';
import { CATEGORY_THRESHOLDS, INITIAL_ELO, categoryFor, rankInfo } from '../../src/modules/rating/categories';

describe('categoryFor — bordas das faixas', () => {
  it.each([
    [-50, 'INICIANTE'],
    [0, 'INICIANTE'],
    [INITIAL_ELO, 'INICIANTE'],
    [1199, 'INICIANTE'],
    [1200, 'D'],
    [1399, 'D'],
    [1400, 'C'],
    [1599, 'C'],
    [1600, 'B'],
    [1799, 'B'],
    [1800, 'A'],
    [3000, 'A'],
  ])('ELO %i → %s', (elo, level) => {
    expect(categoryFor(elo).level).toBe(level);
  });

  it('faixas em ordem crescente', () => {
    const mins = CATEGORY_THRESHOLDS.map((c) => c.minElo);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });
});

describe('rankInfo', () => {
  it('jogador novo (1000): Iniciante, 0% e 200 pontos para a D', () => {
    expect(rankInfo(1000)).toEqual({
      eloScore: 1000,
      level: 'INICIANTE',
      name: 'Iniciante',
      minElo: 0,
      next: { level: 'D', name: 'Categoria D', minElo: 1200, pointsToGo: 200 },
      progress: 0,
    });
  });

  it('Iniciante conta o progresso a partir do ELO inicial', () => {
    expect(rankInfo(1100).progress).toBe(50);
  });

  it('abaixo do ELO inicial a barra começa no próprio ELO (sem progresso negativo)', () => {
    expect(rankInfo(800).progress).toBe(0);
    expect(rankInfo(800).next?.pointsToGo).toBe(400);
  });

  it('um ponto antes de subir mostra 99%, nunca 100%', () => {
    expect(rankInfo(1199)).toMatchObject({ level: 'INICIANTE', progress: 99, next: { pointsToGo: 1 } });
    expect(rankInfo(1399)).toMatchObject({ level: 'D', progress: 99, next: { level: 'C', pointsToGo: 1 } });
    expect(rankInfo(1799)).toMatchObject({ level: 'B', progress: 99, next: { level: 'A', pointsToGo: 1 } });
  });

  it('ao entrar numa categoria o progresso recomeça do zero', () => {
    expect(rankInfo(1200)).toMatchObject({ level: 'D', minElo: 1200, progress: 0, next: { pointsToGo: 200 } });
    expect(rankInfo(1400)).toMatchObject({ level: 'C', progress: 0 });
    expect(rankInfo(1500)).toMatchObject({ level: 'C', progress: 50, next: { level: 'B', pointsToGo: 100 } });
    expect(rankInfo(1600)).toMatchObject({ level: 'B', progress: 0 });
  });

  it('categoria máxima: sem próxima e barra cheia', () => {
    expect(rankInfo(1800)).toMatchObject({ level: 'A', name: 'Categoria A', next: null, progress: 100 });
    expect(rankInfo(2600)).toMatchObject({ level: 'A', next: null, progress: 100 });
  });
});
