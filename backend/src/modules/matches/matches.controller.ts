import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/ensureAuthenticated';
import { MatchesService } from './matches.service';
import {
  createMatchSchema,
  joinMatchSchema,
  matchIdBodySchema,
  matchIdParamsSchema,
  matchResultSchema,
  teamsSchema,
} from './matches.schemas';

export class MatchesController {
  constructor(private readonly matchesService = new MatchesService()) {}

  /** GET /matches/current — sala ativa do usuário (ou null) */
  current = async (req: Request, res: Response): Promise<void> => {
    res.json({ match: await this.matchesService.getCurrent(getAuthUser(req).id) });
  };

  /** GET /matches/eligible-bookings — reservas que podem virar sala agora */
  eligibleBookings = async (req: Request, res: Response): Promise<void> => {
    res.json({ bookings: await this.matchesService.listEligibleBookings(getAuthUser(req).id) });
  };

  /** GET /matches/:id — usado pelo polling da sala */
  show = async (req: Request, res: Response): Promise<void> => {
    const { id } = matchIdParamsSchema.parse(req.params);
    res.json({ match: await this.matchesService.getById(getAuthUser(req).id, id) });
  };

  /** POST /matches/create { bookingId } */
  create = async (req: Request, res: Response): Promise<void> => {
    const { bookingId } = createMatchSchema.parse(req.body);
    res.status(201).json({ match: await this.matchesService.create(getAuthUser(req).id, bookingId) });
  };

  /** POST /matches/join { pin } */
  join = async (req: Request, res: Response): Promise<void> => {
    const { pin } = joinMatchSchema.parse(req.body);
    res.json({ match: await this.matchesService.join(getAuthUser(req).id, pin) });
  };

  /** POST /matches/start { matchId } */
  start = async (req: Request, res: Response): Promise<void> => {
    const { matchId } = matchIdBodySchema.parse(req.body);
    res.json({ match: await this.matchesService.start(getAuthUser(req).id, matchId) });
  };

  /** POST /matches/:id/result { team1, team2, winnerTeam } — aplica o ELO */
  recordResult = async (req: Request, res: Response): Promise<void> => {
    const { id } = matchIdParamsSchema.parse(req.params);
    const data = matchResultSchema.parse(req.body);
    res.json({ match: await this.matchesService.recordResult(getAuthUser(req).id, id, data) });
  };

  /** POST /matches/:id/result/preview { team1, team2 } — quanto cada time ganha/perde */
  previewResult = async (req: Request, res: Response): Promise<void> => {
    const { id } = matchIdParamsSchema.parse(req.params);
    const teams = teamsSchema.parse(req.body);
    res.json({ preview: await this.matchesService.previewResult(getAuthUser(req).id, id, teams) });
  };

  /** GET /matches/history — últimas partidas pontuadas do usuário */
  history = async (req: Request, res: Response): Promise<void> => {
    res.json({ matches: await this.matchesService.listHistory(getAuthUser(req).id) });
  };

  /** POST /matches/finish { matchId } — encerra SEM pontuar */
  finish = async (req: Request, res: Response): Promise<void> => {
    const { matchId } = matchIdBodySchema.parse(req.body);
    res.json({ match: await this.matchesService.finish(getAuthUser(req).id, matchId) });
  };

  /** POST /matches/leave { matchId } */
  leave = async (req: Request, res: Response): Promise<void> => {
    const { matchId } = matchIdBodySchema.parse(req.body);
    await this.matchesService.leave(getAuthUser(req).id, matchId);
    res.status(204).end();
  };

  /** POST /matches/cancel { matchId } */
  cancel = async (req: Request, res: Response): Promise<void> => {
    const { matchId } = matchIdBodySchema.parse(req.body);
    res.json({ match: await this.matchesService.cancel(getAuthUser(req).id, matchId) });
  };
}
