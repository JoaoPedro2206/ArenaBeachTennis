import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { AppError } from '../../shared/errors/AppError';
import { ensureAuthenticated } from '../../shared/middlewares/ensureAuthenticated';

const WINDOW_MS = 15 * 60 * 1000;

function limiter(limit: number, keyGenerator?: (ip: string, userId?: string) => string) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(keyGenerator && { keyGenerator: (req) => keyGenerator(req.ip ?? 'anon', req.user?.id) }),
    // 429 por IP não revela nada sobre contas
    handler: (_req, _res, next) => {
      next(new AppError('Muitas tentativas. Tente novamente em alguns minutos.', 429, 'TOO_MANY_REQUESTS'));
    },
  });
}

export interface AuthRouteLimits {
  /** Cadastro/login por IP (força bruta de senhas) */
  credentials: number;
  /** Pedidos de recuperação de senha por IP (spam de e-mails) */
  forgotPassword: number;
  /** Uso de links de reset/verificação por IP (chute de tokens) */
  tokenRedeem: number;
  /** Reenvios de verificação por usuário */
  resendVerification: number;
}

const DEFAULT_LIMITS: AuthRouteLimits = { credentials: 20, forgotPassword: 10, tokenRedeem: 20, resendVerification: 5 };

/** Fábrica separada para os testes poderem injetar controller e limites. */
export function buildAuthRoutes(controller = new AuthController(), limits = DEFAULT_LIMITS): Router {
  const credentials = limiter(limits.credentials);
  const forgot = limiter(limits.forgotPassword);
  const redeem = limiter(limits.tokenRedeem);
  const resend = limiter(limits.resendVerification, (ip, userId) => userId ?? ip);

  const router = Router();
  router.post('/register', credentials, controller.register);
  router.post('/login', credentials, controller.login);
  router.post('/forgot-password', forgot, controller.forgotPassword);
  router.post('/reset-password', redeem, controller.resetPassword);
  router.post('/verify-email', redeem, controller.verifyEmail);
  router.post('/resend-verification', ensureAuthenticated, resend, controller.resendVerification);
  return router;
}

export const authRoutes = buildAuthRoutes();
