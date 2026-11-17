import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/shared/database/prisma';
import { ConflictError } from '../../src/shared/errors/AppError';
import { BookingsRepository } from '../../src/modules/bookings/bookings.repository';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { CANCELLATION_REASONS } from '../../src/modules/bookings/booking-policy';
import { authHeader, localSlot, makeBooking, makeCourt, makeUser } from './helpers/factories';

const app = createApp();
const repo = new BookingsRepository();
const MINUTE = 60_000;

/** Estados finais aceitáveis de uma reserva: nunca "paga e cancelada como não paga" */
function assertCoherent(b: { status: string; paymentStatus: string; paidAt: Date | null; cancelledAt: Date | null }) {
  const state = `${b.status}/${b.paymentStatus}/${b.paidAt ? 'pago' : 'não pago'}`;
  expect(['CONFIRMED/PAID/pago', 'CANCELLED/FAILED/não pago', 'CANCELLED/REFUNDED/pago', 'PENDING_PAYMENT/PENDING/não pago']).toContain(
    state,
  );
  if (b.status === 'CANCELLED') expect(b.cancelledAt).not.toBeNull();
}

describe('POST /bookings — concorrência no mesmo horário', () => {
  it('duas reservas simultâneas: uma 201 e uma 409, e só uma fica no banco', async () => {
    const court = await makeCourt();
    const [ana, bia] = await Promise.all([makeUser(), makeUser()]);
    const body = { courtId: court.id, startTime: localSlot(2, 10 * 60).toISOString() };

    const responses = await Promise.all([
      request(app).post('/api/v1/bookings').set(authHeader(ana)).send(body),
      request(app).post('/api/v1/bookings').set(authHeader(bia)).send(body),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(responses.find((r) => r.status === 409)!.body.code).toBe('CONFLICT');
    expect(await prisma.booking.count({ where: { courtId: court.id, status: { not: 'CANCELLED' } } })).toBe(1);
  });

  it('muitas reservas simultâneas: exatamente uma vence', async () => {
    const court = await makeCourt();
    const users = await Promise.all(Array.from({ length: 8 }, () => makeUser()));
    const body = { courtId: court.id, startTime: localSlot(3, 15 * 60).toISOString() };

    const responses = await Promise.all(users.map((u) => request(app).post('/api/v1/bookings').set(authHeader(u)).send(body)));

    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(7);
  });
});

describe('constraint bookings_no_overlap (sem a checagem do service)', () => {
  const base = async () => {
    const court = await makeCourt();
    const user = await makeUser();
    const start = localSlot(2, 10 * 60);
    const data = (offsetMin: number, durationMin = 60) => ({
      courtId: court.id,
      userId: user.id,
      startTime: new Date(start.getTime() + offsetMin * MINUTE),
      endTime: new Date(start.getTime() + (offsetMin + durationMin) * MINUTE),
      totalPrice: 10_000,
    });
    return { court, user, data };
  };

  it('o banco barra a segunda inserção simultânea com erro amigável', async () => {
    const { data } = await base();
    const results = await Promise.allSettled([repo.create(data(0)), repo.create(data(0))]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
    expect(rejected.reason.message).toBe('Este horário acabou de ser reservado por outra pessoa');
  });

  it('sobreposição parcial também é barrada; encostar não é', async () => {
    const { data } = await base();
    await repo.create(data(0));
    await expect(repo.create(data(30))).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.create(data(-30))).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.create(data(60))).resolves.toBeDefined();
    await expect(repo.create(data(-60))).resolves.toBeDefined();
  });

  it('reserva cancelada não ocupa o horário', async () => {
    const { data } = await base();
    const first = await repo.create(data(0));
    await prisma.booking.update({ where: { id: first.id }, data: { status: 'CANCELLED' } });
    await expect(repo.create(data(0))).resolves.toBeDefined();
  });
});

describe('pagamento × expiração', () => {
  it('confirmPayment e expireOverdue concorrentes: sempre um OU outro', async () => {
    const user = await makeUser();
    const court = await makeCourt();
    const createdAt = new Date();
    const deadline = new Date(createdAt.getTime() + 15 * MINUTE);

    for (let i = 0; i < 15; i++) {
      const booking = await makeBooking({
        courtId: court.id,
        userId: user.id,
        startTime: localSlot(1 + i, 10 * 60),
        status: 'PENDING_PAYMENT',
        paymentStatus: 'PENDING',
        expiresAt: deadline,
      });

      // Pagamento 1 ms antes do prazo × varredura exatamente no prazo
      const [paid] = await Promise.all([
        repo.confirmPayment(booking.id, user.id, new Date(deadline.getTime() - 1), `sim_${i}`),
        repo.expireOverdue(deadline, court.id),
      ]);

      const final = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      assertCoherent(final);
      if (paid) {
        expect(final).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID', expiresAt: null, cancellationReason: null });
      } else {
        expect(final).toMatchObject({ status: 'CANCELLED', paymentStatus: 'FAILED', cancellationReason: CANCELLATION_REASONS.paymentExpired });
      }
    }
  });

  it('pagar depois do prazo: 410 e o horário é liberado', async () => {
    const user = await makeUser();
    const court = await makeCourt();
    const now = new Date();
    const booking = await makeBooking({
      courtId: court.id,
      userId: user.id,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      expiresAt: new Date(now.getTime() - 1),
    });

    await expect(new BookingsService().pay(user.id, booking.id, now)).rejects.toMatchObject({ statusCode: 410, code: 'BOOKING_EXPIRED' });
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).toMatchObject({
      status: 'CANCELLED',
      cancellationReason: CANCELLATION_REASONS.paymentExpired,
    });
  });

  it('pagar duas vezes é idempotente', async () => {
    const user = await makeUser();
    const court = await makeCourt();
    const booking = await makeBooking({
      courtId: court.id,
      userId: user.id,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * MINUTE),
    });
    const service = new BookingsService();
    const first = await service.pay(user.id, booking.id);
    const second = await service.pay(user.id, booking.id);
    expect(second.paidAt).toEqual(first.paidAt);
  });
});

describe('cancelamento × pagamento (regressão: cancel com expectedStatus)', () => {
  const pendingBooking = async () => {
    const user = await makeUser();
    const court = await makeCourt();
    const booking = await makeBooking({
      courtId: court.id,
      userId: user.id,
      startTime: localSlot(3, 10 * 60), // > 24h: cancelar uma paga também é permitido
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      expiresAt: new Date(Date.now() + 15 * MINUTE),
    });
    return { user, booking };
  };

  it('pagamento entre a leitura e a gravação do cancelamento: cancelamento recusa (409) e a reserva continua paga', async () => {
    const { user, booking } = await pendingBooking();

    /** Reproduz a janela do bug: o pagamento cai logo antes do UPDATE do cancelamento */
    class RacingRepo extends BookingsRepository {
      override async cancel(...args: Parameters<BookingsRepository['cancel']>) {
        await repo.confirmPayment(booking.id, user.id, new Date(), 'sim_corrida');
        return super.cancel(...args);
      }
    }

    await expect(new BookingsService(undefined, new RacingRepo()).cancel(user.id, booking.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    const final = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(final).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID', cancelledAt: null });
  });

  it('repository.cancel com status esperado desatualizado não altera nada', async () => {
    const { user, booking } = await pendingBooking();
    await repo.confirmPayment(booking.id, user.id, new Date(), 'sim');

    const result = await repo.cancel(booking.id, {
      now: new Date(),
      reason: CANCELLATION_REASONS.userCancelled,
      refund: false,
      expectedStatus: 'PENDING_PAYMENT',
    });
    expect(result).toBeNull();
    assertCoherent(await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }));
  });

  it('cancelar e pagar ao mesmo tempo: estado final sempre coerente', async () => {
    const service = new BookingsService();
    for (let i = 0; i < 10; i++) {
      const { user, booking } = await pendingBooking();
      const [cancel, pay] = await Promise.allSettled([service.cancel(user.id, booking.id), service.pay(user.id, booking.id)]);

      const final = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
      assertCoherent(final);
      // Pelo menos uma das operações teve efeito
      expect(cancel.status === 'fulfilled' || pay.status === 'fulfilled').toBe(true);
      if (final.status === 'CONFIRMED') expect(pay.status).toBe('fulfilled');
      if (final.paymentStatus === 'REFUNDED') expect(cancel.status).toBe('fulfilled');
    }
  });
});
