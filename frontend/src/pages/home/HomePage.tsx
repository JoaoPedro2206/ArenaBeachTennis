import { Link } from 'react-router-dom';
import heroUrl from '@/assets/brand/hero-beach.jpg';
import { useAuth } from '@/hooks/useAuth';
import { CategoryBadge } from '@/components/rating/CategoryBadge';
import { PATHS } from '@/routes/paths';
import { UpcomingBookings } from '@/components/booking/UpcomingBookings';
import { ChevronRightIcon } from '@/components/icons';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function HomePage() {
  const { user } = useAuth();
  if (!user) return null;
  const firstName = user.name.split(' ')[0];

  return (
    <div className="space-y-10">
      <header>
        <p className="text-[15px] font-medium text-ink-muted">{greeting()},</p>
        <h1 className="text-[28px] leading-tight font-extrabold text-ink sm:text-[32px]">{firstName} 👋</h1>
      </header>

      {/* Hero com a foto da arena: a ação principal do app */}
      <Link
        to={PATHS.booking}
        className="group relative block overflow-hidden rounded-xl shadow-md transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg active:scale-[0.99]"
      >
        {/* Foto espelhada: a raquete fica à direita e o texto (à esquerda) não briga com ela */}
        <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-105">
          <img src={heroUrl} alt="" className="h-full w-full -scale-x-100 object-cover object-[30%_70%]" />
        </div>
        {/* Gradiente garante leitura do texto sobre a foto */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        <div className="relative flex min-h-[240px] flex-col justify-end p-6 sm:min-h-[280px] sm:p-8">
          <span className="mb-3 w-fit rounded-full bg-cta px-3 py-1 text-xs font-extrabold text-cta-ink">
            Beach Tennis
          </span>
          <h2 className="max-w-xs text-2xl leading-tight font-extrabold text-white sm:text-3xl">Bora pra areia?</h2>
          <p className="mt-1 max-w-sm text-[15px] text-white/80">Escolha a quadra e garanta seu horário em segundos.</p>
          <span className="mt-5 inline-flex h-12 w-fit items-center gap-2 rounded-md bg-cta px-5 text-[15px] font-bold text-cta-ink shadow-cta transition-transform group-hover:translate-x-1">
            Reservar quadra
            <ChevronRightIcon size={18} strokeWidth={2.5} />
          </span>
        </div>
      </Link>

      {/* Indicadores do jogador */}
      <Link
        to={PATHS.profile}
        aria-label="Ver meu ranking"
        className="flex items-center gap-4 rounded-lg bg-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <CategoryBadge level={user.level} size="md" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{user.rank.name}</p>
          <p className="mt-0.5 text-[28px] leading-none font-extrabold text-ink tabular-nums">
            {user.eloScore} <span className="text-sm font-semibold text-ink-subtle">pts</span>
          </p>
          {user.rank.next ? (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(user.rank.progress, 3)}%` }} />
              </div>
              <p className="mt-1 truncate text-xs text-ink-muted">
                Faltam {user.rank.next.pointsToGo} para a {user.rank.next.name}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs font-bold text-ink">🏆 Topo do ranking</p>
          )}
        </div>
      </Link>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-extrabold text-ink">Próximos jogos</h2>
          <Link to={PATHS.booking} className="text-sm font-bold text-primary hover:underline">
            Nova reserva
          </Link>
        </div>
        <UpcomingBookings />
      </section>
    </div>
  );
}

