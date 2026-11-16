import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

export const ACTIVE_STATUSES = ['WAITING', 'IN_PROGRESS'] as const;

export const matchSelect = {
  id: true,
  status: true,
  pinCode: true,
  maxPlayers: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  hostId: true,
  booking: {
    select: {
      id: true,
      startTime: true,
      endTime: true,
      court: { select: { id: true, name: true, arena: { select: { id: true, name: true, timezone: true } } } },
    },
  },
  participants: {
    select: {
      userId: true,
      joinedAt: true,
      team: true,
      eloBefore: true,
      eloAfter: true,
      eloDelta: true,
      user: { select: { name: true, profilePhoto: true, eloScore: true } },
    },
    orderBy: { joinedAt: 'asc' as const },
  },
  result: {
    select: { winnerTeam: true, team1AvgElo: true, team2AvgElo: true, winnerDelta: true, loserDelta: true, winnerExpected: true },
  },
} satisfies Prisma.MatchSessionSelect;

export type MatchRecord = Prisma.MatchSessionGetPayload<{ select: typeof matchSelect }>;

type Db = PrismaClient | Prisma.TransactionClient;

export class MatchesRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string, db: Db = this.db) {
    return db.matchSession.findUnique({ where: { id }, select: matchSelect });
  }

  findActiveByPin(pinCode: string) {
    return this.db.matchSession.findFirst({
      where: { pinCode, status: { in: [...ACTIVE_STATUSES] } },
      select: matchSelect,
    });
  }

  findByBooking(bookingId: string) {
    return this.db.matchSession.findUnique({ where: { bookingId }, select: matchSelect });
  }

  /** Sala ativa em que o usuário está (como anfitrião ou convidado) */
  findActiveForUser(userId: string) {
    return this.db.matchSession.findFirst({
      where: { status: { in: [...ACTIVE_STATUSES] }, participants: { some: { userId } } },
      select: matchSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Reservas pagas do usuário, na janela da sala e ainda sem partida */
  findEligibleBookings(userId: string, opensUntil: Date, now: Date) {
    return this.db.booking.findMany({
      where: {
        userId,
        type: 'REGULAR',
        status: 'CONFIRMED',
        startTime: { lte: opensUntil },
        endTime: { gt: now },
        matchSession: null,
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        court: { select: { id: true, name: true, arena: { select: { id: true, name: true, timezone: true } } } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  findBookingForHost(bookingId: string) {
    return this.db.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, userId: true, type: true, status: true, startTime: true, endTime: true },
    });
  }

  /** Cancela salas esquecidas (WAITING/IN_PROGRESS) cuja reserva já acabou há tempo */
  cancelStale(staleBefore: Date) {
    return this.db.matchSession.updateMany({
      where: { status: { in: [...ACTIVE_STATUSES] }, booking: { endTime: { lt: staleBefore } } },
      data: { status: 'CANCELLED', pinCode: null },
    });
  }

  /** Partidas pontuadas do usuário, da mais recente para a mais antiga */
  findRatedHistory(userId: string, take = 20) {
    return this.db.matchParticipant.findMany({
      where: { userId, eloDelta: { not: null }, matchSession: { status: 'FINISHED' } },
      select: {
        team: true,
        eloAfter: true,
        eloDelta: true,
        matchSession: {
          select: {
            id: true,
            finishedAt: true,
            booking: { select: { startTime: true, court: { select: { name: true, arena: { select: { timezone: true } } } } } },
            result: { select: { winnerTeam: true, winnerExpected: true } },
            participants: { select: { userId: true, team: true, user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { matchSession: { finishedAt: 'desc' } },
      take,
    });
  }

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(work);
  }
}
