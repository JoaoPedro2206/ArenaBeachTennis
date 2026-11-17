import type { RequestHandler } from 'express';
import { AppError, UnauthorizedError } from '../errors/AppError';

/**
 * Exige e-mail confirmado (usar DEPOIS de ensureAuthenticated).
 * Regra de produto: navegar e ver a agenda é livre; reservar/pagar exige.
 */
export const ensureEmailVerified: RequestHandler = (req, _res, next) => {
  if (!req.user) throw new UnauthorizedError();
  if (!req.user.emailVerified) {
    throw new AppError('Confirme seu e-mail para reservar e pagar.', 403, 'EMAIL_NOT_VERIFIED');
  }
  next();
};
