import { Router } from 'express';
import { prisma } from '../shared/database/prisma';
import { authRoutes } from '../modules/auth/auth.routes';
import { usersRoutes } from '../modules/users/users.routes';
import { bookingsRoutes } from '../modules/bookings/bookings.routes';
import { courtsRoutes } from '../modules/courts/courts.routes';
import { lessonsRoutes, teachersRoutes } from '../modules/lessons/lessons.routes';
import { matchesRoutes } from '../modules/matches/matches.routes';
import { adminRoutes } from '../modules/admin/admin.routes';

/**
 * Agregador de rotas. Cada módulo exporta seu próprio Router.
 */
export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/users', usersRoutes);
routes.use('/courts', courtsRoutes);
routes.use('/bookings', bookingsRoutes);
routes.use('/teachers', teachersRoutes);
routes.use('/lessons', lessonsRoutes);
routes.use('/matches', matchesRoutes);
routes.use('/admin', adminRoutes);

routes.get('/health', async (_req, res) => {
  let database: 'up' | 'down' = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }

  res.status(database === 'up' ? 200 : 503).json({
    status: database === 'up' ? 'ok' : 'degraded',
    database,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});
