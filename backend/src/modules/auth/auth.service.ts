import { Prisma } from '@prisma/client';
import { ConflictError, UnauthorizedError } from '../../shared/errors/AppError';
import { comparePassword, DUMMY_PASSWORD_HASH, hashPassword } from '../../shared/utils/password';
import { signAccessToken } from '../../shared/utils/jwt';
import { UsersRepository } from '../users/users.repository';
import { presentUser, type UserView } from '../users/users.presenter';
import type { LoginInput, RegisterInput } from './auth.schemas';

export interface AuthResult {
  user: UserView;
  accessToken: string;
}

export class AuthService {
  constructor(private readonly usersRepository = new UsersRepository()) {}

  async register({ password, ...data }: RegisterInput): Promise<AuthResult> {
    if (await this.usersRepository.existsByEmail(data.email)) {
      throw new ConflictError('E-mail já cadastrado');
    }

    // Todo cadastro público nasce como PLAYER. Promoção a TEACHER/ARENA_ADMIN
    // será feita por um admin (fases seguintes).
    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await this.usersRepository.create({ ...data, passwordHash, role: 'PLAYER' });
    } catch (error) {
      // Dois cadastros simultâneos com o mesmo e-mail passam pela checagem acima;
      // o índice único do banco barra o segundo — com a mesma mensagem amigável
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('E-mail já cadastrado');
      }
      throw error;
    }

    return { user: presentUser(user), accessToken: signAccessToken({ sub: user.id, role: user.role }) };
  }

  async login({ email, password }: LoginInput): Promise<AuthResult> {
    const record = await this.usersRepository.findByEmailWithPassword(email);

    // Compara mesmo sem usuário para não revelar (pelo tempo de resposta)
    // se o e-mail existe. A mensagem de erro também é sempre a mesma.
    const passwordMatches = await comparePassword(password, record?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!record || !passwordMatches || !record.isActive) {
      throw new UnauthorizedError('E-mail ou senha inválidos');
    }

    const { passwordHash: _hash, isActive: _active, ...user } = record;
    return { user: presentUser(user), accessToken: signAccessToken({ sub: user.id, role: user.role }) };
  }
}
