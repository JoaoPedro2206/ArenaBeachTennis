import { Router } from 'express';
import { CourtsController } from './courts.controller';
import { BookingsController } from '../bookings/bookings.controller';

const courtsController = new CourtsController();
const bookingsController = new BookingsController();

/** Rotas públicas de quadras (consulta não exige login) */
export const courtsRoutes = Router();

courtsRoutes.get('/', courtsController.list);
courtsRoutes.get('/:courtId/availability', bookingsController.availability);
