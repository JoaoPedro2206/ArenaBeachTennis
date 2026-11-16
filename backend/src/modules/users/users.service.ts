import { NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { hasImageSignature } from '../../shared/middlewares/uploadImage';
import { storage, type StorageProvider, type UploadFile } from '../../shared/providers/storage';
import { UsersRepository } from './users.repository';
import { presentUser, type UserView } from './users.presenter';
import type { UpdateProfileInput } from './users.schemas';

const PROFILE_PHOTO_FOLDER = 'profile-photos';

export class UsersService {
  constructor(
    private readonly usersRepository = new UsersRepository(),
    private readonly storageProvider: StorageProvider = storage,
  ) {}

  async getProfile(userId: string): Promise<UserView> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundError('Usuário não encontrado');
    return presentUser(user);
  }

  /**
   * Nome, telefone e bio. E-mail, papel, ELO e categoria NÃO são editáveis
   * aqui — o schema rejeita campos extras.
   */
  async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserView> {
    return presentUser(await this.usersRepository.update(userId, data));
  }

  /** Troca a foto: salva a nova, grava a URL e só então apaga a antiga */
  async updatePhoto(userId: string, file: UploadFile | undefined): Promise<UserView> {
    if (!file) throw new ValidationError('Envie uma imagem no campo "photo"');
    if (!hasImageSignature(file.buffer, file.mimetype)) {
      throw new ValidationError('O arquivo enviado não é uma imagem válida');
    }

    const current = await this.getProfile(userId);
    const { url } = await this.storageProvider.save(file, PROFILE_PHOTO_FOLDER);
    let updated;
    try {
      updated = await this.usersRepository.update(userId, { profilePhoto: url });
    } catch (error) {
      // O banco não gravou a URL: apaga o arquivo recém-salvo para não ficar órfão
      await this.storageProvider.delete(url).catch(() => undefined);
      throw error;
    }

    await this.discardOldPhoto(current.profilePhoto);
    return presentUser(updated);
  }

  async removePhoto(userId: string): Promise<UserView> {
    const current = await this.getProfile(userId);
    const updated = await this.usersRepository.update(userId, { profilePhoto: null });
    await this.discardOldPhoto(current.profilePhoto);
    return presentUser(updated);
  }

  /**
   * A troca já foi gravada no banco: falhar ao apagar o arquivo antigo (S3
   * fora do ar, por exemplo) não pode virar erro para o usuário — só fica um
   * arquivo sobrando, e registramos para limpeza.
   */
  private async discardOldPhoto(url: string | null): Promise<void> {
    if (!url) return;
    await this.storageProvider.delete(url).catch((error) => {
      console.error('[fotos] não foi possível apagar a foto antiga:', url, error);
    });
  }
}
