import type { RankInfo } from '@/types/auth';
import { CategoryBadge } from './CategoryBadge';

/** Categoria atual + barra de progresso até a próxima ("Faltam 45 pontos para a Categoria C") */
export function RankCard({ rank }: { rank: RankInfo }) {
  return (
    <section aria-label="Seu ranking" className="rounded-xl bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-5">
        <CategoryBadge level={rank.level} size="lg" />
        <div className="min-w-0">
          <p className="eyebrow">Sua categoria</p>
          <p className="mt-0.5 text-2xl leading-tight font-extrabold text-ink">{rank.name}</p>
          <p className="mt-1 text-sm text-ink-muted">
            <strong className="text-lg font-extrabold text-ink tabular-nums">{rank.eloScore}</strong> pontos de ranking
          </p>
        </div>
      </div>

      {rank.next ? (
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <p className="font-semibold text-ink">
              Faltam <strong className="text-primary tabular-nums">{rank.next.pointsToGo}</strong>{' '}
              {rank.next.pointsToGo === 1 ? 'ponto' : 'pontos'} para a {rank.next.name}
            </p>
            <span className="text-xs font-bold text-ink-subtle tabular-nums">{rank.progress}%</span>
          </div>
          <div
            className="mt-2 h-3 overflow-hidden rounded-full bg-surface-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={rank.progress}
            aria-label={`Progresso para a ${rank.next.name}`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-[#3fb4dc] transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(rank.progress, 3)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-ink-subtle tabular-nums">
            <span>{rank.name}</span>
            <span>
              {rank.next.name} · {rank.next.minElo}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-ink px-4 py-3 text-center text-sm font-bold text-cta">
          🏆 Você está no topo: Categoria A
        </p>
      )}

      <p className="mt-4 text-xs text-ink-subtle">
        Sua categoria sobe e desce conforme os resultados nas partidas ao vivo. Vencer quem está acima de você vale mais.
      </p>
    </section>
  );
}
