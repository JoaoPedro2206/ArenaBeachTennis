import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/services/api';
import { authService } from '@/services/authService';
import { PATHS } from '@/routes/paths';

const LINK_ERROR_CODES = new Set(['LINK_EXPIRED', 'LINK_USED', 'LINK_INVALID']);

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setApiError(err instanceof ApiError ? err : new ApiError('Erro inesperado. Tente novamente.', 0, 'UNKNOWN'));
    } finally {
      setLoading(false);
    }
  }

  // Link sem token, expirado, já usado ou inválido: o único caminho é pedir outro
  const linkProblem = !token || (apiError && LINK_ERROR_CODES.has(apiError.code));
  if (linkProblem) {
    return (
      <>
        <h1 className="text-[28px] leading-tight font-extrabold text-ink">Link não funciona</h1>
        <p role="alert" className="mt-6 rounded-md bg-warning-soft px-4 py-3 text-[15px] font-medium text-warning-ink">
          {!token
            ? 'Este link está incompleto.'
            : apiError?.code === 'LINK_EXPIRED'
              ? 'Este link expirou (ele vale por 30 minutos).'
              : apiError?.code === 'LINK_USED'
                ? 'Este link já foi utilizado.'
                : 'Este link é inválido.'}{' '}
          Peça um novo para continuar.
        </p>
        <Link to={PATHS.forgotPassword} className="mt-6 block">
          <Button size="lg" type="button">
            Pedir novo link
          </Button>
        </Link>
      </>
    );
  }

  if (done) {
    return (
      <>
        <h1 className="text-[28px] leading-tight font-extrabold text-ink">Senha redefinida</h1>
        <p role="status" className="mt-6 rounded-md bg-primary-soft px-4 py-3 text-[15px] text-primary-strong">
          Pronto! Por segurança, você foi desconectado dos outros dispositivos. Entre com a nova senha.
        </p>
        <Link to={PATHS.login} className="mt-6 block">
          <Button size="lg" type="button">
            Ir para o login
          </Button>
        </Link>
      </>
    );
  }

  const hasFieldErrors = apiError?.code === 'VALIDATION_ERROR' && !!apiError.details;

  return (
    <>
      <h1 className="text-[28px] leading-tight font-extrabold text-ink">Crie uma nova senha</h1>
      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        {apiError && !hasFieldErrors && (
          <p role="alert" className="animate-fade-in rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {apiError.message}
          </p>
        )}
        <TextField
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Mínimo de 8 caracteres, com letras e números"
          error={apiError?.fieldError('password')}
        />
        <Button type="submit" size="lg" loading={loading}>
          Redefinir senha
        </Button>
      </form>
    </>
  );
}
