import type { RequestHandler } from 'express';
import type { UserRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';

/**
 * Autorização por perfil. Use sempre DEPOIS de ensureAuthenticated:
 *
 *   router.post('/courts', ensureAuthenticated, ensureRole('ARENA_ADMIN', 'SUPER_ADMIN'), ...)
 */
export const ensureRole =
  (...allowed: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError();
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenError('Você não tem permissão para acessar este recurso');
    }
    next();
  };
