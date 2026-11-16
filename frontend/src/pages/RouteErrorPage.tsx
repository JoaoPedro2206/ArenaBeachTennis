import { useRouteError } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';

/**
 * Tela de erro das rotas (errorElement): aparece quando uma página quebra ao
 * renderizar ou quando o código dela não baixa (sem internet, ou o app foi
 * atualizado e o arquivo antigo não existe mais). Sem isso o usuário veria
 * uma tela técnica do roteador.
 *
 * Não é carregada sob demanda de propósito: precisa estar disponível
 * justamente quando a rede falhou.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  console.error('[rota]', error);

  return (
    <main role="alert" className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <Logo size={44} className="mb-10" />
      <p className="text-5xl" aria-hidden>
        🌊
      </p>
      <h1 className="mt-6 text-2xl font-extrabold text-ink">Algo deu errado por aqui</h1>
      <p className="mt-2 max-w-xs text-[15px] text-ink-muted">
        Não foi possível abrir esta tela. Verifique sua conexão e tente de novo.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-8 inline-flex h-12 items-center rounded-md bg-cta px-6 text-[15px] font-bold text-cta-ink shadow-cta transition-all hover:-translate-y-0.5 active:scale-[0.97]"
      >
        Recarregar
      </button>
    </main>
  );
}
