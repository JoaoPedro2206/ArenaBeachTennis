import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UsersRepository } from '../../modules/users/users.repository';

const usersRepository = new UsersRepository();

/**
 * Para rotas públicas que mostram algo a mais para quem está logado
 * (ex.: "você já está inscrito nesta aula"). Nunca bloqueia: token ausente
 * ou inválido simplesmente segue como visitante.
 */
export const optionalAuthenticated: RequestHandler = async (req, _res, next) => {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) return next();

  try {
    const { sub, tokenVersion } = verifyAccessToken(token);
    const user = await usersRepository.findAuthInfo(sub);
    if (user?.isActive && user.tokenVersion === tokenVersion) {
      req.user = { id: user.id, role: user.role, emailVerified: user.emailVerifiedAt !== null };
    }
  } catch {
    /* visitante */
  }
  next();
};
