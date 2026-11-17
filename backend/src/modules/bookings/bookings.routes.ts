import { Router } from 'express';
import { ensureAuthenticated } from '../../shared/middlewares/ensureAuthenticated';
import { ensureEmailVerified } from '../../shared/middlewares/ensureEmailVerified';
import { BookingsController } from './bookings.controller';

const controller = new BookingsController();

export const bookingsRoutes = Router();

bookingsRoutes.use(ensureAuthenticated);
bookingsRoutes.post('/', ensureEmailVerified, controller.create);
bookingsRoutes.get('/me', controller.listMine);
bookingsRoutes.post('/:id/pay', ensureEmailVerified, controller.pay);
bookingsRoutes.patch('/:id/cancel', controller.cancel);
