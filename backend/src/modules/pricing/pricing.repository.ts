import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

export const pricingRuleSelect = {
  id: true,
  name: true,
  courtId: true,
  daysOfWeek: true,
  startTime: true,
  endTime: true,
  pricePerHour: true,
} satisfies Prisma.PricingRuleSelect;

export type PricingRuleRecord = Prisma.PricingRuleGetPayload<{ select: typeof pricingRuleSelect }>;

export class PricingRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Regras que podem valer para a quadra: as dela + as da arena inteira */
  findForCourt(arenaId: string, courtId: string): Promise<PricingRuleRecord[]> {
    return this.db.pricingRule.findMany({
      where: { arenaId, OR: [{ courtId: null }, { courtId }] },
      select: pricingRuleSelect,
    });
  }

  findForArena(arenaId: string): Promise<PricingRuleRecord[]> {
    return this.db.pricingRule.findMany({
      where: { arenaId },
      select: pricingRuleSelect,
      orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
    });
  }
}
