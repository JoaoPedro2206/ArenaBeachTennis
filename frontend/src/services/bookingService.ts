import { api } from './api';
import {
  MOCK_COURTS,
  mockAvailability,
  mockCancelBooking,
  mockCreateBooking,
  mockPayBooking,
} from './mocks/bookingMocks';
import type { Booking, Court, CourtAvailability, CreateBookingInput } from '@/types/booking';

/** VITE_USE_MOCKS=true troca a API real por dados falsos, sem mudar as telas */
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

/** Quadras, horários e reservas */
export const bookingService = {
  listCourts: (signal?: AbortSignal): Promise<Court[]> =>
    USE_MOCKS ? Promise.resolve(MOCK_COURTS) : api<{ courts: Court[] }>('/courts', { signal }).then((r) => r.courts),

  getAvailability: (courtId: string, date: string, signal?: AbortSignal): Promise<CourtAvailability> =>
    USE_MOCKS
      ? mockAvailability(courtId, date)
      : api<CourtAvailability>(`/courts/${courtId}/availability`, { params: { date }, signal }),

  createBooking: (input: CreateBookingInput): Promise<Booking> =>
    USE_MOCKS
      ? mockCreateBooking(input)
      : api<{ booking: Booking }>('/bookings', { method: 'POST', body: input }).then((r) => r.booking),

  listMine: (scope: 'upcoming' | 'past' = 'upcoming', signal?: AbortSignal): Promise<Booking[]> =>
    USE_MOCKS
      ? Promise.resolve([])
      : api<{ bookings: Booking[] }>('/bookings/me', { params: { scope }, signal }).then((r) => r.bookings),

  /** Pagamento SIMULADO: confirma a reserva se ainda estiver no prazo (410 se expirou) */
  pay: (bookingId: string): Promise<Booking> =>
    USE_MOCKS
      ? mockPayBooking(bookingId)
      : api<{ booking: Booking }>(`/bookings/${bookingId}/pay`, { method: 'POST' }).then((r) => r.booking),

  /** Cancela a própria reserva (pendente: sempre; confirmada: só com 24h de antecedência) */
  cancel: (bookingId: string): Promise<Booking> =>
    USE_MOCKS
      ? mockCancelBooking(bookingId)
      : api<{ booking: Booking }>(`/bookings/${bookingId}/cancel`, { method: 'PATCH' }).then((r) => r.booking),
};
