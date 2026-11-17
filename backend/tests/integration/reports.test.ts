import { describe, expect, it } from 'vitest';
import { ReportsService } from '../../src/modules/admin/reports.service';
import { makeArena, makeBooking, makeCourt, makeUser } from './helpers/factories';

/**
 * Cenário montado à mão (março/2026, São Paulo, 31 dias), conferido na mão:
 *
 * Quadra 08:00–20:00, slots de 60 min → 720 min/dia × 31 = 22.320 min reserváveis
 *   10/03 18–19h  paga           R$ 100
 *   11/03 18–20h  paga           R$ 200
 *   12/03 09–10h  aguardando     R$  80  (ocupa, mas não é faturamento)
 *   13/03 18–19h  cancelada/estornada   (não conta em nada)
 *   15/03 06–12h  manutenção     → só 08–12h cai no funcionamento = 240 min
 *   20/02 18–19h  paga           R$ 150  (mês anterior)
 *
 * Faturamento: 300 (2 pagas, ticket médio 150), +100% sobre fevereiro, 80 pendente.
 * Ocupação: 240 min ocupados ÷ (22.320 − 240) = 1,09% → 1,1%.
 * Pico: 18h = 120 min ÷ (60 × 31) = 6,5%; 9h e 19h = 3,2%.
 */
const SP = (iso: string) => new Date(`${iso}-03:00`);
const NOW = SP('2026-03-05T12:00:00');

async function scenario() {
  const admin = await makeUser({ role: 'ARENA_ADMIN' });
  const arena = await makeArena({ ownerId: admin.id });
  const court = await makeCourt({ arenaId: arena.id, openTime: '08:00', closeTime: '20:00', slotDurationMin: 60 });
  const customer = await makeUser();
  const book = (start: string, end: string, extra: Parameters<typeof makeBooking>[0] extends infer T ? Partial<T> : never) =>
    makeBooking({ courtId: court.id, userId: customer.id, startTime: SP(start), endTime: SP(end), ...extra });

  await book('2026-03-10T18:00:00', '2026-03-10T19:00:00', { totalPrice: 10_000 });
  await book('2026-03-11T18:00:00', '2026-03-11T20:00:00', { totalPrice: 20_000 });
  await book('2026-03-12T09:00:00', '2026-03-12T10:00:00', {
    totalPrice: 8_000,
    status: 'PENDING_PAYMENT',
    paymentStatus: 'PENDING',
    expiresAt: new Date(NOW.getTime() + 15 * 60_000),
  });
  await book('2026-03-13T18:00:00', '2026-03-13T19:00:00', { totalPrice: 10_000, status: 'CANCELLED', paymentStatus: 'REFUNDED' });
  await makeBooking({
    courtId: court.id,
    userId: admin.id,
    type: 'MAINTENANCE',
    startTime: SP('2026-03-15T06:00:00'),
    endTime: SP('2026-03-15T12:00:00'),
    totalPrice: 0,
  });
  await book('2026-02-20T18:00:00', '2026-02-20T19:00:00', { totalPrice: 15_000 });

  return { admin, arena, court };
}

describe('relatórios do mês', () => {
  it('faturamento', async () => {
    const { admin } = await scenario();
    const report = await new ReportsService().getReports(admin.id, { month: '2026-03' }, NOW);

    expect(report.revenue).toMatchObject({
      total: 30_000,
      previousMonth: 15_000,
      changeRate: 100,
      pending: 8_000,
      paidBookings: 2,
      averageTicket: 15_000,
    });
    expect(report.revenue.byDay).toHaveLength(31);
    expect(report.revenue.byDay.filter((d) => d.revenue > 0)).toEqual([
      { date: '2026-03-10', revenue: 10_000 },
      { date: '2026-03-11', revenue: 20_000 },
    ]);
  });

  it('ocupação com o bloqueio descontado só dentro do horário de funcionamento', async () => {
    const { admin, court } = await scenario();
    const { occupancy } = await new ReportsService().getReports(admin.id, { month: '2026-03' }, NOW);

    expect(occupancy).toMatchObject({ rate: 1.1, bookedHours: 4, availableHours: 368 });
    expect(occupancy.byCourt).toEqual([
      expect.objectContaining({ courtId: court.id, bookedHours: 4, blockedHours: 4, occupancyRate: 1.1, revenue: 30_000 }),
    ]);
  });

  it('horários de pico', async () => {
    const { admin } = await scenario();
    const { peakHours } = await new ReportsService().getReports(admin.id, { month: '2026-03' }, NOW);

    // Só as horas em que a quadra funciona (08h–19h)
    expect(peakHours.byHour.map((h) => h.hour)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(peakHours.byHour.find((h) => h.hour === 18)).toEqual({ hour: 18, bookedHours: 2, occupancyRate: 6.5 });
    expect(peakHours.byHour.find((h) => h.hour === 19)).toEqual({ hour: 19, bookedHours: 1, occupancyRate: 3.2 });
    expect(peakHours.byHour.find((h) => h.hour === 9)).toEqual({ hour: 9, bookedHours: 1, occupancyRate: 3.2 });
    // Empate em 9h e 19h: mantém a ordem do dia
    expect(peakHours.top).toEqual([18, 9, 19]);
  });

  it('mês anterior sem faturamento: variação indefinida (null)', async () => {
    const { admin } = await scenario();
    const report = await new ReportsService().getReports(admin.id, { month: '2026-02' }, NOW);
    expect(report.revenue).toMatchObject({ total: 15_000, previousMonth: 0, changeRate: null });
  });

  it('resumo de hoje', async () => {
    const { admin } = await scenario();
    const report = await new ReportsService().getReports(admin.id, {}, SP('2026-03-10T08:00:00'));
    expect(report.month).toBe('2026-03');
    expect(report.today).toEqual({ date: '2026-03-10', bookings: 1, classes: 0, paidRevenue: 10_000, pendingPayments: 0 });
  });
});
