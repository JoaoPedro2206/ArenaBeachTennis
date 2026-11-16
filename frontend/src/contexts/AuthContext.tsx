import { createContext, useCallback, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { ApiError, isRequestCanceled, onUnauthorized } from '@/services/api';
import { authService } from '@/services/authService';
import { TOKEN_STORAGE_KEY, isTokenExpired, msUntilExpiry, tokenStorage } from '@/services/tokenStorage';
import type { LoginInput, RegisterInput, User } from '@/types/auth';

/**
 * checking        -> há token salvo e estamos validando com GET /users/me
 * authenticated   -> sessão válida, `user` preenchido
 * unauthenticated -> sem sessão
 */
export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  token: string | null;
  user: User | null;
  /** true quando a sessão caiu sozinha (token expirou/revogado) — o login mostra um aviso */
  sessionExpired: boolean;
}

type AuthAction =
  | { type: 'SESSION_CHECK'; token: string }
  | { type: 'AUTHENTICATED'; token: string; user: User }
  | { type: 'USER_UPDATED'; user: User }
  | { type: 'LOGGED_OUT'; expired: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SESSION_CHECK':
      return { status: 'checking', token: action.token, user: null, sessionExpired: false };
    case 'AUTHENTICATED':
      return { status: 'authenticated', token: action.token, user: action.user, sessionExpired: false };
    case 'USER_UPDATED':
      // Resposta atrasada de um GET /users/me que chega depois do logout é ignorada
      return state.status === 'authenticated' ? { ...state, user: action.user } : state;
    case 'LOGGED_OUT':
      return { status: 'unauthenticated', token: null, user: null, sessionExpired: action.expired };
  }
}

/** Estado inicial lido de forma síncrona: evita um "piscar" de tela de login no F5 */
function initAuthState(): AuthState {
  const token = tokenStorage.get();
  if (token && !isTokenExpired(token)) {
    return { status: 'checking', token, user: null, sessionExpired: false };
  }
  if (token) tokenStorage.clear(); // expirou enquanto o app estava fechado
  return { status: 'unauthenticated', token: null, user: null, sessionExpired: !!token };
}

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  sessionExpired: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => void;
  /** Atualiza o usuário em memória após editar o perfil */
  setUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Tentativas extras de validar a sessão quando o erro é de rede/servidor */
const SESSION_CHECK_RETRIES = 4;

/** setTimeout aceita no máximo ~24,8 dias; acima disso estoura e dispara na hora */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, undefined, initAuthState);

  const endSession = useCallback((expired: boolean) => {
    tokenStorage.clear();
    dispatch({ type: 'LOGGED_OUT', expired });
  }, []);

  // 1) Valida o token salvo com o backend (no boot e quando outra aba faz login)
  useEffect(() => {
    if (state.status !== 'checking' || !state.token) return;
    const controller = new AbortController();
    const token = state.token;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const attempt = (n: number) => {
      authService
        .me(controller.signal)
        .then((user) => dispatch({ type: 'AUTHENTICATED', token, user }))
        .catch((error: unknown) => {
          if (isRequestCanceled(error)) return; // StrictMode / desmontagem
          // Só 401 significa "sessão inválida". Rede caindo ou servidor
          // reiniciando (status 0 / 5xx) NÃO pode deslogar o jogador:
          // tenta de novo com espera crescente (1s, 2s, 4s, 8s).
          const isAuthError = error instanceof ApiError && error.status === 401;
          if (!isAuthError && n < SESSION_CHECK_RETRIES) {
            retryTimer = setTimeout(() => attempt(n + 1), 1000 * 2 ** n);
            return;
          }
          if (isAuthError) endSession(true);
          else dispatch({ type: 'LOGGED_OUT', expired: false }); // mantém o token: um F5 depois recupera a sessão
        });
    };
    attempt(0);

    return () => {
      controller.abort();
      clearTimeout(retryTimer);
    };
  }, [state.status, state.token, endSession]);

  // 2) Encerra a sessão no instante em que o JWT expira (sem esperar um 401)
  useEffect(() => {
    if (!state.token) return;
    const ms = msUntilExpiry(state.token);
    if (ms === null) return;
    const timer = setTimeout(() => endSession(true), Math.min(Math.max(ms, 0), MAX_TIMEOUT_MS));
    return () => clearTimeout(timer);
  }, [state.token, endSession]);

  // 3) Qualquer 401 numa chamada autenticada derruba a sessão
  useEffect(() => onUnauthorized(() => endSession(true)), [endSession]);

  // 4) Sincroniza abas: sair/entrar em uma aba reflete nas outras
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== TOKEN_STORAGE_KEY) return;
      if (!event.newValue) dispatch({ type: 'LOGGED_OUT', expired: false });
      else dispatch({ type: 'SESSION_CHECK', token: event.newValue });
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = useCallback(async (data: LoginInput) => {
    const { user, accessToken } = await authService.login(data);
    tokenStorage.set(accessToken);
    dispatch({ type: 'AUTHENTICATED', token: accessToken, user });
  }, []);

  const register = useCallback(async (data: RegisterInput) => {
    const { user, accessToken } = await authService.register(data);
    tokenStorage.set(accessToken);
    dispatch({ type: 'AUTHENTICATED', token: accessToken, user });
  }, []);

  const logout = useCallback(() => endSession(false), [endSession]);
  const setUser = useCallback((user: User) => dispatch({ type: 'USER_UPDATED', user }), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      token: state.token,
      isAuthenticated: state.status === 'authenticated',
      sessionExpired: state.sessionExpired,
      login,
      register,
      logout,
      setUser,
    }),
    [state, login, register, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
