/** Espelham as respostas dos módulos courts e bookings do backend */
export type CourtStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';

/** PENDING_PAYMENT -> CONFIRMED (pagou no prazo) | CANCELLED (expirou ou cancelada) */
export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type BookingType = 'REGULAR' | 'OPEN_MATCH' | 'CLASS' | 'MAINTENANCE';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';

export interface Court {
  id: string;
  name: string;
  status: CourtStatus;
  isCovered: boolean;
  hasLighting: boolean;
  slotDurationMin: number;
  pricePerHour: number; // centavos
  arena: { id: string; name: string; timezone: string };
}

export interface TimeSlot {
  startTime: string; // ISO UTC
  endTime: string;
  label: string; // "18:00" no fuso da arena
  price: number; // centavos
  /** Regra de preço aplicada (ex.: "Horário nobre"); null = preço base */
  priceRule?: string | null;
  available: boolean;
  /** Motivo de estar indisponível (reserva, aula ou manutenção) */
  blockedBy?: 'BOOKING' | 'CLASS' | 'MAINTENANCE' | null;
}

export interface CourtAvailability {
  court: { id: string; name: string; status: CourtStatus };
  arena: { id: string; name: string };
  date: string; // YYYY-MM-DD
  timeZone: string;
  slotDurationMin: number;
  slots: TimeSlot[];
}

export interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  type: BookingType;
  status: BookingStatus;
  totalPrice: number;
  paymentStatus: PaymentStatus;
  /** Prazo para pagar (só em PENDING_PAYMENT) */
  expiresAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  court: { id: string; name: string; arena: { id: string; name: string; timezone: string } };
}

export interface CreateBookingInput {
  courtId: string;
  startTime: string;
  durationMin?: number;
  notes?: string;
}
