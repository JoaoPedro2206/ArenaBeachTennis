import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../shared/errors/AppError';
import { ensureAuthenticated } from '../../shared/middlewares/ensureAuthenticated';
import { MatchesController } from './matches.controller';

const controller = new MatchesController();

/**
 * Proteção contra força bruta no PIN: cada usuário tem um número limitado de
 * tentativas de entrar em sala por janela de tempo (digitar errado algumas
 * vezes é normal; testar milhares de códigos, não).
 */
const joinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
  handler: (_req, _res, next) =>
    next(new AppError('Muitas tentativas de código. Aguarde alguns minutos.', 429, 'TOO_MANY_REQUESTS')),
});

export const matchesRoutes = Router();

matchesRoutes.use(ensureAuthenticated);

matchesRoutes.get('/current', controller.current);
matchesRoutes.get('/eligible-bookings', controller.eligibleBookings);
matchesRoutes.get('/history', controller.history);
matchesRoutes.get('/:id', controller.show);
matchesRoutes.post('/create', controller.create);
matchesRoutes.post('/join', joinLimiter, controller.join);
matchesRoutes.post('/start', controller.start);
matchesRoutes.post('/finish', controller.finish);
matchesRoutes.post('/:id/result/preview', controller.previewResult);
matchesRoutes.post('/:id/result', controller.recordResult);
matchesRoutes.post('/leave', controller.leave);
matchesRoutes.post('/cancel', controller.cancel);
