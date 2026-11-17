import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api';
import { authService } from '@/services/authService';
import { PATHS } from '@/routes/paths';

type State = { status: 'loading' } | { status: 'ok' } | { status: 'error'; code: string; message: string };

/** Aberta pelo link do e-mail; funciona logado ou não (por isso fica fora dos guards). */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { isAuthenticated, setUser } = useAuth();
  const [state, setState] = useState<State>(token ? { status: 'loading' } : { status: 'error', code: 'LINK_INVALID', message: 'Este link está incompleto.' });
  // O link é de uso único: no StrictMode o efeito roda duas vezes e a 2ª chamada falharia
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authService
      .verifyEmail(token)
      .then(async () => {
        setState({ status: 'ok' });
        // Se já está logado, atualiza o usuário em memória para sumir o banner
        if (isAuthenticated) setUser(await authService.me());
      })
      .catch((err: unknown) => {
        const e = err instanceof ApiError ? err : null;
        setState({ status: 'error', code: e?.code ?? 'UNKNOWN', message: e?.message ?? 'Erro inesperado. Tente novamente.' });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      {state.status === 'loading' && <p className="text-center text-ink-muted">Confirmando seu e-mail…</p>}

      {state.status === 'ok' && (
        <>
          <h1 className="text-[28px] leading-tight font-extrabold text-ink">E-mail confirmado ✅</h1>
          <p role="status" className="mt-6 rounded-md bg-primary-soft px-4 py-3 text-[15px] text-primary-strong">
            Tudo certo! Agora você já pode reservar quadras e pagar.
          </p>
          <Link to={isAuthenticated ? PATHS.booking : PATHS.login} className="mt-6 block">
            <Button size="lg" type="button">
              {isAuthenticated ? 'Reservar uma quadra' : 'Entrar'}
            </Button>
          </Link>
        </>
      )}

      {state.status === 'error' && (
        <>
          <h1 className="text-[28px] leading-tight font-extrabold text-ink">Não foi possível confirmar</h1>
          <p role="alert" className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-[15px] font-medium text-warning-ink">
            {state.message}
            {state.code === 'LINK_USED' && ' Se já confirmou, é só entrar.'}
          </p>
          <Link to={isAuthenticated ? PATHS.home : PATHS.login} className="mt-6 block">
            <Button size="lg" type="button">
              {isAuthenticated ? 'Ir para o início' : 'Entrar e pedir novo link'}
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
