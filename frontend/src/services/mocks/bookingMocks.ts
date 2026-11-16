/**
 * Dados falsos para desenvolver a UI sem backend.
 * Ativar com VITE_USE_MOCKS=true no .env do frontend.
 */
import type { Booking, Court, CourtAvailability, CreateBookingInput } from '@/types/booking';

const ARENA = { id: 'mock-arena', name: 'Arena Mock', timezone: 'America/Sao_Paulo' };

export const MOCK_COURTS: Court[] = [
  { id: 'mock-1', name: 'Quadra 1', status: 'ACTIVE', isCovered: false, hasLighting: true, slotDurationMin: 60, pricePerHour: 12000, arena: ARENA },
  { id: 'mock-2', name: 'Quadra 2 (Coberta)', status: 'ACTIVE', isCovered: true, hasLighting: true, slotDurationMin: 90, pricePerHour: 15000, arena: ARENA },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Pseudo-aleatório determinístico: a mesma data sempre gera a mesma ocupação */
function isTaken(seed: string): boolean {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % 3 === 0;
}

export async function mockAvailability(courtId: string, date: string): Promise<CourtAvailability> {
  await delay(400);
  const court = MOCK_COURTS.find((c) => c.id === courtId) ?? MOCK_COURTS[0];
  const slots = [];
  for (let minutes = 6 * 60; minutes + court.slotDurationMin <= 23 * 60; minutes += court.slotDurationMin) {
    const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const start = new Date(`${date}T${label}:00-03:00`);
    slots.push({
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + court.slotDurationMin * 60_000).toISOString(),
      label,
      price: Math.round((court.pricePerHour * court.slotDurationMin) / 60),
      available: start > new Date() && !isTaken(`${courtId}${date}${label}`),
    });
  }
  return { court, arena: ARENA, date, timeZone: ARENA.timezone, slotDurationMin: court.slotDurationMin, slots };
}

/** Reservas criadas no modo mock, para pay/cancel encontrarem */
const mockBookings = new Map<string, Booking>();

export async function mockCreateBooking(input: CreateBookingInput): Promise<Booking> {
  await delay(500);
  const court = MOCK_COURTS.find((c) => c.id === input.courtId) ?? MOCK_COURTS[0];
  const start = new Date(input.startTime);
  const now = new Date();
  const booking: Booking = {
    id: crypto.randomUUID(),
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + court.slotDurationMin * 60_000).toISOString(),
    type: 'REGULAR',
    status: 'PENDING_PAYMENT',
    paymentStatus: 'PENDING',
    expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    paidAt: null,
    cancelledAt: null,
    createdAt: now.toISOString(),
    totalPrice: Math.round((court.pricePerHour * court.slotDurationMin) / 60),
    notes: input.notes ?? null,
    court: { id: court.id, name: court.name, arena: ARENA },
  };
  mockBookings.set(booking.id, booking);
  return booking;
}

export async function mockPayBooking(id: string): Promise<Booking> {
  await delay(800);
  const booking = mockBookings.get(id);
  if (!booking) throw new Error('Reserva não encontrada');
  const paid: Booking = { ...booking, status: 'CONFIRMED', paymentStatus: 'PAID', paidAt: new Date().toISOString(), expiresAt: null };
  mockBookings.set(id, paid);
  return paid;
}

export async function mockCancelBooking(id: string): Promise<Booking> {
  await delay(400);
  const booking = mockBookings.get(id);
  if (!booking) throw new Error('Reserva não encontrada');
  const cancelled: Booking = { ...booking, status: 'CANCELLED', cancelledAt: new Date().toISOString(), expiresAt: null };
  mockBookings.set(id, cancelled);
  return cancelled;
}
