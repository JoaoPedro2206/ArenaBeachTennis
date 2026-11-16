import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { AppError } from '../../shared/errors/AppError';

const controller = new AuthController();

/** Limita tentativas por IP para dificultar força bruta de senhas. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError('Muitas tentativas. Tente novamente em alguns minutos.', 429, 'TOO_MANY_REQUESTS'));
  },
});

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, controller.register);
authRoutes.post('/login', authLimiter, controller.login);
