import { Prisma, type PlayerLevel } from '@prisma/client';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { categoryFor } from '../rating/categories';
import { applyDelta, calculateMatch, previewMatch, type Team } from '../rating/elo.service';
import {
  LOBBY_EXPIRES_AFTER_END_MIN,
  LOBBY_OPENS_BEFORE_MIN,
  MIN_PLAYERS_TO_START,
  generatePin,
  isWithinLobbyWindow,
} from './match-policy';
import { MatchesRepository, matchSelect, type MatchRecord } from './matches.repository';
import type { MatchResultInput, TeamsInput } from './matches.schemas';

const MINUTE = 60_000;
const PIN_GENERATION_ATTEMPTS = 8;

export interface MatchView {
  id: string;
  status: MatchRecord['status'];
  /** Só aparece para quem está na sala (é o "convite" para outros entrarem) */
  pinCode: string | null;
  maxPlayers: number;
  minPlayersToStart: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
  isHost: boolean;
  booking: MatchRecord['booking'];
  participants: Array<{
    userId: string;
    name: string;
    profilePhoto: string | null;
    eloScore: number;
    /** Categoria derivada do ELO atual */
    level: PlayerLevel;
    isHost: boolean;
    joinedAt: Date;
    /** Preenchidos quando a partida foi pontuada */
    team: number | null;
    eloBefore: number | null;
    eloAfter: number | null;
    eloDelta: number | null;
    /** Categoria antes desta partida — permite mostrar "subiu/caiu de categoria" */
    levelBefore: PlayerLevel | null;
  }>;
  /** null = partida ainda não pontuada (ou encerrada sem resultado) */
  result: MatchRecord['result'];
}

function toView(match: MatchRecord, viewerId: string): MatchView {
  return {
    id: match.id,
    status: match.status,
    pinCode: match.pinCode,
    maxPlayers: match.maxPlayers,
    minPlayersToStart: MIN_PLAYERS_TO_START,
    startedAt: match.startedAt,
    finishedAt: match.finishedAt,
    updatedAt: match.updatedAt,
    isHost: match.hostId === viewerId,
    booking: match.booking,
    participants: match.participants.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      profilePhoto: p.user.profilePhoto,
      eloScore: p.user.eloScore,
      level: categoryFor(p.user.eloScore).level,
      isHost: p.userId === match.hostId,
      joinedAt: p.joinedAt,
      team: p.team,
      eloBefore: p.eloBefore,
      eloAfter: p.eloAfter,
      eloDelta: p.eloDelta,
      levelBefore: p.eloBefore === null ? null : categoryFor(p.eloBefore).level,
    })),
    result: match.result,
  };
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export class MatchesService {
  constructor(private readonly matchesRepository = new MatchesRepository()) {}

  /** Libera PINs de salas esquecidas antes de qualquer operação que dependa deles */
  private async cancelStaleLobbies(now: Date): Promise<void> {
    await this.matchesRepository.cancelStale(new Date(now.getTime() - LOBBY_EXPIRES_AFTER_END_MIN * MINUTE));
  }

  async getCurrent(userId: string, now = new Date()): Promise<MatchView | null> {
    await this.cancelStaleLobbies(now);
    const match = await this.matchesRepository.findActiveForUser(userId);
    return match ? toView(match, userId) : null;
  }

  async getById(userId: string, matchId: string): Promise<MatchView> {
    const match = await this.matchesRepository.findById(matchId);
    // Quem não está na sala não enxerga nada dela (nem o PIN)
    if (!match || !match.participants.some((p) => p.userId === userId)) {
      throw new NotFoundError('Partida não encontrada');
    }
    return toView(match, userId);
  }

  /** Reservas pagas do usuário que já podem virar sala */
  listEligibleBookings(userId: string, now = new Date()) {
    const opensUntil = new Date(now.getTime() + LOBBY_OPENS_BEFORE_MIN * MINUTE);
    return this.matchesRepository.findEligibleBookings(userId, opensUntil, now);
  }

  /**
   * Abre a sala de uma reserva PAGA do próprio usuário e gera o PIN.
   * Idempotente: chamar de novo para a mesma reserva devolve a sala ativa.
   */
  async create(userId: string, bookingId: string, now = new Date()): Promise<MatchView> {
    await this.cancelStaleLobbies(now);

    const booking = await this.matchesRepository.findBookingForHost(bookingId);
    if (!booking || booking.userId !== userId) throw new NotFoundError('Reserva não encontrada');
    if (booking.type !== 'REGULAR') throw new ConflictError('Só reservas de quadra podem virar partida');

    // Antes do status da reserva: depois do jogo ela vira COMPLETED, e a
    // mensagem certa é "já teve partida", não "pague a reserva"
    const existing = await this.matchesRepository.findByBooking(bookingId);
    if (existing) {
      if (existing.status === 'WAITING' || existing.status === 'IN_PROGRESS') return toView(existing, userId);
      throw new ConflictError('Esta reserva já teve uma partida');
    }

    if (booking.status !== 'CONFIRMED') {
      throw new ConflictError('Conclua o pagamento da reserva antes de abrir a partida');
    }

    if (!isWithinLobbyWindow(booking, now)) {
      throw new AppError(
        `A sala abre a partir de ${LOBBY_OPENS_BEFORE_MIN / 60}h antes do horário reservado`,
        422,
        'LOBBY_NOT_OPEN_YET',
      );
    }
    await this.ensureNotInAnotherMatch(userId);

    // PIN único entre salas ativas: em caso (raro) de colisão, sorteia outro
    for (let attempt = 0; attempt < PIN_GENERATION_ATTEMPTS; attempt++) {
      try {
        const match = await this.matchesRepository.transaction((tx) =>
          tx.matchSession.create({
            data: {
              bookingId,
              hostId: userId,
              pinCode: generatePin(),
              status: 'WAITING',
              participants: { create: { userId, status: 'CONFIRMED' } },
            },
            select: matchSelect,
          }),
        );
        return toView(match, userId);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const target = (error as Prisma.PrismaClientKnownRequestError).meta?.target;
        if (!String(target).includes('pin_code')) {
          // bookingId duplicado: outra requisição abriu a sala ao mesmo tempo
          const created = await this.matchesRepository.findByBooking(bookingId);
          if (created) return toView(created, userId);
          throw error;
        }
      }
    }
    throw new AppError('Não foi possível gerar um código agora. Tente novamente.', 503, 'PIN_UNAVAILABLE');
  }

  /**
   * Entra na sala pelo PIN. A vaga é garantida mesmo com várias pessoas
   * digitando o código ao mesmo tempo: a linha da sala é travada (FOR UPDATE)
   * enquanto contamos os jogadores.
   */
  async join(userId: string, pin: string, now = new Date()): Promise<MatchView> {
    await this.cancelStaleLobbies(now);

    const match = await this.matchesRepository.findActiveByPin(pin);
    if (!match) throw new NotFoundError('Código inválido ou partida já encerrada');
    if (match.participants.some((p) => p.userId === userId)) return toView(match, userId); // já está dentro

    await this.ensureNotInAnotherMatch(userId);

    await this.matchesRepository.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM match_sessions WHERE id = ${match.id}::uuid FOR UPDATE`;
      const fresh = await tx.matchSession.findUnique({
        where: { id: match.id },
        select: { status: true, maxPlayers: true, _count: { select: { participants: true } } },
      });
      if (!fresh || (fresh.status !== 'WAITING' && fresh.status !== 'IN_PROGRESS')) {
        throw new ConflictError('Esta partida acabou de ser encerrada');
      }
      // Toque duplo em "Entrar": a segunda requisição espera a trava e encontra
      // o jogador já na sala — segue em frente em vez de estourar "registro duplicado"
      const already = await tx.matchParticipant.findUnique({
        where: { matchSessionId_userId: { matchSessionId: match.id, userId } },
        select: { id: true },
      });
      if (already) return;
      if (fresh._count.participants >= fresh.maxPlayers) throw new ConflictError('A sala está cheia');

      await tx.matchParticipant.create({ data: { matchSessionId: match.id, userId, status: 'CONFIRMED' } });
    });

    return this.getById(userId, match.id);
  }

  async start(userId: string, matchId: string, now = new Date()): Promise<MatchView> {
    const match = await this.findHosted(userId, matchId);
    if (match.status !== 'WAITING') throw new ConflictError('A partida já foi iniciada ou encerrada');
    if (match.participants.length < MIN_PLAYERS_TO_START) {
      throw new AppError(
        `Aguarde pelo menos ${MIN_PLAYERS_TO_START} jogadores na sala para iniciar`,
        422,
        'NOT_ENOUGH_PLAYERS',
      );
    }

    // Condição no WHERE: se a sala foi cancelada no mesmo instante (dois toques,
    // dois aparelhos), o "iniciar" não ressuscita uma partida cancelada
    const { count } = await this.matchesRepository.transaction((tx) =>
      tx.matchSession.updateMany({ where: { id: matchId, status: 'WAITING' }, data: { status: 'IN_PROGRESS', startedAt: now } }),
    );
    if (count === 0) throw new ConflictError('A partida já foi iniciada ou encerrada');
    return this.getById(userId, matchId);
  }

  /**
   * Prévia do ELO para a formação escolhida: chance de vitória e quanto cada
   * time ganha/perde. Ajuda o anfitrião a conferir os times antes de registrar.
   */
  async previewResult(userId: string, matchId: string, teams: TeamsInput) {
    const match = await this.findHosted(userId, matchId);
    this.assertTeamsMatchRoom(match, teams);
    const elo = new Map(match.participants.map((p) => [p.userId, p.user.eloScore]));
    return previewMatch(
      teams.team1.map((id) => elo.get(id)!),
      teams.team2.map((id) => elo.get(id)!),
    );
  }

  /**
   * Registra o resultado e aplica o ELO, tudo numa transação:
   * 1. trava a sala e os jogadores (FOR UPDATE) — duas requisições simultâneas
   *    nunca aplicam o resultado duas vezes nem leem ELO desatualizado;
   * 2. calcula a variação com o ELO ATUAL de cada um (lido dentro da trava);
   * 3. grava o novo ELO, a "foto" antes/depois de cada jogador e o MatchResult;
   * 4. encerra a sala e libera o PIN.
   */
  async recordResult(userId: string, matchId: string, input: MatchResultInput, now = new Date()): Promise<MatchView> {
    const match = await this.findHosted(userId, matchId);
    if (match.status === 'FINISHED') throw new ConflictError('O resultado desta partida já foi registrado');
    if (match.status !== 'IN_PROGRESS') throw new ConflictError('Inicie a partida antes de registrar o resultado');
    this.assertTeamsMatchRoom(match, input);

    const teamOf = new Map<string, Team>([
      ...input.team1.map((id) => [id, 1] as const),
      ...input.team2.map((id) => [id, 2] as const),
    ]);
    const playerIds = [...teamOf.keys()];

    await this.matchesRepository.transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM match_sessions WHERE id = ${matchId}::uuid FOR UPDATE`;
      if (locked?.status !== 'IN_PROGRESS') throw new ConflictError('O resultado desta partida já foi registrado');

      const rows = await tx.$queryRaw<Array<{ id: string; elo_score: number }>>`
        SELECT id, elo_score FROM users WHERE id = ANY(${playerIds}::uuid[]) FOR UPDATE`;
      const eloBefore = new Map(rows.map((r) => [r.id, r.elo_score]));

      const outcome = calculateMatch(
        input.team1.map((id) => eloBefore.get(id)!),
        input.team2.map((id) => eloBefore.get(id)!),
        input.winnerTeam,
      );

      for (const playerId of playerIds) {
        const before = eloBefore.get(playerId)!;
        const won = teamOf.get(playerId) === input.winnerTeam;
        const after = applyDelta(before, won ? outcome.winnerDelta : outcome.loserDelta);
        await tx.user.update({ where: { id: playerId }, data: { eloScore: after } });
        await tx.matchParticipant.update({
          where: { matchSessionId_userId: { matchSessionId: matchId, userId: playerId } },
          // delta REAL aplicado (pode ser menor que o calculado por causa do piso de ELO)
          data: { team: teamOf.get(playerId), eloBefore: before, eloAfter: after, eloDelta: after - before },
        });
      }

      await tx.matchResult.create({
        data: {
          matchSessionId: matchId,
          winnerTeam: input.winnerTeam,
          loserTeam: input.winnerTeam === 1 ? 2 : 1,
          team1AvgElo: outcome.team1Avg,
          team2AvgElo: outcome.team2Avg,
          winnerDelta: outcome.winnerDelta,
          loserDelta: outcome.loserDelta,
          winnerExpected: outcome.winnerExpected,
          kFactor: outcome.kFactor,
          recordedById: userId,
        },
      });
      await tx.matchSession.update({
        where: { id: matchId },
        data: { status: 'FINISHED', finishedAt: now, pinCode: null },
      });
      await tx.booking.update({ where: { id: match.booking.id }, data: { status: 'COMPLETED' } });
    });

    return this.getById(userId, matchId);
  }

  /**
   * Encerra SEM pontuar (jogo abandonado, amistoso, chuva...). Ninguém ganha
   * nem perde ELO. Idempotente.
   */
  async finish(userId: string, matchId: string, now = new Date()): Promise<MatchView> {
    const match = await this.findHosted(userId, matchId);
    if (match.status === 'FINISHED') return toView(match, userId);
    if (match.status !== 'IN_PROGRESS') throw new ConflictError('Inicie a partida antes de encerrar');

    await this.matchesRepository.transaction(async (tx) => {
      const { count } = await tx.matchSession.updateMany({
        where: { id: matchId, status: 'IN_PROGRESS' },
        data: { status: 'FINISHED', finishedAt: now, pinCode: null },
      });
      if (count > 0) await tx.booking.update({ where: { id: match.booking.id }, data: { status: 'COMPLETED' } });
    });
    return this.getById(userId, matchId);
  }

  /** Últimas partidas pontuadas do usuário, com a variação de ELO de cada uma */
  async listHistory(userId: string) {
    const rows = await this.matchesRepository.findRatedHistory(userId);
    return rows.map(({ team, eloAfter, eloDelta, matchSession }) => {
      const firstNames = (t: number | null) =>
        matchSession.participants.filter((p) => p.team === t && p.userId !== userId).map((p) => p.user.name.split(' ')[0]);
      const won = team === matchSession.result?.winnerTeam;
      const winnerExpected = matchSession.result?.winnerExpected ?? 0.5;
      return {
        matchId: matchSession.id,
        playedAt: matchSession.finishedAt,
        startTime: matchSession.booking.startTime,
        timeZone: matchSession.booking.court.arena.timezone,
        courtName: matchSession.booking.court.name,
        won,
        eloDelta: eloDelta!,
        eloAfter: eloAfter!,
        partners: firstNames(team),
        opponents: firstNames(team === 1 ? 2 : 1),
        /** Vitória com menos de 40% de chance */
        upset: won && winnerExpected < 0.4,
      };
    });
  }

  /** Todos da sala jogam: os times precisam conter exatamente os participantes */
  private assertTeamsMatchRoom(match: MatchRecord, teams: TeamsInput): void {
    const inRoom = new Set(match.participants.map((p) => p.userId));
    const assigned = [...teams.team1, ...teams.team2];
    if (assigned.some((id) => !inRoom.has(id))) throw new ValidationError('Há jogadores nos times que não estão na sala');
    if (assigned.length !== inRoom.size) {
      throw new ValidationError(
        inRoom.size === 2 || inRoom.size === 4
          ? 'Coloque todos os jogadores da sala em um dos times'
          : `Partidas pontuadas são 1x1 ou 2x2 — a sala tem ${inRoom.size} jogadores`,
      );
    }
  }

  /** Convidado sai da sala antes do jogo começar */
  async leave(userId: string, matchId: string): Promise<void> {
    const match = await this.getById(userId, matchId);
    if (match.isHost) throw new ConflictError('O anfitrião não sai da sala: cancele a partida');
    if (match.status !== 'WAITING') throw new ConflictError('Não é possível sair de uma partida em andamento');

    await this.matchesRepository.transaction((tx) =>
      tx.matchParticipant.delete({ where: { matchSessionId_userId: { matchSessionId: matchId, userId } } }),
    );
  }

  /** Anfitrião desiste antes de começar: sala fecha e o PIN é liberado */
  async cancel(userId: string, matchId: string): Promise<MatchView> {
    const match = await this.findHosted(userId, matchId);
    if (match.status !== 'WAITING') throw new ConflictError('Só é possível cancelar antes de iniciar');

    const { count } = await this.matchesRepository.transaction((tx) =>
      tx.matchSession.updateMany({ where: { id: matchId, status: 'WAITING' }, data: { status: 'CANCELLED', pinCode: null } }),
    );
    if (count === 0) throw new ConflictError('Só é possível cancelar antes de iniciar');
    return this.getById(userId, matchId);
  }

  private async findHosted(userId: string, matchId: string): Promise<MatchRecord> {
    const match = await this.matchesRepository.findById(matchId);
    if (!match || !match.participants.some((p) => p.userId === userId)) {
      throw new NotFoundError('Partida não encontrada');
    }
    if (match.hostId !== userId) throw new ForbiddenError('Só quem abriu a partida pode fazer isso');
    return match;
  }

  /** Uma partida ao vivo por vez: evita pontos duplicados e confusão de salas */
  private async ensureNotInAnotherMatch(userId: string): Promise<void> {
    const active = await this.matchesRepository.findActiveForUser(userId);
    if (active) {
      throw new AppError('Você já está em outra partida ao vivo. Saia dela antes.', 409, 'ALREADY_IN_MATCH');
    }
  }
}
