import { useState } from 'react';
import { LiveEntry } from '@/components/live/LiveEntry';
import { LiveLobby } from '@/components/live/LiveLobby';
import { useAsync } from '@/hooks/useAsync';
import { matchService } from '@/services/matchService';
import type { LiveMatch } from '@/types/match';

/**
 * Aba "Ao Vivo".
 * - Sem sala ativa: entrar com código OU abrir a sala da própria reserva
 * - Com sala ativa: lobby (restaurado mesmo após recarregar a página)
 */
export default function LiveMatchPage() {
  const current = useAsync((signal) => matchService.current(signal), []);
  // undefined = ainda não decidido pelo usuário nesta visita; null = saiu da sala
  const [picked, setPicked] = useState<LiveMatch | null | undefined>(undefined);

  if (current.loading && picked === undefined) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Carregando">
        <div className="h-16 w-2/3 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-surface-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
      </div>
    );
  }

  // Sem saber se já existe uma sala ativa, não dá para mostrar "entrar/abrir":
  // o jogador acharia que não está em partida nenhuma
  if (current.error && picked === undefined) {
    return (
      <div role="alert" className="rounded-xl bg-danger-soft px-6 py-10 text-center">
        <p className="text-3xl" aria-hidden>
          📡
        </p>
        <p className="mt-3 font-bold text-ink">Não conseguimos carregar sua partida</p>
        <p className="mt-1 text-sm text-danger">{current.error}</p>
        <button
          type="button"
          onClick={current.reload}
          className="mt-5 h-11 rounded-full bg-ink px-6 text-sm font-bold text-white transition-transform active:scale-95"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const match = picked === undefined ? current.data : picked;

  if (match) {
    // key: trocar de sala reinicia o lobby (polling, recém-chegados)
    return <LiveLobby key={match.id} initial={match} onExit={() => setPicked(null)} />;
  }
  return <LiveEntry onEnterMatch={setPicked} />;
}
