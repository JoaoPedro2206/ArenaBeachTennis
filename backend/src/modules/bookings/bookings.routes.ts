import { Router } from 'express';
import { ensureAuthenticated } from '../../shared/middlewares/ensureAuthenticated';
import { BookingsController } from './bookings.controller';

const controller = new BookingsController();

export const bookingsRoutes = Router();

bookingsRoutes.use(ensureAuthenticated);
bookingsRoutes.post('/', controller.create);
bookingsRoutes.get('/me', controller.listMine);
bookingsRoutes.post('/:id/pay', controller.pay);
bookingsRoutes.patch('/:id/cancel', controller.cancel);
