import type { Request, Response } from 'express';
import { getAuthUser } from '../../shared/middlewares/ensureAuthenticated';
import { AdminService } from './admin.service';
import { ReportsService } from './reports.service';
import {
  agendaQuerySchema,
  arenaQuerySchema,
  blockSchema,
  courtStatusSchema,
  idParamsSchema,
  pricingSchema,
  reportsQuerySchema,
} from './admin.schemas';

/**
 * Painel do dono da arena. Toda rota opera SÓ na arena do usuário logado
 * (`?arenaId=` escolhe entre arenas dele; padrão = a primeira).
 */
export class AdminController {
  constructor(
    private readonly adminService = new AdminService(),
    private readonly reportsService = new ReportsService(),
  ) {}

  /** GET /admin/agenda?date=YYYY-MM-DD */
  agenda = async (req: Request, res: Response): Promise<void> => {
    const query = agendaQuerySchema.parse(req.query);
    res.json(await this.adminService.getAgenda(getAuthUser(req).id, query));
  };

  /** POST /admin/block { courtId, startTime, endTime, reason? } */
  block = async (req: Request, res: Response): Promise<void> => {
    const { arenaId } = arenaQuerySchema.parse(req.query);
    const data = blockSchema.parse(req.body);
    res.status(201).json(await this.adminService.blockSlot(getAuthUser(req).id, arenaId, data));
  };

  /** DELETE /admin/block/:id */
  unblock = async (req: Request, res: Response): Promise<void> => {
    const { arenaId } = arenaQuerySchema.parse(req.query);
    const { id } = idParamsSchema.parse(req.params);
    await this.adminService.unblock(getAuthUser(req).id, arenaId, id);
    res.status(204).end();
  };

  /** PATCH /admin/courts/:id/status { status } — quadra inteira em manutenção */
  courtStatus = async (req: Request, res: Response): Promise<void> => {
    const { arenaId } = arenaQuerySchema.parse(req.query);
    const { id } = idParamsSchema.parse(req.params);
    const { status } = courtStatusSchema.parse(req.body);
    res.json(await this.adminService.setCourtStatus(getAuthUser(req).id, arenaId, id, status));
  };

  /** GET /admin/pricing */
  pricing = async (req: Request, res: Response): Promise<void> => {
    const { arenaId } = arenaQuerySchema.parse(req.query);
    res.json(await this.adminService.getPricing(getAuthUser(req).id, arenaId));
  };

  /** PUT /admin/pricing { courts, rules } — substitui a configuração inteira */
  updatePricing = async (req: Request, res: Response): Promise<void> => {
    const { arenaId } = arenaQuerySchema.parse(req.query);
    const data = pricingSchema.parse(req.body);
    res.json(await this.adminService.updatePricing(getAuthUser(req).id, arenaId, data));
  };

  /** GET /admin/reports?month=YYYY-MM */
  reports = async (req: Request, res: Response): Promise<void> => {
    const query = reportsQuerySchema.parse(req.query);
    res.json(await this.reportsService.getReports(getAuthUser(req).id, query));
  };
}
