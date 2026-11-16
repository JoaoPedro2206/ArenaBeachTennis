import { api } from './api';
import type { Agenda, BlockInput, PricingConfig, PricingInput, Reports } from '@/types/admin';
import type { CourtStatus } from '@/types/booking';

/** Painel do dono da arena (rotas exigem role ARENA_ADMIN) */
export const adminService = {
  agenda: (date: string | undefined, signal?: AbortSignal) => api<Agenda>('/admin/agenda', { params: { date }, signal }),

  block: (input: BlockInput) => api<{ block: { id: string } }>('/admin/block', { method: 'POST', body: input }),

  unblock: (blockId: string) => api<void>(`/admin/block/${blockId}`, { method: 'DELETE' }),

  setCourtStatus: (courtId: string, status: Extract<CourtStatus, 'ACTIVE' | 'MAINTENANCE'>) =>
    api<{ upcomingBookings: number }>(`/admin/courts/${courtId}/status`, { method: 'PATCH', body: { status } }),

  pricing: (signal?: AbortSignal) => api<PricingConfig>('/admin/pricing', { signal }),

  updatePricing: (input: PricingInput) => api<PricingConfig>('/admin/pricing', { method: 'PUT', body: input }),

  reports: (month: string | undefined, signal?: AbortSignal) => api<Reports>('/admin/reports', { params: { month }, signal }),
};
