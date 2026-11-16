import type { PlayerLevel } from './auth';

/** Espelham as respostas do módulo de partidas ao vivo do backend */
export type MatchStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
export type TeamNumber = 1 | 2;

export interface MatchParticipant {
  userId: string;
  name: string;
  profilePhoto: string | null;
  eloScore: number;
  /** Categoria derivada do ELO */
  level: PlayerLevel;
  isHost: boolean;
  joinedAt: string;
  /** Preenchidos quando a partida foi pontuada */
  team: TeamNumber | null;
  eloBefore: number | null;
  eloAfter: number | null;
  eloDelta: number | null;
  /** Categoria antes desta partida (para "subiu/caiu de categoria") */
  levelBefore: PlayerLevel | null;
}

export interface MatchResult {
  winnerTeam: TeamNumber;
  team1AvgElo: number;
  team2AvgElo: number;
  winnerDelta: number;
  loserDelta: number;
  /** 0–1: chance que o vencedor tinha */
  winnerExpected: number;
}

export interface LiveMatch {
  id: string;
  status: MatchStatus;
  pinCode: string | null;
  maxPlayers: number;
  minPlayersToStart: number;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  isHost: boolean;
  booking: {
    id: string;
    startTime: string;
    endTime: string;
    court: { id: string; name: string; arena: { id: string; name: string; timezone: string } };
  };
  participants: MatchParticipant[];
  /** null = ainda não pontuada, ou encerrada sem resultado */
  result: MatchResult | null;
}

export interface EligibleBooking {
  id: string;
  startTime: string;
  endTime: string;
  court: { id: string; name: string; arena: { id: string; name: string; timezone: string } };
}

export interface Teams {
  team1: string[];
  team2: string[];
}

export interface TeamPreview {
  avgElo: number;
  /** 0–100 */
  winChance: number;
  ifWin: number;
  ifLose: number;
}

export interface ResultPreview {
  team1: TeamPreview;
  team2: TeamPreview;
}

export interface MatchHistoryItem {
  matchId: string;
  playedAt: string;
  startTime: string;
  timeZone: string;
  courtName: string;
  won: boolean;
  eloDelta: number;
  eloAfter: number;
  partners: string[];
  opponents: string[];
  /** Vitória com menos de 40% de chance */
  upset: boolean;
}
