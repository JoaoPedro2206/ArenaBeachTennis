import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AuthController, FORGOT_PASSWORD_MESSAGE } from '../src/modules/auth/auth.controller';
import { buildAuthRoutes } from '../src/modules/auth/auth.routes';
import { AuthService } from '../src/modules/auth/auth.service';
import { errorHandler, notFoundHandler } from '../src/shared/middlewares/errorHandler';
import { FakeDb, FakeMailer } from './helpers/fakes';

function setup(limits = { credentials: 50, forgotPassword: 50, tokenRedeem: 50, resendVerification: 50 }) {
  const db = new FakeDb();
  const mailer = new FakeMailer();
  const service = new AuthService({
    users: db.usersPort,
    tokens: db.tokensStore,
    mailer,
    hashPassword: async (p) => `hashed:${p}`,
  });
  const app = express();
  app.use(express.json());
  app.use('/auth', buildAuthRoutes(new AuthController(service), limits));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, db, mailer };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('POST /auth/forgot-password', () => {
  it('responde 202 com corpo idêntico para e-mail existente e inexistente', async () => {
    const { app, db, mailer } = setup();
    db.addUser({ email: 'maria@x.com' });

    const exists = await request(app).post('/auth/forgot-password').send({ email: 'maria@x.com' });
    const missing = await request(app).post('/auth/forgot-password').send({ email: 'ninguem@x.com' });
    await flush();

    expect(exists.status).toBe(202);
    expect(missing.status).toBe(202);
    expect(exists.body).toEqual({ message: FORGOT_PASSWORD_MESSAGE });
    expect(missing.body).toEqual(exists.body);
    expect(mailer.sent).toHaveLength(1); // só a conta existente recebeu e-mail
  });

  it('o 202 não espera o envio do e-mail (tempo indistinguível)', async () => {
    const { app, db, mailer } = setup();
    db.addUser({ email: 'maria@x.com' });
    vi.spyOn(mailer, 'send').mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 400)));

    const started = Date.now();
    const res = await request(app).post('/auth/forgot-password').send({ email: 'maria@x.com' });
    expect(res.status).toBe(202);
    expect(Date.now() - started).toBeLessThan(300);
  });

  it('e-mail malformado: 422', async () => {
    const { app } = setup();
    const res = await request(app).post('/auth/forgot-password').send({ email: 'nao-e-email' });
    expect(res.status).toBe(422);
  });

  it('rate limit por IP: 429 depois do limite, igual para qualquer e-mail', async () => {
    const { app } = setup({ credentials: 50, forgotPassword: 3, tokenRedeem: 50, resendVerification: 50 });
    for (let i = 0; i < 3; i++) {
      const ok = await request(app).post('/auth/forgot-password').send({ email: `u${i}@x.com` });
      expect(ok.status).toBe(202);
    }
    const blocked = await request(app).post('/auth/forgot-password').send({ email: 'maria@x.com' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('TOO_MANY_REQUESTS');
  });

  it('rate limit por e-mail não muda a resposta (continua 202, sem novo e-mail)', async () => {
    const { app, db, mailer } = setup();
    db.addUser({ email: 'maria@x.com' });
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/auth/forgot-password').send({ email: 'maria@x.com' });
      expect(res.status).toBe(202);
    }
    await flush();
    expect(mailer.sent).toHaveLength(3);
  });
});

describe('POST /auth/reset-password', () => {
  it('fluxo completo + reuso do link retorna 400 LINK_USED', async () => {
    const { app, db, mailer } = setup();
    const user = db.addUser({ email: 'maria@x.com' });
    await request(app).post('/auth/forgot-password').send({ email: 'maria@x.com' });
    await flush();
    const token = mailer.lastToken();

    const ok = await request(app).post('/auth/reset-password').send({ token, password: 'NovaSenha1' });
    expect(ok.status).toBe(200);
    expect(user.tokenVersion).toBe(1);

    const again = await request(app).post('/auth/reset-password').send({ token, password: 'NovaSenha1' });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('LINK_USED');
  });

  it('token inválido: 400 LINK_INVALID; senha fraca: 422', async () => {
    const { app } = setup();
    const invalid = await request(app).post('/auth/reset-password').send({ token: 'a'.repeat(43), password: 'NovaSenha1' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('LINK_INVALID');

    const weak = await request(app).post('/auth/reset-password').send({ token: 'a'.repeat(43), password: 'curta' });
    expect(weak.status).toBe(422);
  });
});
