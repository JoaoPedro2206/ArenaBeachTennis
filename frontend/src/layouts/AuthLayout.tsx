import { Outlet } from 'react-router-dom';
import heroUrl from '@/assets/brand/hero-beach.jpg';
import { Logo } from '@/components/ui/Logo';

/**
 * Telas de visitante (login/cadastro).
 * - Celular: foto da arena no topo e formulário em "folha" que sobe por cima
 * - Desktop: tela dividida — foto à esquerda, formulário à direita
 */
export function AuthLayout() {
  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Foto */}
      <div className="relative h-[34dvh] min-h-[220px] overflow-hidden lg:sticky lg:top-0 lg:h-dvh">
        <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-[25%_60%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/60 lg:bg-gradient-to-t lg:from-black/90 lg:via-black/35 lg:to-black/0" />

        <div className="absolute inset-x-0 bottom-0 hidden p-12 text-white lg:block">
          <p className="max-w-md text-4xl leading-tight font-extrabold tracking-tight">
            Sua quadra de beach tennis a um toque de distância.
          </p>
          <p className="mt-3 max-w-md text-lg text-white/80">Reserve horários, acompanhe seus jogos e evolua de categoria.</p>
        </div>
      </div>

      {/* Formulário */}
      <main className="relative -mt-8 rounded-t-xl bg-surface px-6 pt-8 pb-12 sm:px-10 lg:mt-0 lg:flex lg:items-center lg:rounded-none lg:px-16">
        <div className="mx-auto w-full max-w-sm animate-rise">
          <Logo size={52} className="mb-8" />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
