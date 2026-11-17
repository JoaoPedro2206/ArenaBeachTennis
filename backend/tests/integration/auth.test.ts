import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/shared/database/prisma';
import { makeUser } from './helpers/factories';

const app = createApp();
const api = '/api/v1/auth';

describe('cadastro', () => {
  it('mesmo e-mail em dois cadastros simultâneos: um 201 e um 409 amigável', async () => {
    const body = { name: 'Maria Silva', email: 'maria@teste.local', password: 'Senha1234' };

    const responses = await Promise.all([
      request(app).post(`${api}/register`).send(body),
      request(app).post(`${api}/register`).send(body),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(responses.find((r) => r.status === 409)!.body).toMatchObject({ code: 'CONFLICT', message: 'E-mail já cadastrado' });
    expect(await prisma.user.count({ where: { email: 'maria@teste.local' } })).toBe(1);
  });

  it('e-mail normalizado: maiúsculas e espaços não criam conta duplicada', async () => {
    await makeUser({ email: 'joao@teste.local' });
    const res = await request(app).post(`${api}/register`).send({ name: 'João', email: '  JOAO@Teste.local ', password: 'Senha1234' });
    expect(res.status).toBe(409);
  });
});

describe('login', () => {
  it('e-mail inexistente e senha errada têm exatamente a mesma resposta', async () => {
    await makeUser({ email: 'existe@teste.local' });

    const wrongPassword = await request(app).post(`${api}/login`).send({ email: 'existe@teste.local', password: 'Errada123' });
    const unknownEmail = await request(app).post(`${api}/login`).send({ email: 'ninguem@teste.local', password: 'Errada123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(wrongPassword.body.message).toBe('E-mail ou senha inválidos');
  });

  it('senha certa entra e devolve um token que funciona', async () => {
    await makeUser({ email: 'certo@teste.local' });
    const login = await request(app).post(`${api}/login`).send({ email: 'certo@teste.local', password: 'Senha1234' });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/v1/users/me').set({ Authorization: `Bearer ${login.body.accessToken}` });
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('certo@teste.local');
  });

  it('conta desativada não entra (mesma resposta genérica)', async () => {
    await makeUser({ email: 'inativo@teste.local', isActive: false });
    const res = await request(app).post(`${api}/login`).send({ email: 'inativo@teste.local', password: 'Senha1234' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('E-mail ou senha inválidos');
  });
});
