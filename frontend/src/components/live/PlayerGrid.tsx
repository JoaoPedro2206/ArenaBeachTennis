import { Avatar } from '@/components/ui/Avatar';
import { LEVEL_INFO } from '@/types/auth';
import type { MatchParticipant } from '@/types/match';

interface PlayerGridProps {
  players: MatchParticipant[];
  maxPlayers: number;
  /** IDs que acabaram de entrar — recebem a animação de chegada */
  newcomers: Set<string>;
  /** Pontos a exibir em cada jogador (tela final) */
  showPoints?: boolean;
  currentUserId?: string;
}

/** Vagas da sala: jogadores com foto e vagas vazias "aguardando" */
export function PlayerGrid({ players, maxPlayers, newcomers, showPoints, currentUserId }: PlayerGridProps) {
  const emptySlots = Math.max(maxPlayers - players.length, 0);

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={`${players.length} de ${maxPlayers} jogadores`}>
      {players.map((player) => (
        <li
          key={player.userId}
          className={`relative flex flex-col items-center rounded-lg bg-surface px-3 pt-5 pb-4 text-center shadow-sm ${
            newcomers.has(player.userId) ? 'animate-pop' : ''
          }`}
        >
          {player.isHost && (
            <span className="absolute top-2 left-2 rounded-full bg-cta px-2 py-0.5 text-[10px] font-extrabold text-cta-ink">
              Anfitrião
            </span>
          )}
          <Avatar name={player.name} src={player.profilePhoto} size={64} className="ring-4 ring-primary-soft" />
          <p className="mt-3 w-full truncate text-[15px] font-bold text-ink">
            {player.name.split(' ')[0]}
            {player.userId === currentUserId && <span className="font-medium text-ink-subtle"> (você)</span>}
          </p>
          <p className="text-xs font-semibold text-ink-subtle tabular-nums">
            {LEVEL_INFO[player.level]?.name ?? player.level} · {player.eloScore}
          </p>
          {showPoints && player.eloDelta !== null && (
            <span
              className={`mt-2 animate-pop rounded-full px-3 py-1 text-sm font-extrabold tabular-nums ${
                player.eloDelta >= 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
              }`}
            >
              {player.eloDelta >= 0 ? '+' : '−'}
              {Math.abs(player.eloDelta)} pts
            </span>
          )}
        </li>
      ))}

      {Array.from({ length: emptySlots }, (_, i) => (
        <li
          key={`empty-${i}`}
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-surface-sunken px-3 pt-5 pb-4 text-center"
        >
          <span className="flex size-16 animate-pulse items-center justify-center rounded-full bg-surface-muted text-2xl text-ink-subtle">
            ?
          </span>
          <p className="mt-3 text-[13px] font-semibold text-ink-subtle">Aguardando…</p>
        </li>
      ))}
    </ul>
  );
}
