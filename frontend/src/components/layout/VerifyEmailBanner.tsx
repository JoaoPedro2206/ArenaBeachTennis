import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api';
import { authService } from '@/services/authService';

/** Faixa "Confirme seu e-mail" enquanto o e-mail do usuário está pendente. */
export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerifiedAt) return null;

  async function resend() {
    setState('sending');
    setError(null);
    try {
      await authService.resendVerification();
      setState('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível reenviar agora.');
      setState('idle');
    }
  }

  return (
    <div role="status" className="bg-warning-soft text-warning-ink">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] font-medium sm:px-6">
        <span>
          {state === 'sent'
            ? `Enviamos o link para ${user.email}. Confira também o spam.`
            : `Confirme seu e-mail (${user.email}) para reservar e pagar.`}
        </span>
        {error && <span className="font-bold">{error}</span>}
        {state !== 'sent' && (
          <button
            type="button"
            onClick={resend}
            disabled={state === 'sending'}
            className="font-bold underline underline-offset-2 disabled:opacity-60"
          >
            {state === 'sending' ? 'Enviando…' : 'Reenviar e-mail'}
          </button>
        )}
      </div>
    </div>
  );
}
