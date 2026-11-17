import { describe, expect, it } from 'vitest';
import {
  BOOKING_MAX_DAYS_AHEAD,
  calculatePrice,
  checkSlotRequest,
  formatHHmm,
  generateDailySlots,
  getOperatingMinutes,
  parseHHmm,
  rangesOverlap,
  type CourtSchedule,
} from '../../src/modules/bookings/slot-rules';

const TZ = 'America/Sao_Paulo'; // UTC−3, sem horário de verão desde 2019
const at = (iso: string) => new Date(iso);

/** 06:00–23:00 com slots de 90 min (padrão das quadras de areia) */
const court: CourtSchedule = { openTime: '06:00', closeTime: '23:00', slotDurationMin: 90, pricePerHour: 12_000 };
/** Agora: terça 17/11/2026 09:00 em São Paulo */
const NOW = at('2026-11-17T12:00:00Z');

describe('parseHHmm / formatHHmm', () => {
  it('converte nos dois sentidos', () => {
    expect(parseHHmm('00:00')).toBe(0);
    expect(parseHHmm('07:30')).toBe(450);
    expect(parseHHmm('23:59')).toBe(1439);
    expect(formatHHmm(90)).toBe('01:30');
    expect(formatHHmm(1380)).toBe('23:00');
  });

  it('1440 (meia-noite do fim do dia) vira "00:00"', () => {
    expect(formatHHmm(1440)).toBe('00:00');
  });
});

describe('getOperatingMinutes', () => {
  it('fechamento "00:00" significa meia-noite (1440), não zero', () => {
    expect(getOperatingMinutes({ ...court, openTime: '18:00', closeTime: '00:00' })).toEqual({ open: 1080, close: 1440 });
    expect(getOperatingMinutes(court)).toEqual({ open: 360, close: 1380 });
  });
});

describe('generateDailySlots', () => {
  it('slots de 90 min: só cabem os inteiros (06:00 … 21:00, 11 slots)', () => {
    const slots = generateDailySlots(court, '2026-11-18', TZ);
    expect(slots).toHaveLength(11);
    expect(slots[0]).toEqual({ start: at('2026-11-18T09:00:00Z'), end: at('2026-11-18T10:30:00Z') });
    expect(slots[1].start).toEqual(at('2026-11-18T10:30:00Z'));
    // último começa 21:00 e termina 22:30 — 22:30–00:00 não cabe antes das 23:00
    expect(slots.at(-1)).toEqual({ start: at('2026-11-19T00:00:00Z'), end: at('2026-11-19T01:30:00Z') });
  });

  it('slots encostados, sem buracos nem sobreposição', () => {
    const slots = generateDailySlots(court, '2026-11-18', TZ);
    for (let i = 1; i < slots.length; i++) expect(slots[i].start).toEqual(slots[i - 1].end);
  });

  it('quadra que fecha à meia-noite: último slot 23:00–00:00 termina no dia seguinte', () => {
    const night = { ...court, openTime: '18:00', closeTime: '00:00', slotDurationMin: 60 };
    const slots = generateDailySlots(night, '2026-11-18', TZ);
    expect(slots).toHaveLength(6);
    expect(slots.at(-1)).toEqual({ start: at('2026-11-19T02:00:00Z'), end: at('2026-11-19T03:00:00Z') });
  });
});

describe('rangesOverlap', () => {
  const r = (a: string, b: string) => ({ start: at(a), end: at(b) });

  it('intervalos semiabertos: encostar não é sobrepor', () => {
    expect(rangesOverlap(r('2026-11-18T10:00Z', '2026-11-18T11:00Z'), r('2026-11-18T11:00Z', '2026-11-18T12:00Z'))).toBe(false);
  });

  it('qualquer interseção conta, inclusive um dentro do outro', () => {
    expect(rangesOverlap(r('2026-11-18T10:00Z', '2026-11-18T11:00Z'), r('2026-11-18T10:59Z', '2026-11-18T12:00Z'))).toBe(true);
    expect(rangesOverlap(r('2026-11-18T10:00Z', '2026-11-18T14:00Z'), r('2026-11-18T11:00Z', '2026-11-18T12:00Z'))).toBe(true);
  });
});

describe('checkSlotRequest', () => {
  /** 18/11 às HH:mm em São Paulo */
  const tomorrow = (hhmm: string, seconds = '00') => at(`2026-11-18T${hhmm}:${seconds}-03:00`);

  it('aceita um slot válido e devolve o fim', () => {
    expect(checkSlotRequest(court, TZ, tomorrow('07:30'), 90, NOW)).toEqual({ ok: true, end: tomorrow('09:00') });
  });

  it('aceita múltiplos da duração do slot (até o máximo)', () => {
    expect(checkSlotRequest(court, TZ, tomorrow('07:30'), 180, NOW)).toEqual({ ok: true, end: tomorrow('10:30') });
  });

  it.each([
    [60, 'não é múltiplo de 90'],
    [0, 'zero'],
    [-90, 'negativa'],
    [270, 'acima de 240 min'],
  ])('recusa duração %i (%s)', (duration) => {
    const result = checkSlotRequest(court, TZ, tomorrow('07:30'), duration, NOW);
    expect(result).toEqual({ ok: false, message: expect.stringContaining('múltipla de 90 min') });
  });

  it('recusa horário no passado (inclusive "agora")', () => {
    expect(checkSlotRequest(court, TZ, at('2026-11-17T09:00:00Z'), 90, NOW)).toEqual({
      ok: false,
      message: 'Não é possível reservar um horário no passado',
    });
    // 09:00 local é exatamente "agora"
    expect(checkSlotRequest(court, TZ, NOW, 90, NOW).ok).toBe(false);
  });

  it(`antecedência máxima de ${BOOKING_MAX_DAYS_AHEAD} dias (borda inclusiva)`, () => {
    // 16/01/2027 09:00 local = agora + 60 dias exatos
    expect(checkSlotRequest(court, TZ, at('2027-01-16T09:00:00-03:00'), 90, NOW).ok).toBe(true);
    expect(checkSlotRequest(court, TZ, at('2027-01-16T10:30:00-03:00'), 90, NOW)).toEqual({
      ok: false,
      message: `Só é possível agendar com até ${BOOKING_MAX_DAYS_AHEAD} dias de antecedência`,
    });
  });

  it('respeita uma antecedência máxima diferente (aulas)', () => {
    expect(checkSlotRequest(court, TZ, at('2026-11-20T07:30:00-03:00'), 90, NOW, 2).ok).toBe(false);
  });

  it('recusa fora do horário de funcionamento', () => {
    expect(checkSlotRequest(court, TZ, tomorrow('04:30'), 90, NOW)).toEqual({
      ok: false,
      message: 'Fora do horário de funcionamento da quadra (06:00 às 23:00)',
    });
    // 21:00 + 180 min = 00:00, passa das 23:00
    expect(checkSlotRequest(court, TZ, tomorrow('21:00'), 180, NOW).ok).toBe(false);
    expect(checkSlotRequest(court, TZ, tomorrow('21:00'), 90, NOW).ok).toBe(true);
  });

  it('quadra que fecha à meia-noite aceita o último slot 22:30–00:00', () => {
    const night = { ...court, closeTime: '00:00' };
    expect(checkSlotRequest(night, TZ, tomorrow('22:30'), 90, NOW)).toEqual({ ok: true, end: at('2026-11-19T00:00:00-03:00') });
  });

  it('recusa início fora da grade', () => {
    const misaligned = checkSlotRequest(court, TZ, tomorrow('07:00'), 90, NOW);
    expect(misaligned).toEqual({ ok: false, message: expect.stringContaining('a cada 90 min a partir de 06:00') });
    expect(checkSlotRequest(court, TZ, tomorrow('07:30', '30'), 90, NOW).ok).toBe(false);
    expect(checkSlotRequest(court, TZ, new Date(tomorrow('07:30').getTime() + 1), 90, NOW).ok).toBe(false);
  });
});

describe('calculatePrice', () => {
  it('proporcional à duração, em centavos', () => {
    expect(calculatePrice(12_000, 90)).toBe(18_000);
    expect(calculatePrice(10_000, 45)).toBe(7_500);
    expect(calculatePrice(10_000, 240)).toBe(40_000);
  });

  it('arredonda para o centavo mais próximo', () => {
    expect(calculatePrice(9_999, 90)).toBe(14_999); // 14.998,5
    expect(calculatePrice(10_001, 30)).toBe(5_001); // 5.000,5
  });
});
