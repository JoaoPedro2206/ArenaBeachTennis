import { Router } from 'express';
import { ensureAuthenticated } from '../../shared/middlewares/ensureAuthenticated';
import { ensureEmailVerified } from '../../shared/middlewares/ensureEmailVerified';
import { ensureRole } from '../../shared/middlewares/ensureRole';
import { optionalAuthenticated } from '../../shared/middlewares/optionalAuthenticated';
import { LessonsController } from './lessons.controller';

const controller = new LessonsController();

export const teachersRoutes = Router();
teachersRoutes.get('/', controller.listTeachers);

export const lessonsRoutes = Router();
lessonsRoutes.get('/', optionalAuthenticated, controller.list);
lessonsRoutes.post('/', ensureAuthenticated, ensureRole('TEACHER', 'ARENA_ADMIN', 'SUPER_ADMIN'), controller.create);
lessonsRoutes.post('/:id/enroll', ensureAuthenticated, ensureEmailVerified, controller.enroll);
lessonsRoutes.delete('/:id/enroll', ensureAuthenticated, controller.unenroll);
