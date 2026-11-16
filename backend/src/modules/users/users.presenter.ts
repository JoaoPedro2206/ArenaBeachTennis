import type { PlayerLevel } from '@prisma/client';
import { rankInfo, type RankInfo } from '../rating/categories';
import type { PublicUser } from './users.repository';

/**
 * Formato do usuário na API. A categoria (`level`) NÃO é mais uma coluna:
 * é calculada a partir do ELO, junto com o progresso para a próxima (`rank`).
 */
export type UserView = PublicUser & { level: PlayerLevel; rank: RankInfo };

export function presentUser(user: PublicUser): UserView {
  const rank = rankInfo(user.eloScore);
  return { ...user, level: rank.level, rank };
}
