import { Link } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { formatInZone } from '@/lib/dates';
import { capitalizeFirst } from '@/lib/format';
import { PATHS } from '@/routes/paths';
import { matchService } from '@/services/matchService';
import type { MatchHistoryItem } from '@/types/match';

const joinNames = (names: string[]) => (names.length <= 1 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`);

/** Últimas partidas pontuadas com a variação de ELO de cada uma */
export function MatchHistory() {
  const { data, loading, error, reload } = useAsync((signal) => matchService.history(signal), []);

  if (loading && !data) {
    return (
      <ul className="space-y-3" aria-busy="true" aria-label="Carregando histórico">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-[72px] animate-pulse rounded-lg bg-surface-muted" />
        ))}
      </ul>
    );
  }
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-danger-soft p-4 text-sm font-medium text-danger">
        {error}{' '}
        <button type="button" onClick={reload} className="font-bold text-primary hover:underline">
          Tentar novamente
        </button>
      </p>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg bg-surface-muted px-6 py-10 text-center">
        <p className="text-3xl" aria-hidden>
          🎾
        </p>
        <p className="mt-3 font-bold text-ink">Nenhuma partida pontuada ainda</p>
        <p className="mt-1 text-sm text-ink-muted">Jogue uma partida ao vivo para entrar no ranking.</p>
        <Link
          to={PATHS.live}
          className="mt-4 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-bold text-white transition-transform active:scale-95"
        >
          Ir para Ao Vivo
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {data.map((item, i) => (
        <HistoryRow key={item.matchId} item={item} index={i} />
      ))}
    </ul>
  );
}

function HistoryRow({ item, index }: { item: MatchHistoryItem; index: number }) {
  const when = formatInZone(item.startTime, item.timeZone);
  const vs = joinNames(item.opponents);
  const title = item.won ? `Vitória sobre ${vs}` : `Derrota para ${vs}`;

  return (
    <li className="flex animate-rise items-center gap-4 rounded-lg bg-surface p-3 pr-4 shadow-sm" style={{ animationDelay: `${index * 40}ms` }}>
      <span
        aria-hidden
        className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
          item.won ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}
      >
        {item.won ? 'V' : 'D'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-ink">
          {title}
          {item.upset && <span className="ml-1.5 rounded-full bg-cta px-1.5 py-0.5 align-middle text-[10px] font-extrabold text-cta-ink">ZEBRA</span>}
        </p>
        <p className="truncate text-[13px] text-ink-muted">
          {item.partners.length > 0 ? `com ${joinNames(item.partners)} · ` : ''}
          {capitalizeFirst(when.date)} · {item.courtName}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-lg leading-none font-extrabold tabular-nums ${item.won ? 'text-success' : 'text-danger'}`}>
          {item.eloDelta >= 0 ? '+' : '−'}
          {Math.abs(item.eloDelta)}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-ink-subtle tabular-nums">{item.eloAfter} pts</p>
      </div>
    </li>
  );
}
