import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

export class CourtsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Quadra + dados da arena necessários para calcular horários (fuso). */
  findByIdWithArena(id: string) {
    return this.db.court.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        openTime: true,
        closeTime: true,
        slotDurationMin: true,
        pricePerHour: true,
        arena: { select: { id: true, name: true, timezone: true, isActive: true, ownerId: true } },
      },
    });
  }

  /** Quadras visíveis ao público (oculta INACTIVE; MAINTENANCE aparece, mas sem horários livres). */
  findPublic(arenaId?: string) {
    return this.db.court.findMany({
      where: { status: { not: 'INACTIVE' }, arena: { isActive: true }, ...(arenaId && { arenaId }) },
      select: {
        id: true,
        name: true,
        status: true,
        isCovered: true,
        hasLighting: true,
        slotDurationMin: true,
        pricePerHour: true,
        arena: { select: { id: true, name: true, timezone: true } },
      },
      orderBy: [{ arena: { name: 'asc' } }, { name: 'asc' }],
    });
  }
}

export type CourtWithArena = NonNullable<Awaited<ReturnType<CourtsRepository['findByIdWithArena']>>>;
