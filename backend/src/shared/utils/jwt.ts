import jwt, { type SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../../config/env';

export interface AccessTokenPayload {
  sub: string; // id do usuário
  role: UserRole;
  /** User.tokenVersion no momento da emissão (tokens antigos sem o campo valem 0) */
  tokenVersion: number;
}

const ALGORITHM = 'HS256';
const ISSUER = 'arenabeach-api';

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign({ role: payload.role, tv: payload.tokenVersion }, env.JWT_SECRET, {
    subject: payload.sub,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    algorithm: ALGORITHM,
    issuer: ISSUER,
  });
}

/**
 * Verifica assinatura, expiração, algoritmo e emissor.
 * Lança TokenExpiredError / JsonWebTokenError, que o errorHandler
 * global converte em 401.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: [ALGORITHM],
    issuer: ISSUER,
  });

  if (typeof decoded === 'string' || !decoded.sub) {
    throw new jwt.JsonWebTokenError('Payload do token inválido');
  }

  return {
    sub: decoded.sub,
    role: decoded.role as UserRole,
    tokenVersion: typeof decoded.tv === 'number' ? decoded.tv : 0,
  };
}
