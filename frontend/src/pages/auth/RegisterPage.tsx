import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api';
import { PATHS } from '@/routes/paths';

export default function RegisterPage() {
  const { register } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (field: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);
    setLoading(true);
    try {
      await register(form);
    } catch (err) {
      setApiError(err instanceof ApiError ? err : new ApiError('Erro inesperado. Tente novamente.', 0, 'UNKNOWN'));
      setLoading(false);
    }
  }

  // Erros de campo (422) aparecem sob cada input; os demais, no topo
  const hasFieldErrors = apiError?.code === 'VALIDATION_ERROR' && !!apiError.details;

  return (
    <>
      <h1 className="text-[28px] leading-tight font-extrabold text-ink">Crie sua conta</h1>
      <p className="mt-2 text-[15px] text-ink-muted">Leva menos de um minuto.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        {apiError && !hasFieldErrors && (
          <p role="alert" className="animate-fade-in rounded-md bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {apiError.message}
          </p>
        )}
        <TextField
          label="Nome"
          autoComplete="name"
          required
          value={form.name}
          onChange={update('name')}
          error={apiError?.fieldError('name')}
        />
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={form.email}
          onChange={update('email')}
          error={apiError?.fieldError('email')}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={update('password')}
          hint="Mínimo de 8 caracteres, com letras e números"
          error={apiError?.fieldError('password')}
        />

        <p className="flex items-start gap-2 rounded-md bg-primary-soft px-4 py-3 text-sm text-primary-strong">
          <span aria-hidden>🏅</span>
          Você começa como Iniciante. Sua categoria sobe conforme vence partidas ao vivo.
        </p>

        <Button type="submit" size="lg" loading={loading}>
          Criar conta
        </Button>
      </form>

      <p className="mt-8 text-center text-[15px] text-ink-muted">
        Já tem conta?{' '}
        <Link to={PATHS.login} state={location.state} className="font-bold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
