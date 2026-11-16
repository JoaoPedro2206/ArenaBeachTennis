import { useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/services/api';
import { matchService } from '@/services/matchService';
import type { LiveMatch, TeamNumber, Teams } from '@/types/match';

interface ResultSheetProps {
  match: LiveMatch;
  onClose: () => void;
  onRecorded: (match: LiveMatch) => void;
}

/** Sugestão inicial: ordem de chegada — os dois primeiros x os dois últimos */
function defaultAssignment(match: LiveMatch): Record<string, TeamNumber> {
  const half = match.participants.length / 2;
  return Object.fromEntries(match.participants.map((p, i) => [p.userId, i < half ? 1 : 2]));
}

/**
 * Registro do resultado pelo anfitrião:
 * 1) monta os times (1x1 ou 2x2) — a prévia do ELO atualiza a cada troca;
 * 2) toca no time vencedor; 3) confirma. O cálculo é todo do backend.
 */
export function ResultSheet({ match, onClose, onRecorded }: ResultSheetProps) {
  const toast = useToast();
  const [assignment, setAssignment] = useState(() => defaultAssignment(match));
  const [winner, setWinner] = useState<TeamNumber | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const size = match.participants.length;
  const rateable = size === 2 || size === 4;
  const teamLabel = size === 4 ? 'Dupla' : 'Lado';

  const teams = useMemo<Teams>(
    () => ({
      team1: match.participants.filter((p) => assignment[p.userId] === 1).map((p) => p.userId),
      team2: match.participants.filter((p) => assignment[p.userId] === 2).map((p) => p.userId),
    }),
    [assignment, match.participants],
  );
  const balanced = rateable && teams.team1.length === teams.team2.length;
  const teamsKey = `${teams.team1.join(',')}|${teams.team2.join(',')}`;

  const preview = useAsync((signal) => matchService.previewResult(match.id, teams, signal), [teamsKey], balanced);
  // Só vale a prévia da formação ATUAL: enquanto recarrega (ou se os times
  // estão incompletos), não mostra os números da formação anterior
  const previewData = balanced && !preview.loading && !preview.error ? preview.data : null;

  function assign(userId: string, team: TeamNumber) {
    setAssignment((current) => ({ ...current, [userId]: team }));
    setWinner(null); // trocou o time: o vencedor precisa ser escolhido de novo
  }

  async function confirm() {
    if (!winner || !balanced) return;
    setSubmitting(true);
    try {
      onRecorded(await matchService.recordResult(match.id, teams, winner));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível registrar o resultado.');
      setSubmitting(false);
    }
  }

  const playersOf = (team: TeamNumber) => match.participants.filter((p) => assignment[p.userId] === team);

  return (
    <Modal
      open
      fullScreen
      onClose={onClose}
      dismissible={!submitting}
      title="Resultado da partida"
      description="Monte os times e escolha quem venceu"
      footer={
        <Button size="lg" onClick={confirm} loading={submitting} disabled={!winner || !balanced}>
          {submitting ? 'Calculando ranking…' : winner ? `Confirmar vitória da ${teamLabel} ${winner}` : 'Escolha o vencedor'}
        </Button>
      }
    >
      <div className="mx-auto max-w-md space-y-8">
        {!rateable && (
          <p role="alert" className="rounded-lg bg-warning-soft px-4 py-3 text-sm font-semibold text-warning-ink">
            Partidas pontuadas são 1x1 ou 2x2 — a sala tem {size} jogadores. Encerre sem pontuar ou aguarde mais um jogador.
          </p>
        )}

        {/* 1. Times */}
        <section aria-labelledby="teams-title">
          <h3 id="teams-title" className="mb-3 text-base font-extrabold text-ink">
            1. Quem jogou com quem?
          </h3>
          <ul className="space-y-2">
            {match.participants.map((p) => (
              <li key={p.userId} className="flex items-center gap-3 rounded-lg bg-surface p-3 shadow-xs">
                <Avatar name={p.name} src={p.profilePhoto} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-ink">{p.name.split(' ')[0]}</p>
                  <p className="text-xs text-ink-subtle tabular-nums">{p.eloScore} pts</p>
                </div>
                <div role="radiogroup" aria-label={`Time de ${p.name}`} className="flex rounded-full bg-surface-muted p-1">
                  {([1, 2] as const).map((team) => {
                    const selected = assignment[p.userId] === team;
                    return (
                      <button
                        key={team}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={submitting}
                        onClick={() => assign(p.userId, team)}
                        className={`h-9 rounded-full px-3 text-xs font-extrabold transition-all ${
                          selected ? (team === 1 ? 'bg-primary text-white shadow-sm' : 'bg-accent text-white shadow-sm') : 'text-ink-muted'
                        }`}
                      >
                        {teamLabel} {team}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          {rateable && !balanced && (
            <p className="mt-3 text-sm font-semibold text-danger">
              Os dois lados precisam ter {size / 2} {size === 4 ? 'jogadores' : 'jogador'}.
            </p>
          )}
        </section>

        {/* 2. Vencedor */}
        <section aria-labelledby="winner-title">
          <h3 id="winner-title" className="mb-3 text-base font-extrabold text-ink">
            2. Quem venceu?
          </h3>
          <div role="radiogroup" aria-label="Time vencedor" className="grid grid-cols-2 gap-3">
            {([1, 2] as const).map((team) => {
              const info = previewData?.[team === 1 ? 'team1' : 'team2'];
              const selected = winner === team;
              return (
                <button
                  key={team}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!balanced || submitting}
                  onClick={() => setWinner(team)}
                  className={`relative flex flex-col items-center rounded-xl p-4 text-center transition-all duration-200 active:scale-[0.98] disabled:opacity-50 ${
                    selected ? 'bg-ink text-white shadow-lg ring-4 ring-cta' : 'bg-surface text-ink shadow-sm hover:-translate-y-0.5'
                  }`}
                >
                  {selected && (
                    <span className="absolute -top-3 rounded-full bg-cta px-3 py-1 text-[11px] font-extrabold text-cta-ink">🏆 Venceu</span>
                  )}
                  <span className={`text-xs font-extrabold tracking-wider uppercase ${team === 1 ? 'text-primary' : 'text-accent'}`}>
                    {teamLabel} {team}
                  </span>
                  <span className="mt-3 flex -space-x-3">
                    {playersOf(team).map((p) => (
                      <span key={p.userId} className={`rounded-full ring-4 ${selected ? 'ring-ink' : 'ring-surface'}`}>
                        <Avatar name={p.name} src={p.profilePhoto} size={44} />
                      </span>
                    ))}
                  </span>
                  <span className="mt-2 w-full truncate text-sm font-bold">
                    {playersOf(team).map((p) => p.name.split(' ')[0]).join(' e ') || '—'}
                  </span>
                  {info ? (
                    <>
                      <span className={`mt-1 text-xs tabular-nums ${selected ? 'text-white/70' : 'text-ink-subtle'}`}>
                        média {info.avgElo} · {info.winChance}% de chance
                      </span>
                      <span className="mt-3 text-2xl font-extrabold text-success tabular-nums">+{info.ifWin}</span>
                      <span className={`text-[11px] ${selected ? 'text-white/60' : 'text-ink-subtle'}`}>se vencer</span>
                    </>
                  ) : balanced && !preview.error ? (
                    <span className="mt-3 h-12 w-16 animate-pulse rounded bg-surface-muted/60" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* A prévia é só informativa: se ela falhar, ainda dá para registrar o resultado */}
          {balanced && preview.error && (
            <p role="alert" className="mt-4 rounded-lg bg-surface-muted px-4 py-3 text-center text-sm text-ink-muted">
              Não foi possível calcular a prévia dos pontos.{' '}
              <button type="button" onClick={preview.reload} className="font-bold text-primary hover:underline">
                Tentar novamente
              </button>
            </p>
          )}

          {winner && previewData && (
            <p className="mt-4 animate-fade-in rounded-lg bg-surface-muted px-4 py-3 text-center text-sm text-ink-muted">
              {teamLabel} {winner}: <strong className="text-success">+{previewData[winner === 1 ? 'team1' : 'team2'].ifWin}</strong> cada ·{' '}
              {teamLabel} {winner === 1 ? 2 : 1}:{' '}
              <strong className="text-danger">−{Math.abs(previewData[winner === 1 ? 'team2' : 'team1'].ifLose)}</strong> cada
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
