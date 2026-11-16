import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { DEFAULT_PRIVATE_PATH } from '@/routes/paths';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh animate-rise flex-col items-center justify-center bg-background px-6 text-center">
      <Logo size={44} className="mb-10" />
      <p className="text-[96px] leading-none font-extrabold tracking-tighter text-ink">
        4<span className="text-accent">🎾</span>4
      </p>
      <h1 className="mt-6 text-2xl font-extrabold text-ink">Bola fora!</h1>
      <p className="mt-2 max-w-xs text-[15px] text-ink-muted">A página que você procura não existe ou mudou de lugar.</p>
      <Link
        to={DEFAULT_PRIVATE_PATH}
        className="mt-8 inline-flex h-12 items-center rounded-md bg-cta px-6 text-[15px] font-bold text-cta-ink shadow-cta transition-all hover:-translate-y-0.5 active:scale-[0.97]"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
