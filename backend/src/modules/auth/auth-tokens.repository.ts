import type { AuthTokenType, PrismaClient } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

export interface StoredAuthToken {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/** Contrato usado pelo AuthService (permite fakes em memória nos testes). */
export interface AuthTokensStore {
  create(data: { userId: string; type: AuthTokenType; tokenHash: string; expiresAt: Date }): Promise<void>;
  /** Invalida os tokens ainda abertos do usuário (ao emitir um novo) */
  invalidateOpen(userId: string, type: AuthTokenType, now: Date): Promise<void>;
  findByHash(tokenHash: string, type: AuthTokenType): Promise<StoredAuthToken | null>;
  /**
   * Consome o token de reset e troca a senha numa única transação.
   * Retorna false se o token já foi usado/expirou entre a checagem e agora
   * (corrida) — o uso único é garantido pelo UPDATE condicional.
   */
  consumeForPasswordReset(token: StoredAuthToken, passwordHash: string, now: Date): Promise<boolean>;
  /** Consome o token de verificação e marca o e-mail como confirmado. */
  consumeForEmailVerification(token: StoredAuthToken, now: Date): Promise<boolean>;
}

export class AuthTokensRepository implements AuthTokensStore {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(data: { userId: string; type: AuthTokenType; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.db.authToken.create({ data });
  }

  async invalidateOpen(userId: string, type: AuthTokenType, now: Date): Promise<void> {
    await this.db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: now } });
  }

  findByHash(tokenHash: string, type: AuthTokenType): Promise<StoredAuthToken | null> {
    return this.db.authToken.findFirst({
      where: { tokenHash, type },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });
  }

  consumeForPasswordReset(token: StoredAuthToken, passwordHash: string, now: Date): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const claimed = await tx.authToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return false;

      await tx.user.update({
        where: { id: token.userId },
        // tokenVersion++ derruba todos os JWTs emitidos antes
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      // Outros links de reset pendentes deixam de valer
      await tx.authToken.updateMany({
        where: { userId: token.userId, type: 'PASSWORD_RESET', usedAt: null },
        data: { usedAt: now },
      });
      return true;
    });
  }

  consumeForEmailVerification(token: StoredAuthToken, now: Date): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const claimed = await tx.authToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return false;

      await tx.user.updateMany({ where: { id: token.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
      return true;
    });
  }
}
