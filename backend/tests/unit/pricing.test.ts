import { describe, expect, it } from 'vitest';
import {
  priceForRange,
  resolveHourlyPrice,
  ruleWindow,
  weekdayOf,
  type PricedCourt,
  type PricingRuleInput,
} from '../../src/modules/pricing/pricing';

const TZ = 'America/Sao_Paulo';
const WEEKDAYS = [1, 2, 3, 4, 5];
const TUESDAY = 2;

const court: PricedCourt = { id: 'quadra-1', pricePerHour: 10_000, slotDurationMin: 60 };

const rule = (overrides: Partial<PricingRuleInput>): PricingRuleInput => ({
  name: 'Regra',
  courtId: null,
  daysOfWeek: WEEKDAYS,
  startTime: '18:00',
  endTime: '22:00',
  pricePerHour: 15_000,
  ...overrides,
});

const nobre = rule({ name: 'Nobre' });

describe('ruleWindow / weekdayOf', () => {
  it('fim "00:00" é meia-noite (1440)', () => {
    expect(ruleWindow({ startTime: '22:00', endTime: '00:00' })).toEqual({ start: 1320, end: 1440 });
    expect(ruleWindow({ startTime: '18:00', endTime: '22:00' })).toEqual({ start: 1080, end: 1320 });
  });

  it('dia da semana da data local (0 = domingo)', () => {
    expect(weekdayOf('2026-11-15')).toBe(0);
    expect(weekdayOf('2026-11-17')).toBe(TUESDAY);
    expect(weekdayOf('2026-11-21')).toBe(6);
  });
});

describe('resolveHourlyPrice — precedência', () => {
  it('sem regra aplicável: preço base da quadra', () => {
    expect(resolveHourlyPrice(court, [], TUESDAY, 600)).toEqual({ pricePerHour: 10_000, ruleName: null });
    expect(resolveHourlyPrice(court, [nobre], TUESDAY, 17 * 60 + 59)).toEqual({ pricePerHour: 10_000, ruleName: null });
  });

  it('regra da arena vale dentro da janela [início, fim)', () => {
    expect(resolveHourlyPrice(court, [nobre], TUESDAY, 18 * 60)).toEqual({ pricePerHour: 15_000, ruleName: 'Nobre' });
    expect(resolveHourlyPrice(court, [nobre], TUESDAY, 21 * 60 + 59).ruleName).toBe('Nobre');
    expect(resolveHourlyPrice(court, [nobre], TUESDAY, 22 * 60).ruleName).toBeNull();
  });

  it('só nos dias marcados', () => {
    expect(resolveHourlyPrice(court, [nobre], 0, 19 * 60).ruleName).toBeNull();
    expect(resolveHourlyPrice(court, [nobre], 6, 19 * 60).ruleName).toBeNull();
  });

  it('regra da quadra vence a da arena, mesmo sendo mais barata', () => {
    const daQuadra = rule({ name: 'Promo da quadra 1', courtId: 'quadra-1', pricePerHour: 12_000 });
    expect(resolveHourlyPrice(court, [nobre, daQuadra], TUESDAY, 19 * 60)).toEqual({
      pricePerHour: 12_000,
      ruleName: 'Promo da quadra 1',
    });
  });

  it('regra de OUTRA quadra é ignorada', () => {
    const outra = rule({ name: 'Quadra 2', courtId: 'quadra-2', pricePerHour: 30_000 });
    expect(resolveHourlyPrice(court, [outra], TUESDAY, 19 * 60).ruleName).toBeNull();
    expect(resolveHourlyPrice(court, [nobre, outra], TUESDAY, 19 * 60).ruleName).toBe('Nobre');
  });

  it('empate de nível: vale o maior preço', () => {
    const feriadao = rule({ name: 'Feriadão', pricePerHour: 18_000, startTime: '19:00' });
    expect(resolveHourlyPrice(court, [nobre, feriadao], TUESDAY, 19 * 60)).toEqual({ pricePerHour: 18_000, ruleName: 'Feriadão' });
    expect(resolveHourlyPrice(court, [feriadao, nobre], TUESDAY, 19 * 60).ruleName).toBe('Feriadão');
    // às 18h só a nobre se aplica
    expect(resolveHourlyPrice(court, [nobre, feriadao], TUESDAY, 18 * 60).ruleName).toBe('Nobre');
  });

  it('empate entre regras da própria quadra também escolhe o maior', () => {
    const a = rule({ name: 'A', courtId: 'quadra-1', pricePerHour: 11_000 });
    const b = rule({ name: 'B', courtId: 'quadra-1', pricePerHour: 13_000 });
    expect(resolveHourlyPrice(court, [a, b, nobre], TUESDAY, 19 * 60)).toEqual({ pricePerHour: 13_000, ruleName: 'B' });
  });

  it('janela até a meia-noite ("00:00") cobre 23:59 mas não 00:00', () => {
    const madrugada = rule({ name: 'Noturno', startTime: '22:00', endTime: '00:00', pricePerHour: 8_000 });
    expect(resolveHourlyPrice(court, [madrugada], TUESDAY, 23 * 60 + 59).ruleName).toBe('Noturno');
    expect(resolveHourlyPrice(court, [madrugada], TUESDAY, 0).ruleName).toBeNull();
  });
});

describe('priceForRange', () => {
  /** Terça 17/11/2026 às HH:mm em São Paulo */
  const tuesday = (hhmm: string) => new Date(`2026-11-17T${hhmm}:00-03:00`);

  it('reserva 17h–19h com nobre às 18h: 1h base + 1h nobre', () => {
    expect(priceForRange(court, [nobre], TZ, tuesday('17:00'), 120)).toBe(10_000 + 15_000);
  });

  it('reserva inteira dentro da faixa nobre', () => {
    expect(priceForRange(court, [nobre], TZ, tuesday('18:00'), 120)).toBe(30_000);
  });

  it('sem regras = preço base proporcional', () => {
    expect(priceForRange(court, [], TZ, tuesday('08:00'), 180)).toBe(30_000);
  });

  it('slot de 90 min é cobrado pela regra do seu início', () => {
    const areia = { ...court, slotDurationMin: 90 };
    expect(priceForRange(areia, [nobre], TZ, tuesday('17:30'), 90)).toBe(15_000); // base × 1,5
    expect(priceForRange(areia, [nobre], TZ, tuesday('18:00'), 90)).toBe(22_500); // nobre × 1,5
    expect(priceForRange(areia, [nobre], TZ, tuesday('16:30'), 180)).toBe(15_000 + 22_500);
  });

  it('último slot antes da meia-noite usa a regra que termina em "00:00"', () => {
    const noturno = rule({ name: 'Noturno', startTime: '22:00', endTime: '00:00', pricePerHour: 20_000 });
    expect(priceForRange(court, [noturno], TZ, tuesday('23:00'), 60)).toBe(20_000);
    expect(priceForRange(court, [noturno], TZ, tuesday('21:00'), 120)).toBe(10_000 + 20_000);
  });

  it('usa o dia da semana LOCAL (23h de sábado já é domingo em UTC)', () => {
    const sabadoNoite = rule({ name: 'Sábado', daysOfWeek: [6], startTime: '22:00', endTime: '00:00', pricePerHour: 20_000 });
    expect(priceForRange(court, [sabadoNoite], TZ, new Date('2026-11-21T23:00:00-03:00'), 60)).toBe(20_000);
  });

  it('duração que não fecha o slot cobra só a fração final', () => {
    expect(priceForRange(court, [nobre], TZ, tuesday('17:00'), 90)).toBe(10_000 + 7_500);
  });
});
