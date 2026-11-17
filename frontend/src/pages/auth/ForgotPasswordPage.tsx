import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/services/api';
import { authService } from '@/services/authService';
import { PATHS } from '@/routes/paths';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.fieldError('email') ?? err.message : 'Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-[28px] leading-tight font-extrabold text-ink">Esqueceu a senha?</h1>

      {sent ? (
        <div className="mt-6 space-y-4">
          <p role="status" className="rounded-md bg-primary-soft px-4 py-3 text-[15px] text-primary-strong">
            Se <strong>{email}</strong> estiver cadastrado, enviamos um link para criar uma nova senha. Ele vale por 30
            minutos.
          </p>
          <p className="text-sm text-ink-muted">Não chegou? Confira o spam ou tente novamente em alguns minutos.</p>
          <Button variant="secondary" size="lg" onClick={() => setSent(false)}>
            Enviar para outro e-mail
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[15px] text-ink-muted">Informe seu e-mail e enviaremos um link para redefinir.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
            {error && (
              <p role="alert" className="animate-fade-in rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <TextField
              label="E-mail"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" size="lg" loading={loading}>
              Enviar link
            </Button>
          </form>
        </>
      )}

      <p className="mt-8 text-center text-[15px] text-ink-muted">
        Lembrou?{' '}
        <Link to={PATHS.login} className="font-bold text-primary hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
