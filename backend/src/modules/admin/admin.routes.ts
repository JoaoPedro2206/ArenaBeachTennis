import { Router } from 'express';
import { ensureAuthenticated } from '../../shared/middlewares/ensureAuthenticated';
import { ensureRole } from '../../shared/middlewares/ensureRole';
import { AdminController } from './admin.controller';

const controller = new AdminController();

/**
 * Painel do dono da arena. A role vem do BANCO a cada requisição
 * (ensureAuthenticated), então rebaixar um admin vale na hora — não espera
 * o token expirar.
 */
export const adminRoutes = Router();

adminRoutes.use(ensureAuthenticated, ensureRole('ARENA_ADMIN'));

adminRoutes.get('/agenda', controller.agenda);
adminRoutes.post('/block', controller.block);
adminRoutes.delete('/block/:id', controller.unblock);
adminRoutes.patch('/courts/:id/status', controller.courtStatus);
adminRoutes.get('/pricing', controller.pricing);
adminRoutes.put('/pricing', controller.updatePricing);
adminRoutes.get('/reports', controller.reports);
