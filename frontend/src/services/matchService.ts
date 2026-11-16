import { api } from './api';
import type { EligibleBooking, LiveMatch, MatchHistoryItem, ResultPreview, TeamNumber, Teams } from '@/types/match';

const unwrap = (r: { match: LiveMatch }) => r.match;

/** Partidas ao vivo (salas com PIN) */
export const matchService = {
  /** Sala ativa do usuário — restaura o lobby se ele recarregar a página */
  current: (signal?: AbortSignal) => api<{ match: LiveMatch | null }>('/matches/current', { signal }).then((r) => r.match),

  get: (matchId: string, signal?: AbortSignal) => api<{ match: LiveMatch }>(`/matches/${matchId}`, { signal }).then(unwrap),

  eligibleBookings: (signal?: AbortSignal) =>
    api<{ bookings: EligibleBooking[] }>('/matches/eligible-bookings', { signal }).then((r) => r.bookings),

  create: (bookingId: string) => api<{ match: LiveMatch }>('/matches/create', { method: 'POST', body: { bookingId } }).then(unwrap),
  join: (pin: string) => api<{ match: LiveMatch }>('/matches/join', { method: 'POST', body: { pin } }).then(unwrap),
  start: (matchId: string) => api<{ match: LiveMatch }>('/matches/start', { method: 'POST', body: { matchId } }).then(unwrap),
  /** Encerra SEM pontuar (amistoso, jogo interrompido) */
  finish: (matchId: string) => api<{ match: LiveMatch }>('/matches/finish', { method: 'POST', body: { matchId } }).then(unwrap),

  /** Chance de vitória e +X/−Y de cada time para a formação escolhida */
  previewResult: (matchId: string, teams: Teams, signal?: AbortSignal) =>
    api<{ preview: ResultPreview }>(`/matches/${matchId}/result/preview`, { method: 'POST', body: teams, signal }).then((r) => r.preview),

  /** Registra o resultado e aplica o ELO */
  recordResult: (matchId: string, teams: Teams, winnerTeam: TeamNumber) =>
    api<{ match: LiveMatch }>(`/matches/${matchId}/result`, { method: 'POST', body: { ...teams, winnerTeam } }).then(unwrap),

  history: (signal?: AbortSignal) =>
    api<{ matches: MatchHistoryItem[] }>('/matches/history', { signal }).then((r) => r.matches),
  cancel: (matchId: string) => api<{ match: LiveMatch }>('/matches/cancel', { method: 'POST', body: { matchId } }).then(unwrap),
  leave: (matchId: string) => api<void>('/matches/leave', { method: 'POST', body: { matchId } }),
};
