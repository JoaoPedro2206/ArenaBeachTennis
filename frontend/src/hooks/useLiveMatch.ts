import { useEffect, useRef, useState } from 'react';
import { ApiError, isRequestCanceled } from '@/services/api';
import { matchService } from '@/services/matchService';
import type { LiveMatch } from '@/types/match';

const POLL_INTERVAL_MS = 3000;

/**
 * Mantém a sala sincronizada com o servidor por polling enquanto ela está
 * ativa (WAITING / IN_PROGRESS). Simples, funciona atrás de qualquer proxy
 * e não exige o token na URL (como exigiria um EventSource/SSE).
 * Evolução natural: WebSocket (Socket.IO) com uma "room" por partida.
 *
 * Também calcula quem ACABOU de entrar, para animar a chegada.
 */
export function useLiveMatch(initial: LiveMatch, onGone: () => void) {
  const [match, setMatch] = useState(initial);
  const [newcomers, setNewcomers] = useState<Set<string>>(() => new Set());
  const knownIds = useRef(new Set(initial.participants.map((p) => p.userId)));
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;
  /** Sobe a cada estado aplicado por uma AÇÃO do usuário (iniciar, encerrar...) */
  const actionVersion = useRef(0);

  const isActive = match.status === 'WAITING' || match.status === 'IN_PROGRESS';

  function commit(next: LiveMatch) {
    const arrived = next.participants.filter((p) => !knownIds.current.has(p.userId)).map((p) => p.userId);
    knownIds.current = new Set(next.participants.map((p) => p.userId));
    if (arrived.length > 0) setNewcomers(new Set(arrived));
    setMatch(next);
  }

  /** Aplica a resposta de uma ação do usuário — ela vale mais que um polling em voo */
  function apply(next: LiveMatch) {
    actionVersion.current += 1;
    commit(next);
  }

  useEffect(() => {
    if (!isActive) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let stopped = false;

    // Uma consulta por vez, e a próxima só é agendada quando a atual termina.
    // (Com setInterval + abort, numa rede lenta de quadra — resposta > 3s —
    // toda consulta era cancelada pela seguinte e a sala nunca atualizava.)
    const poll = async () => {
      if (stopped || inFlight) return;
      if (document.hidden) return; // aba em segundo plano: retoma no visibilitychange
      inFlight = true;
      const version = actionVersion.current;
      try {
        const next = await matchService.get(match.id, controller.signal);
        // Se o usuário agiu enquanto a consulta estava em voo, ela está velha:
        // aplicá-la faria a sala "voltar no tempo" (ex.: de Em andamento para Aberta)
        if (!stopped && version === actionVersion.current) commit(next);
      } catch (err) {
        if (isRequestCanceled(err)) return;
        // 404: o usuário não está mais na sala (saiu por outro aparelho, etc.)
        if (err instanceof ApiError && err.status === 404) {
          stopped = true;
          onGoneRef.current();
          return;
        }
        // Outros erros (rede oscilando na quadra): tenta de novo no próximo ciclo
      } finally {
        inFlight = false;
      }
      if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    const onVisibilityChange = () => {
      if (document.hidden) return;
      clearTimeout(timer);
      void poll(); // voltou para o app: atualiza na hora
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // `commit` fica fora das dependências de propósito: usa só refs e setters estáveis
  }, [match.id, isActive]);

  return { match, apply, newcomers };
}
