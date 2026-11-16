/**
 * Cliente HTTP da aplicação (axios). Camada mais baixa dos serviços:
 *
 *   páginas/contextos -> services/*Service.ts -> api.ts -> backend
 *
 * - Interceptor de request: injeta o JWT salvo
 * - Interceptor de response: converte o erro do backend em ApiError e
 *   avisa o AuthContext quando a sessão deixou de valer (401)
 */
import axios, { type AxiosError } from 'axios';
import { tokenStorage } from './tokenStorage';

/**
 * Em desenvolvimento, "/api/v1" passa pelo proxy do Vite (sem CORS).
 * Em produção, defina VITE_API_URL com a URL completa da API.
 */
const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

/** Espelha o corpo de erro do errorHandler do backend */
interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Primeira mensagem de erro de um campo (para exibir abaixo do input) */
  fieldError(field: string): string | undefined {
    return this.details?.[field]?.[0];
  }
}

// ---------------------------------------------------------------------------
// Aviso de sessão inválida (o AuthContext se inscreve aqui)
// ---------------------------------------------------------------------------
type UnauthorizedListener = () => void;
let unauthorizedListener: UnauthorizedListener | null = null;

/** Registra quem deve reagir a um 401. Retorna a função para cancelar. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListener = listener;
  return () => {
    if (unauthorizedListener === listener) unauthorizedListener = null;
  };
}

// ---------------------------------------------------------------------------
// Instância axios
// ---------------------------------------------------------------------------
export const http = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    // Requisição cancelada (troca rápida de data, desmontagem) — repassa como está
    if (axios.isCancel(error)) return Promise.reject(error);

    if (!error.response) {
      const message =
        error.code === 'ECONNABORTED'
          ? 'O servidor demorou para responder. Tente novamente.'
          : 'Não foi possível conectar ao servidor. Verifique sua conexão.';
      return Promise.reject(new ApiError(message, 0, 'NETWORK_ERROR'));
    }

    const { status, data } = error.response;
    // 401 numa requisição autenticada = token expirado/revogado.
    // 401 do login/cadastro é "senha errada", nunca "sessão expirada" — mesmo
    // que um token antigo ainda esteja salvo e tenha ido junto no header.
    const isAuthRoute = error.config?.url?.startsWith('/auth/') ?? false;
    if (status === 401 && !isAuthRoute && error.config?.headers?.Authorization) unauthorizedListener?.();

    // Backend fora do ar atrás de um proxy (Vite, Nginx): chega um 502/503/504
    // em HTML, sem o JSON da API — `data.message` não existe
    const backendMessage = typeof data === 'object' && data !== null ? data.message : undefined;
    const fallback = status >= 500 ? 'O servidor está indisponível no momento. Tente novamente em instantes.' : 'Erro inesperado';

    return Promise.reject(
      new ApiError(backendMessage ?? fallback, status, data?.code ?? 'UNKNOWN_ERROR', data?.details),
    );
  },
);

/** true quando o erro veio de um AbortController (não deve virar mensagem na tela) */
export const isRequestCanceled = (error: unknown): boolean => axios.isCancel(error);

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

/** Atalho tipado usado pelos services: devolve só o corpo da resposta */
export async function api<T>(path: string, { method = 'GET', body, params, signal }: RequestOptions = {}): Promise<T> {
  const response = await http.request<T>({ url: path, method, data: body, params, signal });
  return response.data;
}
