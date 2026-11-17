import { describe, expect, it } from 'vitest';
import { utcToZoned, zonedDateTimeToUtc } from '../../src/shared/utils/timezone';
import { addDays, dayBounds, daysOfMonth, nextMonth, overlapMinutes, previousMonth, todayIn } from '../../src/modules/admin/admin-time';

const SP = 'America/Sao_Paulo'; // UTC−3 fixo (sem horário de verão desde 2019)
const NY = 'America/New_York'; // horário de verão em 2026: 08/03 e 01/11
const at = (iso: string) => new Date(iso);
const HOUR = 3_600_000;

describe('zonedDateTimeToUtc (local → UTC)', () => {
  it('18:00 em São Paulo = 21:00Z', () => {
    expect(zonedDateTimeToUtc('2026-11-12', 18 * 60, SP)).toEqual(at('2026-11-12T21:00:00Z'));
  });

  it('meia-noite local = 03:00Z do mesmo dia', () => {
    expect(zonedDateTimeToUtc('2026-11-12', 0, SP)).toEqual(at('2026-11-12T03:00:00Z'));
  });

  it('1440 minutos = meia-noite do dia seguinte', () => {
    expect(zonedDateTimeToUtc('2026-11-12', 1440, SP)).toEqual(at('2026-11-13T03:00:00Z'));
  });

  it('21:30 local já é o dia seguinte em UTC (virada de dia)', () => {
    expect(zonedDateTimeToUtc('2026-12-31', 21 * 60 + 30, SP)).toEqual(at('2027-01-01T00:30:00Z'));
  });

  it('UTC puro não desloca nada', () => {
    expect(zonedDateTimeToUtc('2026-11-12', 600, 'UTC')).toEqual(at('2026-11-12T10:00:00Z'));
  });

  it('usa o fuso correto em cada lado da mudança de horário', () => {
    // Antes da mudança (EST, −5) e depois (EDT, −4) no mesmo dia
    expect(zonedDateTimeToUtc('2026-03-08', 60, NY)).toEqual(at('2026-03-08T06:00:00Z'));
    expect(zonedDateTimeToUtc('2026-03-08', 600, NY)).toEqual(at('2026-03-08T14:00:00Z'));
    expect(zonedDateTimeToUtc('2026-11-01', 600, NY)).toEqual(at('2026-11-01T15:00:00Z'));
  });

  it('recalcula quando o 1º palpite cai do outro lado da mudança', () => {
    // 04:00 local: o palpite (04:00Z) ainda é EST, mas 04:00 EDT = 08:00Z
    expect(zonedDateTimeToUtc('2026-03-08', 240, NY)).toEqual(at('2026-03-08T08:00:00Z'));
    // 01:30 do dia em que o relógio volta: a 1ª ocorrência (EDT) é 05:30Z
    expect(utcToZoned(zonedDateTimeToUtc('2026-11-01', 90, NY), NY)).toEqual({ date: '2026-11-01', minutesOfDay: 90 });
  });
});

describe('utcToZoned (UTC → local)', () => {
  it('02:30Z ainda é o dia anterior em São Paulo', () => {
    expect(utcToZoned(at('2026-11-13T02:30:00Z'), SP)).toEqual({ date: '2026-11-12', minutesOfDay: 23 * 60 + 30 });
  });

  it('03:00Z é a meia-noite local', () => {
    expect(utcToZoned(at('2026-11-13T03:00:00Z'), SP)).toEqual({ date: '2026-11-13', minutesOfDay: 0 });
  });

  it('segundos e milissegundos não mudam o minuto', () => {
    expect(utcToZoned(at('2026-11-12T21:00:59.999Z'), SP)).toEqual({ date: '2026-11-12', minutesOfDay: 18 * 60 });
  });

  it('ida e volta preserva o instante', () => {
    for (const minutes of [0, 359, 360, 1079, 1439]) {
      const utc = zonedDateTimeToUtc('2026-07-04', minutes, NY);
      expect(utcToZoned(utc, NY)).toEqual({ date: '2026-07-04', minutesOfDay: minutes });
    }
  });
});

describe('dias com mudança de horário de verão', () => {
  it('início do horário de verão: dia de 23 h', () => {
    const { start, end } = dayBounds('2026-03-08', NY);
    expect(start).toEqual(at('2026-03-08T05:00:00Z'));
    expect(end).toEqual(at('2026-03-09T04:00:00Z'));
    expect(end.getTime() - start.getTime()).toBe(23 * HOUR);
  });

  it('fim do horário de verão: dia de 25 h', () => {
    const { start, end } = dayBounds('2026-11-01', NY);
    expect(end.getTime() - start.getTime()).toBe(25 * HOUR);
  });

  it('dia comum: 24 h', () => {
    const { start, end } = dayBounds('2026-11-17', SP);
    expect(end.getTime() - start.getTime()).toBe(24 * HOUR);
  });
});

describe('calendário da arena (admin-time)', () => {
  it('addDays atravessa mês e ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('todayIn usa o fuso da arena', () => {
    expect(todayIn(SP, at('2026-11-18T02:00:00Z'))).toBe('2026-11-17');
  });

  it('daysOfMonth respeita o tamanho de cada mês', () => {
    expect(daysOfMonth('2026-02')).toHaveLength(28);
    expect(daysOfMonth('2028-02')).toHaveLength(29);
    expect(daysOfMonth('2026-11').at(-1)).toBe('2026-11-30');
  });

  it('próximo / anterior atravessam o ano', () => {
    expect(nextMonth('2026-12')).toBe('2027-01');
    expect(nextMonth('2026-01')).toBe('2026-02');
    expect(previousMonth('2026-01')).toBe('2025-12');
    expect(previousMonth('2026-03')).toBe('2026-02');
  });

  it('overlapMinutes: interseção em minutos, zero se não encostam', () => {
    const a = [at('2026-11-17T10:00Z'), at('2026-11-17T12:00Z')] as const;
    expect(overlapMinutes(...a, at('2026-11-17T11:30Z'), at('2026-11-17T15:00Z'))).toBe(30);
    expect(overlapMinutes(...a, at('2026-11-17T12:00Z'), at('2026-11-17T15:00Z'))).toBe(0);
    expect(overlapMinutes(...a, at('2026-11-17T09:00Z'), at('2026-11-17T13:00Z'))).toBe(120);
  });
});
