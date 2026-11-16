import { Router } from 'express';
import { UsersController } from './users.controller';
import { ensureAuthenticated } from '../../shared/middlewares/ensureAuthenticated';
import { uploadImage } from '../../shared/middlewares/uploadImage';

const controller = new UsersController();

export const usersRoutes = Router();

// Todas as rotas deste módulo exigem login (JWT)
usersRoutes.use(ensureAuthenticated);

usersRoutes.get('/me', controller.me);
usersRoutes.patch('/profile', controller.updateProfile);
usersRoutes.post('/profile/photo', uploadImage('photo'), controller.uploadPhoto);
usersRoutes.delete('/profile/photo', controller.removePhoto);
