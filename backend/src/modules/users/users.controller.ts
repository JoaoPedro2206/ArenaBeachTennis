import type { Request, Response } from 'express';
import { UsersService } from './users.service';
import { updateProfileSchema } from './users.schemas';
import { getAuthUser } from '../../shared/middlewares/ensureAuthenticated';

/** Controllers só traduzem HTTP <-> Service. Erros sobem para o errorHandler. */
export class UsersController {
  constructor(private readonly usersService = new UsersService()) {}

  /** GET /users/me */
  me = async (req: Request, res: Response): Promise<void> => {
    const user = await this.usersService.getProfile(getAuthUser(req).id);
    res.json({ user });
  };

  /** PATCH /users/profile — atualização parcial (só os campos enviados mudam) */
  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const data = updateProfileSchema.parse(req.body);
    const user = await this.usersService.updateProfile(getAuthUser(req).id, data);
    res.json({ user });
  };

  /** POST /users/profile/photo — multipart/form-data, campo "photo" */
  uploadPhoto = async (req: Request, res: Response): Promise<void> => {
    const user = await this.usersService.updatePhoto(getAuthUser(req).id, req.file);
    res.json({ user });
  };

  /** DELETE /users/profile/photo */
  removePhoto = async (req: Request, res: Response): Promise<void> => {
    const user = await this.usersService.removePhoto(getAuthUser(req).id);
    res.json({ user });
  };
}
