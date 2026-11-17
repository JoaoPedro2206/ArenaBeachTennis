import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const findAuthInfo = vi.hoisted(() => vi.fn());
vi.mock('../src/modules/users/users.repository', () => ({
  UsersRepository: class {
    findAuthInfo = findAuthInfo;
  },
}));

import { ensureAuthenticated } from '../src/shared/middlewares/ensureAuthenticated';
import { ensureEmailVerified } from '../src/shared/middlewares/ensureEmailVerified';
import { signAccessToken, verifyAccessToken } from '../src/shared/utils/jwt';
import { env } from '../src/config/env';

async function authenticate(token: string): Promise<Request> {
  const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
  await ensureAuthenticated(req, {} as never, () => undefined);
  return req;
}

describe('invalidação de sessões (tokenVersion)', () => {
  beforeEach(() => findAuthInfo.mockReset());

  it('token emitido na versão atual é aceito', async () => {
    findAuthInfo.mockResolvedValue({ id: 'u1', role: 'PLAYER', isActive: true, tokenVersion: 2, emailVerifiedAt: null });
    const req = await authenticate(signAccessToken({ sub: 'u1', role: 'PLAYER', tokenVersion: 2 }));
    expect(req.user).toEqual({ id: 'u1', role: 'PLAYER', emailVerified: false });
  });

  it('após redefinir a senha (tokenVersion++), o JWT antigo deixa de valer', async () => {
    const oldToken = signAccessToken({ sub: 'u1', role: 'PLAYER', tokenVersion: 0 });
    findAuthInfo.mockResolvedValue({ id: 'u1', role: 'PLAYER', isActive: true, tokenVersion: 1, emailVerifiedAt: null });
    await expect(authenticate(oldToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('JWT legado sem o campo tv equivale à versão 0', () => {
    const legacy = jwt.sign({ role: 'PLAYER' }, env.JWT_SECRET, { subject: 'u1', issuer: 'arenabeach-api', algorithm: 'HS256' });
    expect(verifyAccessToken(legacy).tokenVersion).toBe(0);
  });
});

describe('ensureEmailVerified', () => {
  const run = (user: unknown) => {
    const next = vi.fn();
    const call = () => ensureEmailVerified({ user } as Request, {} as never, next);
    return { next, call };
  };

  it('bloqueia e-mail não confirmado com 403 EMAIL_NOT_VERIFIED', () => {
    const { call } = run({ id: 'u1', role: 'PLAYER', emailVerified: false });
    expect(call).toThrowError(expect.objectContaining({ statusCode: 403, code: 'EMAIL_NOT_VERIFIED' }));
  });

  it('libera e-mail confirmado', () => {
    const { call, next } = run({ id: 'u1', role: 'PLAYER', emailVerified: true });
    call();
    expect(next).toHaveBeenCalled();
  });
});
