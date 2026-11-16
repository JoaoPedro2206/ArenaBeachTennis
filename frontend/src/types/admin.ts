/** Espelham as respostas de /admin/* (módulo admin do backend) */
import type { BookingStatus, CourtStatus, PaymentStatus } from './booking';

export interface AdminArena {
  id: string;
  name: string;
  timezone: string;
}

// ---------------------------------------------------------------- agenda

export type AgendaEventKind = 'BOOKING' | 'CLASS' | 'MAINTENANCE';

export interface AgendaEvent {
  id: string;
  kind: AgendaEventKind;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  startTime: string;
  endTime: string;
  /** Minutos desde a meia-noite local, já recortados ao dia exibido */
  startMin: number;
  endMin: number;
  timeLabel: string;
  title: string;
  subtitle: string | null;
  customer: { name: string; phone: string | null } | null;
  totalPrice: number;
  notes: string | null;
  expiresAt: string | null;
}

export interface AgendaSlot {
  startTime: string;
  endTime: string;
  startMin: number;
  endMin: number;
  label: string;
  price: number;
  priceRule: string | null;
  past: boolean;
}

export interface AgendaCourt {
  id: string;
  name: string;
  status: CourtStatus;
  isCovered: boolean;
  slotDurationMin: number;
  openMin: number;
  closeMin: number;
  events: AgendaEvent[];
  /** Só os horários livres (os ocupados aparecem em `events`) */
  slots: AgendaSlot[];
}

export interface Agenda {
  arena: AdminArena;
  date: string;
  today: string;
  now: string;
  courts: AgendaCourt[];
  summary: {
    bookings: number;
    classes: number;
    blocks: number;
    freeSlots: number;
    paidRevenue: number;
    pendingPayments: number;
  };
}

export interface BlockInput {
  courtId: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

// ---------------------------------------------------------------- preços

export interface PricingCourt {
  id: string;
  name: string;
  status: CourtStatus;
  pricePerHour: number;
  slotDurationMin: number;
  openTime: string;
  closeTime: string;
}

export interface PricingRule {
  id?: string;
  name: string;
  /** null = todas as quadras */
  courtId: string | null;
  /** 0 = domingo ... 6 = sábado */
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  pricePerHour: number;
}

export interface PricingConfig {
  arena: AdminArena;
  courts: PricingCourt[];
  rules: PricingRule[];
}

export interface PricingInput {
  courts: Array<{ courtId: string; pricePerHour: number }>;
  rules: PricingRule[];
}

// ---------------------------------------------------------------- relatórios

export interface CourtOccupancy {
  courtId: string;
  name: string;
  status: CourtStatus;
  occupancyRate: number;
  revenue: number;
  bookedHours: number;
  blockedHours: number;
}

export interface HourOccupancy {
  hour: number;
  bookedHours: number;
  occupancyRate: number;
}

export interface Reports {
  arena: AdminArena;
  month: string;
  generatedAt: string;
  revenue: {
    total: number;
    previousMonth: number;
    changeRate: number | null;
    pending: number;
    paidBookings: number;
    averageTicket: number;
    byDay: Array<{ date: string; revenue: number }>;
  };
  occupancy: {
    rate: number;
    bookedHours: number;
    availableHours: number;
    byCourt: CourtOccupancy[];
  };
  peakHours: { byHour: HourOccupancy[]; top: number[] };
  today: { date: string; bookings: number; classes: number; paidRevenue: number; pendingPayments: number };
}
