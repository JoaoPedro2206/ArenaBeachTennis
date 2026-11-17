import type { Prisma } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/shared/database/prisma';
import { AdminRepository } from '../../src/modules/admin/admin.repository';
import { AdminService } from '../../src/modules/admin/admin.service';
import { authHeader, localSlot, makeArena, makeBooking, makeCourt, makeUser } from './helpers/factories';

const app = createApp();
const api = '/api/v1/admin';
const UUID = '6f1c2b8a-3f7e-4b8e-9a51-2f0c8d4e7a10';

/** Todas as rotas do painel, com um corpo plausível */
const ADMIN_ROUTES: Array<[method: 'get' | 'post' | 'delete' | 'patch' | 'put', path: string, body?: object]> = [
  ['get', '/agenda'],
  ['post', '/block', {}],
  ['delete', `/block/${UUID}`],
  ['patch', `/courts/${UUID}/status`, { status: 'MAINTENANCE' }],
  ['get', '/pricing'],
  ['put', '/pricing', { courts: [], rules: [] }],
  ['get', '/reports'],
];

async function adminWithCourt() {
  const admin = await makeUser({ role: 'ARENA_ADMIN' });
  const arena = await makeArena({ ownerId: admin.id });
  const court = await makeCourt({ arenaId: arena.id });
  return { admin, arena, court };
}

describe('autorização do painel /admin', () => {
  it.each(ADMIN_ROUTES)('%s %s: 401 sem login', async (method, path, body) => {
    const res = await request(app)[method](api + path).send(body);
    expect(res.status).toBe(401);
  });

  it.each(['PLAYER', 'TEACHER', 'SUPER_ADMIN'] as const)('%s recebe 403 em todas as rotas', async (role) => {
    const user = await makeUser({ role });
    for (const [method, path, body] of ADMIN_ROUTES) {
      const res = await request(app)[method](api + path).set(authHeader(user)).send(body);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
    }
  });

  it('admin rebaixado perde o acesso na hora (role vem do banco, não do token)', async () => {
    const { admin } = await adminWithCourt();
    const header = authHeader(admin);
    expect((await request(app).get(`${api}/pricing`).set(header)).status).toBe(200);
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'PLAYER' } });
    expect((await request(app).get(`${api}/pricing`).set(header)).status).toBe(403);
  });
});

describe('isolamento entre arenas', () => {
  it('admin A não enxerga nem altera a arena do admin B', async () => {
    const a = await adminWithCourt();
    const b = await adminWithCourt();
    const asA = authHeader(a.admin);

    expect((await request(app).get(`${api}/agenda?arenaId=${b.arena.id}`).set(asA)).status).toBe(404);
    expect((await request(app).get(`${api}/pricing?arenaId=${b.arena.id}`).set(asA)).status).toBe(404);
    expect((await request(app).get(`${api}/reports?arenaId=${b.arena.id}`).set(asA)).status).toBe(404);

    // Sem arenaId, A só vê a própria arena
    const agenda = await request(app).get(`${api}/agenda`).set(asA);
    expect(agenda.body.arena.id).toBe(a.arena.id);
    expect(agenda.body.courts.map((c: { id: string }) => c.id)).toEqual([a.court.id]);

    // Quadra de B usada a partir da arena de A
    const block = await request(app)
      .post(`${api}/block`)
      .set(asA)
      .send({ courtId: b.court.id, startTime: localSlot(2, 600).toISOString(), endTime: localSlot(2, 720).toISOString() });
    expect(block.status).toBe(404);

    const status = await request(app).patch(`${api}/courts/${b.court.id}/status`).set(asA).send({ status: 'MAINTENANCE' });
    expect(status.status).toBe(404);

    const pricing = await request(app)
      .put(`${api}/pricing`)
      .set(asA)
      .send({ courts: [{ courtId: b.court.id, pricePerHour: 1 }], rules: [] });
    expect(pricing.status).toBe(422);

    const untouched = await prisma.court.findUniqueOrThrow({ where: { id: b.court.id } });
    expect(untouched).toMatchObject({ status: 'ACTIVE', pricePerHour: 10_000 });
    expect(await prisma.booking.count({ where: { courtId: b.court.id } })).toBe(0);
  });
});

describe('bloqueios', () => {
  it('recusa bloquear período com reserva de cliente (409 com a lista)', async () => {
    const { admin, court } = await adminWithCourt();
    const customer = await makeUser();
    await makeBooking({ courtId: court.id, userId: customer.id, startTime: localSlot(2, 10 * 60) });

    const res = await request(app)
      .post(`${api}/block`)
      .set(authHeader(admin))
      .send({ courtId: court.id, startTime: localSlot(2, 8 * 60).toISOString(), endTime: localSlot(2, 12 * 60).toISOString() });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BLOCK_CONFLICT');
    expect(res.body.details.conflicts).toEqual([expect.stringMatching(/ 10:00–11:00$/)]);
    expect(await prisma.booking.count({ where: { courtId: court.id, type: 'MAINTENANCE' } })).toBe(0);
  });

  it('bloqueia período livre e recusa bloqueio sobreposto', async () => {
    const { admin, court } = await adminWithCourt();
    const body = { courtId: court.id, startTime: localSlot(2, 8 * 60).toISOString(), endTime: localSlot(2, 12 * 60).toISOString() };

    expect((await request(app).post(`${api}/block`).set(authHeader(admin)).send(body)).status).toBe(201);
    const again = await request(app).post(`${api}/block`).set(authHeader(admin)).send(body);
    expect(again.status).toBe(409);
    expect(again.body.message).toBe('Já existe um bloqueio de manutenção nesse período');
  });

  it('data malformada é 422, não 500 (regressão)', async () => {
    const { admin, court } = await adminWithCourt();
    const res = await request(app)
      .post(`${api}/block`)
      .set(authHeader(admin))
      .send({ courtId: court.id, startTime: '2026-11-20T08:00:00', endTime: localSlot(2, 720).toISOString() });
    expect(res.status).toBe(422);
  });
});

describe('PUT /admin/pricing', () => {
  const nobre = { name: 'Nobre', courtId: null, daysOfWeek: [1, 2, 3, 4, 5], startTime: '18:00', endTime: '22:00', pricePerHour: 15_000 };

  it('substitui preço base e regras de uma vez', async () => {
    const { admin, arena, court } = await adminWithCourt();
    await prisma.pricingRule.create({ data: { ...nobre, name: 'Antiga', arenaId: arena.id } });

    const res = await request(app)
      .put(`${api}/pricing`)
      .set(authHeader(admin))
      .send({ courts: [{ courtId: court.id, pricePerHour: 12_000 }], rules: [nobre] });

    expect(res.status).toBe(200);
    expect(res.body.courts[0].pricePerHour).toBe(12_000);
    expect(res.body.rules.map((r: { name: string }) => r.name)).toEqual(['Nobre']);
  });

  it('falha no meio da transação: nada é aplicado', async () => {
    const { admin, arena, court } = await adminWithCourt();
    await prisma.pricingRule.create({ data: { ...nobre, name: 'Antiga', arenaId: arena.id } });

    /** Deixa o preço base e o deleteMany passarem e derruba o createMany das regras */
    class FailingRepo extends AdminRepository {
      override transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        return super.transaction((tx) =>
          work(
            new Proxy(tx, {
              get(target, prop, receiver) {
                if (prop !== 'pricingRule') return Reflect.get(target, prop, receiver);
                return {
                  deleteMany: (args: Prisma.PricingRuleDeleteManyArgs) => target.pricingRule.deleteMany(args),
                  createMany: () => Promise.reject(new Error('falha simulada no meio da transação')),
                };
              },
            }),
          ),
        );
      }
    }

    const service = new AdminService(new FailingRepo());
    await expect(
      service.updatePricing(admin.id, undefined, { courts: [{ courtId: court.id, pricePerHour: 1 }], rules: [nobre] }),
    ).rejects.toThrow('falha simulada');

    expect((await prisma.court.findUniqueOrThrow({ where: { id: court.id } })).pricePerHour).toBe(10_000);
    expect((await prisma.pricingRule.findMany({ where: { arenaId: arena.id } })).map((r) => r.name)).toEqual(['Antiga']);
  });
});
