import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../errors/AppError';
import { verifyAccessToken } from '../utils/jwt';
import { UsersRepository } from '../../modules/users/users.repository';

const usersRepository = new UsersRepository();

/**
 * Protege rotas privadas. Espera o header:
 *   Authorization: Bearer <token>
 *
 * Além de validar o JWT, confere no banco se o usuário ainda existe e está
 * ativo, e usa o role atual do banco (assim uma conta desativada ou uma
 * mudança de permissão vale na hora, sem esperar o token expirar).
 */
export const ensureAuthenticated: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  const [scheme, token] = header?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedError('Token de acesso não informado');
  }

  const { sub } = verifyAccessToken(token); // erros de JWT viram 401 no errorHandler

  const user = await usersRepository.findAuthInfo(sub);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Usuário não encontrado ou inativo');
  }

  req.user = { id: user.id, role: user.role };
  next();
};

/** Acesso tipado ao usuário autenticado dentro de controllers protegidos. */
export function getAuthUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
