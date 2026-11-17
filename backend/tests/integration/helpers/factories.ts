/**
 * Fábricas de dados para os testes de integração. Cada uma cria o mínimo
 * válido e aceita `overrides` para o que o teste quer controlar.
 */
import { randomUUID } from 'node:crypto';
import type { Booking, Court, MatchSession, Prisma, User, UserRole } from '@prisma/client';
import { prisma } from '../../../src/shared/database/prisma';
import { signAccessToken } from '../../../src/shared/utils/jwt';
import { zonedDateTimeToUtc, utcToZoned } from '../../../src/shared/utils/timezone';

export const TZ = 'America/Sao_Paulo';
const MINUTE = 60_000;

const uid = () => randomUUID().slice(0, 8);

export async function makeUser(overrides: Partial<Prisma.UserUncheckedCreateInput> = {}): Promise<User> {
  return prisma.user.create({
    data: {
      name: `Jogador ${uid()}`,
      email: `user-${uid()}@teste.local`,
      // hash bcrypt de "Senha1234" (custo 4: rápido nos testes)
      passwordHash: '$2b$04$5BbsKQdQRvDiAsnsiZsAu.rJj61lTPaLb3sh0ddUmEa5D.ownhinO',
      role: 'PLAYER',
      emailVerifiedAt: new Date(),
      ...overrides,
    },
  });
}

/** Header Authorization pronto para o supertest */
export function authHeader(user: Pick<User, 'id' | 'role' | 'tokenVersion'>): { Authorization: string } {
  return { Authorization: `Bearer ${signAccessToken({ sub: user.id, role: user.role as UserRole, tokenVersion: user.tokenVersion })}` };
}

export async function makeArena(overrides: Partial<Prisma.ArenaUncheckedCreateInput> = {}) {
  const ownerId = overrides.ownerId ?? (await makeUser({ role: 'ARENA_ADMIN' })).id;
  const slug = `arena-${uid()}`;
  return prisma.arena.create({
    data: { name: `Arena ${slug}`, slug, address: 'Rua da Praia, 1', city: 'Santos', state: 'SP', timezone: TZ, ...overrides, ownerId },
  });
}

/** Quadra das 06:00 às 23:00, slots de 60 min, R$ 100/h — a menos que o teste mude */
export async function makeCourt(overrides: Partial<Prisma.CourtUncheckedCreateInput> = {}): Promise<Court> {
  const arenaId = overrides.arenaId ?? (await makeArena()).id;
  return prisma.court.create({
    data: { name: `Quadra ${uid()}`, pricePerHour: 10_000, slotDurationMin: 60, openTime: '06:00', closeTime: '23:00', ...overrides, arenaId },
  });
}

export async function makeBooking(
  overrides: Partial<Prisma.BookingUncheckedCreateInput> & { courtId: string; userId: string },
): Promise<Booking> {
  const startTime = overrides.startTime ? new Date(overrides.startTime) : localSlot(1, 10 * 60);
  return prisma.booking.create({
    data: {
      endTime: new Date(startTime.getTime() + 60 * MINUTE),
      totalPrice: 10_000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      ...overrides,
      startTime,
    },
  });
}

/**
 * Sala de partida já aberta (WAITING) para uma reserva paga que começa em
 * 30 min. `players` são adicionados como participantes além do anfitrião.
 */
export async function makeMatch(
  options: { host?: User; players?: User[]; status?: MatchSession['status']; now?: Date; maxPlayers?: number } = {},
) {
  const now = options.now ?? new Date();
  const host = options.host ?? (await makeUser());
  const court = await makeCourt();
  const booking = await makeBooking({
    courtId: court.id,
    userId: host.id,
    startTime: new Date(now.getTime() + 30 * MINUTE),
    endTime: new Date(now.getTime() + 90 * MINUTE),
  });
  const match = await prisma.matchSession.create({
    data: {
      bookingId: booking.id,
      hostId: host.id,
      pinCode: String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0'),
      status: options.status ?? 'WAITING',
      maxPlayers: options.maxPlayers ?? 4,
      participants: {
        create: [host, ...(options.players ?? [])].map((p) => ({ userId: p.id, status: 'CONFIRMED' as const })),
      },
    },
  });
  return { match, host, booking, court };
}

/** Instante UTC de "daqui a N dias, às HH:mm" no fuso da arena */
export function localSlot(daysAhead: number, minutesOfDay: number, now = new Date(), timeZone = TZ): Date {
  const { date } = utcToZoned(new Date(now.getTime() + daysAhead * 24 * 60 * MINUTE), timeZone);
  return zonedDateTimeToUtc(date, minutesOfDay, timeZone);
}
