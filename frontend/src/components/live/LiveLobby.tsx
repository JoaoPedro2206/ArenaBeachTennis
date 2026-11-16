import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useLiveMatch } from '@/hooks/useLiveMatch';
import { useToast } from '@/hooks/useToast';
import { formatInZone } from '@/lib/dates';
import { ApiError } from '@/services/api';
import { authService } from '@/services/authService';
import { matchService } from '@/services/matchService';
import type { LiveMatch } from '@/types/match';
import { PinDisplay } from './PinDisplay';
import { PlayerGrid } from './PlayerGrid';
import { ResultSheet } from './ResultSheet';
import { CategoryBadge } from '@/components/rating/CategoryBadge';
import { LEVEL_INFO } from '@/types/auth';

interface LiveLobbyProps {
  initial: LiveMatch;
  /** Volta para a tela de entrada (saiu, cancelou, nova partida) */
  onExit: () => void;
}

const STATUS_PILL = {
  WAITING: { label: 'Sala aberta', className: 'bg-primary-soft text-primary-strong' },
  IN_PROGRESS: { label: 'Jogo em andamento', className: 'bg-danger text-white' },
  FINISHED: { label: 'Partida encerrada', className: 'bg-success-soft text-success' },
  CANCELLED: { label: 'Partida cancelada', className: 'bg-surface-muted text-ink-muted' },
} as const;

/** Relógio do jogo: "12:34" desde o início */
function useElapsed(since: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);
  if (!since) return '00:00';
  const total = Math.max(Math.floor((now - new Date(since).getTime()) / 1000), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/** Sala da partida: PIN, jogadores chegando ao vivo e controles do anfitrião */
export function LiveLobby({ initial, onExit }: LiveLobbyProps) {
  const toast = useToast();
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState<'start' | 'finish' | 'cancel' | 'leave' | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [recording, setRecording] = useState(false);

  const { match, apply, newcomers } = useLiveMatch(initial, () => {
    toast.info('Você não está mais nesta sala.');
    onExit();
  });

  const elapsed = useElapsed(match.status === 'IN_PROGRESS' ? match.startedAt : null);
  const tz = match.booking.court.arena.timezone;
  const slot = `${formatInZone(match.booking.startTime, tz).time}–${formatInZone(match.booking.endTime, tz).time}`;
  const enoughPlayers = match.participants.length >= match.minPlayersToStart;

  // Avisa quem chegou (para o anfitrião saber que pode começar)
  useEffect(() => {
    if (newcomers.size === 0) return;
    const names = match.participants.filter((p) => newcomers.has(p.userId) && p.userId !== user?.id).map((p) => p.name.split(' ')[0]);
    if (names.length > 0) toast.info(`${names.join(' e ')} ${names.length > 1 ? 'entraram' : 'entrou'} na sala`);
    // Depende só de `newcomers`: o aviso dispara uma vez por chegada, não a cada polling
  }, [newcomers]);

  // Ao terminar, atualiza os pontos do usuário logado (Início/Perfil refletem na hora)
  useEffect(() => {
    if (match.status !== 'FINISHED') return;
    authService
      .me()
      .then(setUser)
      .catch(() => undefined);
  }, [match.status, setUser]);

  async function run(action: NonNullable<typeof busy>, request: () => Promise<LiveMatch | void>, success?: string) {
    setBusy(action);
    try {
      const result = await request();
      if (result) apply(result);
      if (success) toast.success(success);
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Algo deu errado. Tente novamente.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  const pill = STATUS_PILL[match.status];

  // ---------------------------------------------------------------- encerrada / cancelada
  if (match.status === 'FINISHED' || match.status === 'CANCELLED') {
    const finished = match.status === 'FINISHED';
    const result = match.result;
    const me = match.participants.find((p) => p.userId === user?.id);
    const won = !!result && me?.team === result.winnerTeam;
    const levelChanged = me?.levelBefore && me.levelBefore !== me.level;
    const promoted = levelChanged && me!.eloDelta! > 0;
    // Vencedores primeiro na grade final
    const ordered = result
      ? [...match.participants].sort((a, b) => Number(b.team === result.winnerTeam) - Number(a.team === result.winnerTeam))
      : match.participants;

    return (
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-xl bg-ink px-6 py-10 text-center text-white shadow-md">
          <div aria-hidden className={`absolute -top-16 left-1/2 size-56 -translate-x-1/2 rounded-full blur-3xl ${won ? 'bg-cta/30' : 'bg-primary/30'}`} />
          <p className="relative text-5xl" aria-hidden>
            {!finished ? '🏖️' : !result ? '🤝' : won ? '🏆' : '💪'}
          </p>
          <h1 className="relative mt-4 text-2xl font-extrabold">
            {!finished ? 'Partida cancelada' : !result ? 'Partida encerrada' : won ? 'Vitória!' : 'Não foi dessa vez'}
          </h1>

          {!finished && <p className="relative mt-2 text-white/80">O anfitrião fechou a sala antes do jogo começar.</p>}
          {finished && !result && <p className="relative mt-2 text-white/80">Jogo encerrado sem pontuação — o ranking não mudou.</p>}
          {finished && result && me?.eloDelta != null && (
            <>
              <p className={`relative mt-3 text-5xl font-extrabold tabular-nums ${won ? 'text-cta' : 'text-white'}`}>
                {me.eloDelta >= 0 ? '+' : '−'}
                {Math.abs(me.eloDelta)}
              </p>
              <p className="relative mt-1 text-white/80">
                Agora você tem <strong className="text-white tabular-nums">{me.eloAfter} pontos</strong>
              </p>
            </>
          )}

          {levelChanged && (
            <div className="relative mx-auto mt-5 flex w-fit animate-pop items-center gap-3 rounded-full bg-white/10 py-2 pr-5 pl-2 ring-1 ring-white/20">
              <CategoryBadge level={me!.level} size="sm" />
              <span className="text-sm font-bold">
                {promoted ? '⬆️ Subiu para a ' : '⬇️ Voltou para a '}
                {LEVEL_INFO[me!.level].name}
              </span>
            </div>
          )}
        </section>

        {finished && (
          <section aria-label="Resultado por jogador">
            {result && (
              <p className="mb-3 text-center text-sm text-ink-muted">
                Chance da dupla vencedora era de <strong className="text-ink">{Math.round(result.winnerExpected * 100)}%</strong>
                {result.winnerExpected < 0.4 && ' — zebra! 🦓'}
              </p>
            )}
            <PlayerGrid players={ordered} maxPlayers={ordered.length} newcomers={new Set()} showPoints currentUserId={user?.id} />
          </section>
        )}

        <Button size="lg" onClick={onExit}>
          {finished ? 'Fechar' : 'Voltar'}
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------- sala ativa
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold ${pill.className}`}>
            {match.status === 'IN_PROGRESS' && <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden />}
            {pill.label}
          </span>
          <h1 className="mt-2 text-2xl font-extrabold text-ink">{match.booking.court.name}</h1>
          <p className="text-sm text-ink-muted">
            {match.booking.court.arena.name} · {slot}
          </p>
        </div>
        {match.status === 'IN_PROGRESS' && (
          <div className="rounded-lg bg-surface px-4 py-2 text-right shadow-sm" role="timer" aria-label={`Tempo de jogo ${elapsed}`}>
            <p className="text-[11px] font-bold tracking-wider text-ink-subtle uppercase">Tempo de jogo</p>
            <p className="text-2xl font-extrabold text-ink tabular-nums">{elapsed}</p>
          </div>
        )}
      </header>

      {match.status === 'WAITING' && match.pinCode && <PinDisplay pin={match.pinCode} />}

      {/* Durante o jogo, ainda dá para entrar quem chegou atrasado */}
      {match.status === 'IN_PROGRESS' && match.pinCode && match.participants.length < match.maxPlayers && (
        <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          Chegou alguém atrasado? Código:{' '}
          <strong className="font-extrabold tracking-wider text-ink tabular-nums">
            {match.pinCode.slice(0, 3)} {match.pinCode.slice(3)}
          </strong>
        </p>
      )}

      <section aria-labelledby="players-title">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="players-title" className="text-lg font-extrabold text-ink">
            Jogadores
          </h2>
          <span className="text-sm font-bold text-ink-muted tabular-nums">
            {match.participants.length}/{match.maxPlayers}
          </span>
        </div>
        <PlayerGrid players={match.participants} maxPlayers={match.maxPlayers} newcomers={newcomers} currentUserId={user?.id} />
      </section>

      {/* Controles */}
      {match.isHost ? (
        <div className="space-y-3">
          {match.status === 'WAITING' ? (
            <>
              <Button
                size="lg"
                onClick={() => run('start', () => matchService.start(match.id), 'Jogo iniciado! Bom jogo 🎾')}
                loading={busy === 'start'}
                disabled={!enoughPlayers || !!busy}
              >
                Iniciar jogo
              </Button>
              {!enoughPlayers && (
                <p className="text-center text-sm text-ink-muted">
                  Aguarde pelo menos {match.minPlayersToStart} jogadores na sala para iniciar.
                </p>
              )}
              <Button
                variant="ghost"
                onClick={() => run('cancel', () => matchService.cancel(match.id))}
                loading={busy === 'cancel'}
                disabled={!!busy}
              >
                Cancelar partida
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" onClick={() => setRecording(true)} disabled={!!busy}>
                🏆 Registrar resultado
              </Button>
              <Button variant="ghost" onClick={() => setConfirmFinish(true)} disabled={!!busy}>
                Encerrar sem pontuar
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="rounded-lg bg-surface-muted px-4 py-4 text-center text-[15px] font-semibold text-ink-muted">
            {match.status === 'WAITING'
              ? '⏳ Aguardando o anfitrião iniciar o jogo…'
              : '🎾 Jogo em andamento — o ranking muda quando o anfitrião registrar o resultado.'}
          </p>
          {match.status === 'WAITING' && (
            <Button
              variant="ghost"
              onClick={async () => {
                if (await run('leave', () => matchService.leave(match.id))) onExit();
              }}
              loading={busy === 'leave'}
              disabled={!!busy}
            >
              Sair da sala
            </Button>
          )}
        </div>
      )}

      {recording && (
        <ResultSheet
          match={match}
          onClose={() => setRecording(false)}
          onRecorded={(updated) => {
            setRecording(false);
            apply(updated);
            toast.success('Resultado registrado! Ranking atualizado 🏆');
          }}
        />
      )}

      {confirmFinish && (
        <Modal
          open
          onClose={() => setConfirmFinish(false)}
          dismissible={busy !== 'finish'}
          title="Encerrar sem pontuar?"
          description="Use para amistosos ou jogos interrompidos (chuva, lesão). Ninguém ganha nem perde pontos."
        >
          <div className="flex -space-x-3">
            {match.participants.map((p) => (
              <span key={p.userId} className="rounded-full ring-4 ring-surface">
                <Avatar name={p.name} src={p.profilePhoto} size={44} />
              </span>
            ))}
          </div>
          <div className="mt-6 grid gap-3">
            <Button
              variant="primary"
              size="lg"
              loading={busy === 'finish'}
              onClick={async () => {
                if (await run('finish', () => matchService.finish(match.id), 'Partida encerrada')) setConfirmFinish(false);
              }}
            >
              Encerrar sem pontuar
            </Button>
            <Button variant="ghost" onClick={() => setConfirmFinish(false)} disabled={busy === 'finish'}>
              Continuar jogando
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}