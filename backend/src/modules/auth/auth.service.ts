import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { AppError, ConflictError, UnauthorizedError } from '../../shared/errors/AppError';
import { comparePassword, DUMMY_PASSWORD_HASH, hashPassword } from '../../shared/utils/password';
import { signAccessToken } from '../../shared/utils/jwt';
import { generateOpaqueToken, hashToken } from '../../shared/utils/token';
import { RateCounter } from '../../shared/utils/RateCounter';
import { mailer as defaultMailer, type Mailer } from '../../shared/providers/mail';
import { emailVerificationEmail, passwordResetEmail } from '../../shared/providers/mail/templates';
import { UsersRepository } from '../users/users.repository';
import { presentUser, type UserView } from '../users/users.presenter';
import { AuthTokensRepository, type AuthTokensStore, type StoredAuthToken } from './auth-tokens.repository';
import type { LoginInput, RegisterInput } from './auth.schemas';

export interface AuthResult {
  user: UserView;
  accessToken: string;
}

export const PASSWORD_RESET_TTL_MINUTES = 30;
export const EMAIL_VERIFICATION_TTL_HOURS = 24;

/** Por e-mail: no máximo 3 pedidos de reset a cada 15 min (excedente é ignorado em silêncio) */
const RESET_PER_EMAIL = { limit: 3, windowMs: 15 * 60 * 1000 };
/** Por usuário: no máximo 3 reenvios de verificação a cada 15 min */
const VERIFICATION_PER_USER = { limit: 3, windowMs: 15 * 60 * 1000 };

type UsersPort = Pick<
  UsersRepository,
  'existsByEmail' | 'create' | 'findByEmailWithPassword' | 'findMailInfoByEmail' | 'findMailInfoById'
>;

export interface AuthServiceDeps {
  users?: UsersPort;
  tokens?: AuthTokensStore;
  mailer?: Mailer;
  now?: () => Date;
  hashPassword?: (plain: string) => Promise<string>;
}

function linkError(reason: 'INVALID' | 'EXPIRED' | 'USED'): AppError {
  switch (reason) {
    case 'EXPIRED':
      return new AppError('Este link expirou. Peça um novo.', 400, 'LINK_EXPIRED');
    case 'USED':
      return new AppError('Este link já foi utilizado. Peça um novo, se precisar.', 400, 'LINK_USED');
    default:
      return new AppError('Link inválido. Peça um novo.', 400, 'LINK_INVALID');
  }
}

export class AuthService {
  private readonly users: UsersPort;
  private readonly tokens: AuthTokensStore;
  private readonly mailer: Mailer;
  private readonly now: () => Date;
  private readonly hash: (plain: string) => Promise<string>;
  private readonly resetByEmail: RateCounter;
  private readonly verificationByUser: RateCounter;

  constructor(deps: AuthServiceDeps = {}) {
    this.users = deps.users ?? new UsersRepository();
    this.tokens = deps.tokens ?? new AuthTokensRepository();
    this.mailer = deps.mailer ?? defaultMailer;
    this.now = deps.now ?? (() => new Date());
    this.hash = deps.hashPassword ?? hashPassword;
    this.resetByEmail = new RateCounter(RESET_PER_EMAIL.limit, RESET_PER_EMAIL.windowMs, () => this.now().getTime());
    this.verificationByUser = new RateCounter(
      VERIFICATION_PER_USER.limit,
      VERIFICATION_PER_USER.windowMs,
      () => this.now().getTime(),
    );
  }

  async register({ password, ...data }: RegisterInput): Promise<AuthResult> {
    if (await this.users.existsByEmail(data.email)) {
      throw new ConflictError('E-mail já cadastrado');
    }

    // Todo cadastro público nasce como PLAYER. Promoção a TEACHER/ARENA_ADMIN
    // será feita por um admin (fases seguintes).
    const passwordHash = await this.hash(password);
    let user;
    try {
      user = await this.users.create({ ...data, passwordHash, role: 'PLAYER' });
    } catch (error) {
      // Dois cadastros simultâneos com o mesmo e-mail passam pela checagem acima;
      // o índice único do banco barra o segundo — com a mesma mensagem amigável
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('E-mail já cadastrado');
      }
      throw error;
    }

    // Confirmação de e-mail: falha de envio não pode derrubar o cadastro
    // (o usuário pode pedir o reenvio pelo banner do app)
    this.sendEmailVerification({ id: user.id, name: user.name, email: user.email }).catch((error) =>
      console.error('Falha ao enviar e-mail de verificação:', error),
    );

    return { user: presentUser(user), accessToken: signAccessToken({ sub: user.id, role: user.role, tokenVersion: 0 }) };
  }

  async login({ email, password }: LoginInput): Promise<AuthResult> {
    const record = await this.users.findByEmailWithPassword(email);

    // Compara mesmo sem usuário para não revelar (pelo tempo de resposta)
    // se o e-mail existe. A mensagem de erro também é sempre a mesma.
    const passwordMatches = await comparePassword(password, record?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!record || !passwordMatches || !record.isActive) {
      throw new UnauthorizedError('E-mail ou senha inválidos');
    }

    const { passwordHash: _hash, isActive: _active, tokenVersion, ...user } = record;
    return { user: presentUser(user), accessToken: signAccessToken({ sub: user.id, role: user.role, tokenVersion }) };
  }

  // ---------------------------------------------------------------------------
  // Recuperação de senha
  // ---------------------------------------------------------------------------

  /**
   * Gera o token e envia o e-mail — SE a conta existir. Nunca lança por conta
   * inexistente e não devolve nada: o controller responde 202 antes de chamar
   * isto, então o tempo de resposta é o mesmo exista o e-mail ou não.
   */
  async requestPasswordReset(email: string): Promise<void> {
    // Excedeu o limite do e-mail: ignora em silêncio (resposta externa não muda)
    if (!this.resetByEmail.consume(email)) return;

    const user = await this.users.findMailInfoByEmail(email);
    if (!user || !user.isActive) return;

    const now = this.now();
    const token = generateOpaqueToken();
    await this.tokens.invalidateOpen(user.id, 'PASSWORD_RESET', now); // só o último link vale
    await this.tokens.create({
      userId: user.id,
      type: 'PASSWORD_RESET',
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000),
    });

    await this.mailer.send(
      passwordResetEmail({
        to: user.email,
        name: user.name,
        url: `${env.APP_URL}/redefinir-senha?token=${encodeURIComponent(token)}`,
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      }),
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const stored = await this.tokens.findByHash(hashToken(token), 'PASSWORD_RESET');
    this.assertUsable(stored);

    const passwordHash = await this.hash(newPassword);
    // O consumo é atômico: de dois pedidos simultâneos com o mesmo link, só um passa
    const consumed = await this.tokens.consumeForPasswordReset(stored, passwordHash, this.now());
    if (!consumed) throw linkError('USED');
  }

  // ---------------------------------------------------------------------------
  // Verificação de e-mail
  // ---------------------------------------------------------------------------

  async verifyEmail(token: string): Promise<void> {
    const stored = await this.tokens.findByHash(hashToken(token), 'EMAIL_VERIFICATION');
    this.assertUsable(stored);

    const consumed = await this.tokens.consumeForEmailVerification(stored, this.now());
    if (!consumed) throw linkError('USED');
  }

  async resendVerification(userId: string): Promise<{ alreadyVerified: boolean }> {
    const user = await this.users.findMailInfoById(userId);
    if (!user) throw new UnauthorizedError();
    if (user.emailVerifiedAt) return { alreadyVerified: true };

    if (!this.verificationByUser.consume(userId)) {
      throw new AppError('Muitos pedidos de reenvio. Tente novamente em alguns minutos.', 429, 'TOO_MANY_REQUESTS');
    }

    await this.sendEmailVerification(user);
    return { alreadyVerified: false };
  }

  private async sendEmailVerification(user: { id: string; name: string; email: string }): Promise<void> {
    const now = this.now();
    const token = generateOpaqueToken();
    await this.tokens.invalidateOpen(user.id, 'EMAIL_VERIFICATION', now);
    await this.tokens.create({
      userId: user.id,
      type: 'EMAIL_VERIFICATION',
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_HOURS * 3_600_000),
    });

    await this.mailer.send(
      emailVerificationEmail({
        to: user.email,
        name: user.name,
        url: `${env.APP_URL}/verificar-email?token=${encodeURIComponent(token)}`,
        expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
      }),
    );
  }

  private assertUsable(stored: StoredAuthToken | null): asserts stored is StoredAuthToken {
    if (!stored) throw linkError('INVALID');
    if (stored.usedAt) throw linkError('USED');
    if (stored.expiresAt.getTime() <= this.now().getTime()) throw linkError('EXPIRED');
  }
}
