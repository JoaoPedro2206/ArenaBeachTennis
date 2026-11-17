import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api';
import { PATHS } from '@/routes/paths';

export default function LoginPage() {
  const { login, sessionExpired } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Ao autenticar, o PublicOnlyRoute redireciona sozinho para a página de origem
      await login(form);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro inesperado. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-[28px] leading-tight font-extrabold text-ink">Bem-vindo de volta</h1>
      <p className="mt-2 text-[15px] text-ink-muted">Entre para reservar sua quadra.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        {sessionExpired && !error && (
          <p role="status" className="rounded-md bg-warning-soft px-4 py-3 text-sm font-medium text-warning-ink">
            Sua sessão expirou. Entre novamente para continuar.
          </p>
        )}
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
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <div className="-mt-3 text-right">
          <Link to={PATHS.forgotPassword} className="text-sm font-semibold text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" size="lg" loading={loading}>
          Entrar
        </Button>
      </form>

      <p className="mt-8 text-center text-[15px] text-ink-muted">
        Ainda não tem conta?{' '}
        {/* Repassa o state para manter o "voltar para onde estava" também no cadastro */}
        <Link to={PATHS.register} state={location.state} className="font-bold text-primary hover:underline">
          Cadastre-se
        </Link>
      </p>
    </>
  );
}
