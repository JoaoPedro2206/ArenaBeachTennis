import { randomInt } from 'node:crypto';

/**
 * Regras das Partidas ao Vivo num único lugar — valores que o produto pode
 * querer ajustar (pontos, janela da sala, tamanho do PIN) ficam aqui.
 */

/** A sala pode ser aberta a partir de X minutos antes do horário reservado */
export const LOBBY_OPENS_BEFORE_MIN = 120;

/** Salas esquecidas (não encerradas) expiram X minutos após o fim da reserva */
export const LOBBY_EXPIRES_AFTER_END_MIN = 120;

/** Mínimo de jogadores na sala para o anfitrião iniciar (1x1) */
export const MIN_PLAYERS_TO_START = 2;

/** Tamanho do PIN: 6 dígitos = 1 milhão de combinações */
export const PIN_LENGTH = 6;

/** Formatos pontuáveis pelo ELO: simples (1x1) ou duplas (2x2) */
export const RATED_TEAM_SIZES = [1, 2] as const;

const MINUTE = 60_000;

/** PIN aleatório criptograficamente seguro (não previsível), com zeros à esquerda */
export function generatePin(): string {
  return randomInt(0, 10 ** PIN_LENGTH).toString().padStart(PIN_LENGTH, '0');
}

/** A reserva está na janela em que faz sentido abrir a sala? */
export function isWithinLobbyWindow(booking: { startTime: Date; endTime: Date }, now = new Date()): boolean {
  const opensAt = booking.startTime.getTime() - LOBBY_OPENS_BEFORE_MIN * MINUTE;
  return now.getTime() >= opensAt && now < booking.endTime;
}

/** Momento a partir do qual uma sala não encerrada é considerada abandonada */
export function lobbyStaleAfter(bookingEnd: Date): Date {
  return new Date(bookingEnd.getTime() + LOBBY_EXPIRES_AFTER_END_MIN * MINUTE);
}
