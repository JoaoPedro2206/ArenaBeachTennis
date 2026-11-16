/**
 * Único ponto que lê/escreve o JWT no navegador.
 * Todo acesso é protegido por try/catch: localStorage pode lançar erro
 * (modo privado do Safari, armazenamento bloqueado).
 */
export const TOKEN_STORAGE_KEY = 'arenabeach.token';

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      /* sem persistência: a sessão dura até fechar a aba */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* nada a fazer */
    }
  },
};

export interface JwtPayload {
  sub?: string;
  role?: string;
  exp?: number; // segundos desde 1970
  iat?: number;
}

/**
 * Lê o payload do JWT SEM validar a assinatura — serve só para saber
 * quando ele expira. Quem valida de verdade é o backend.
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Milissegundos até expirar (negativo = já expirou; null = token sem exp/ilegível) */
export function msUntilExpiry(token: string): number | null {
  const exp = decodeJwt(token)?.exp;
  return exp ? exp * 1000 - Date.now() : null;
}

export function isTokenExpired(token: string): boolean {
  const ms = msUntilExpiry(token);
  return ms === null || ms <= 0;
}
