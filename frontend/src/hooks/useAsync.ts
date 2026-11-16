import { useCallback, useEffect, useState, type DependencyList } from 'react';
import { ApiError, isRequestCanceled } from '@/services/api';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Refaz a requisição (botão "Tentar novamente", após criar uma reserva...) */
  reload: () => void;
}

/**
 * Executa uma requisição quando as dependências mudam, cancelando a
 * anterior (evita que a resposta de uma data antiga sobrescreva a atual).
 * Passe `enabled=false` para não executar (ex.: ainda sem quadra escolhida).
 */
export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  enabled = true,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // `enabled` mudou: ajusta `loading` JÁ nesta renderização (e não só no efeito,
  // que roda depois da pintura). Sem isso a tela pisca "lista vazia" por um
  // quadro ao habilitar, e fica presa em "carregando" ao desabilitar no meio
  // de uma requisição (o abort não passa pelo `finally` abaixo).
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    setLoading(enabled);
  }

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetcher(controller.signal)
      .then((result) => setData(result))
      .catch((err: unknown) => {
        if (isRequestCanceled(err)) return;
        setError(err instanceof ApiError ? err.message : 'Erro inesperado. Tente novamente.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // `fetcher` fica de fora de propósito: quem chama controla o refetch via `deps`
  }, [...deps, enabled, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { data, loading, error, reload };
}
