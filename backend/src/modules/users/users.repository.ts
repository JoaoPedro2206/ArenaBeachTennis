import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

/** Campos seguros para expor na API (nunca inclui passwordHash). */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  profilePhoto: true,
  bio: true,
  role: true,
  eloScore: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/**
 * Única camada que conversa com o Prisma para a entidade User.
 * Recebe o client por injeção para facilitar testes.
 */
export class UsersRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string): Promise<PublicUser | null> {
    return this.db.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  /** Retorna o hash da senha — uso exclusivo do fluxo de login. */
  findByEmailWithPassword(email: string) {
    return this.db.user.findUnique({
      where: { email },
      select: { ...publicUserSelect, passwordHash: true, isActive: true },
    });
  }

  /** Consulta mínima usada pelo middleware de autenticação a cada request. */
  findAuthInfo(id: string) {
    return this.db.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.db.user
      .count({ where: { email } })
      .then((count) => count > 0);
  }

  create(data: Prisma.UserCreateInput): Promise<PublicUser> {
    return this.db.user.create({ data, select: publicUserSelect });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<PublicUser> {
    return this.db.user.update({ where: { id }, data, select: publicUserSelect });
  }
}
