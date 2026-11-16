import type { Request, Response } from 'express';
import { z } from 'zod';
import { CourtsRepository } from './courts.repository';

const listQuerySchema = z.object({
  arenaId: z.string().uuid('ID de arena inválido').optional(),
});

export class CourtsController {
  constructor(private readonly courtsRepository = new CourtsRepository()) {}

  /** GET /courts?arenaId= — leitura simples, sem regra de negócio (dispensa service) */
  list = async (req: Request, res: Response): Promise<void> => {
    const { arenaId } = listQuerySchema.parse(req.query);
    res.json({ courts: await this.courtsRepository.findPublic(arenaId) });
  };
}
