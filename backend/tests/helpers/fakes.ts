import type { AuthTokenType } from '@prisma/client';
import type { AuthTokensStore, StoredAuthToken } from '../../src/modules/auth/auth-tokens.repository';
import type { Mailer, MailMessage } from '../../src/shared/providers/mail';

export interface FakeUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  passwordHash: string;
  tokenVersion: number;
  emailVerifiedAt: Date | null;
}

interface Row extends StoredAuthToken {
  type: AuthTokenType;
  tokenHash: string;
}

/** Banco em memória que reproduz a semântica das transações do repositório real */
export class FakeDb {
  users = new Map<string, FakeUser>();
  tokens: Row[] = [];
  private seq = 0;

  addUser(partial: Partial<FakeUser> & { email: string }): FakeUser {
    const user: FakeUser = {
      id: `user-${++this.seq}`,
      name: 'Maria Souza',
      isActive: true,
      passwordHash: 'old-hash',
      tokenVersion: 0,
      emailVerifiedAt: null,
      ...partial,
    };
    this.users.set(user.id, user);
    return user;
  }

  get usersPort() {
    const byEmail = (email: string) => [...this.users.values()].find((u) => u.email === email) ?? null;
    return {
      existsByEmail: async (email: string) => byEmail(email) !== null,
      findMailInfoByEmail: async (email: string) => byEmail(email),
      findMailInfoById: async (id: string) => this.users.get(id) ?? null,
      findByEmailWithPassword: async () => null,
      create: async (data: { name: string; email: string }) => {
        const user = this.addUser({ name: data.name, email: data.email });
        return {
          ...user,
          phone: null,
          profilePhoto: null,
          bio: null,
          role: 'PLAYER' as const,
          eloScore: 1000,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    } as never;
  }

  get tokensStore(): AuthTokensStore {
    return {
      create: async (data) => {
        this.tokens.push({ id: `tok-${++this.seq}`, usedAt: null, ...data });
      },
      invalidateOpen: async (userId, type, now) => {
        for (const t of this.tokens) if (t.userId === userId && t.type === type && !t.usedAt) t.usedAt = now;
      },
      findByHash: async (hash, type) => this.tokens.find((t) => t.tokenHash === hash && t.type === type) ?? null,
      consumeForPasswordReset: async (token, passwordHash, now) => {
        const row = this.tokens.find((t) => t.id === token.id)!;
        if (row.usedAt || row.expiresAt <= now) return false;
        row.usedAt = now;
        const user = this.users.get(row.userId)!;
        user.passwordHash = passwordHash;
        user.tokenVersion += 1;
        return true;
      },
      consumeForEmailVerification: async (token, now) => {
        const row = this.tokens.find((t) => t.id === token.id)!;
        if (row.usedAt || row.expiresAt <= now) return false;
        row.usedAt = now;
        const user = this.users.get(row.userId)!;
        user.emailVerifiedAt ??= now;
        return true;
      },
    };
  }
}

export class FakeMailer implements Mailer {
  sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }

  /** Extrai o token do último link enviado */
  lastToken(): string {
    const url = this.sent.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
    if (!url) throw new Error('nenhum link enviado');
    return new URL(url).searchParams.get('token')!;
  }
}
