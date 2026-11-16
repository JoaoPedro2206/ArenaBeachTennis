import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CalendarIcon, ChartIcon, ChevronLeftIcon, TagIcon } from '@/components/icons';
import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/hooks/useAuth';
import { PATHS } from '@/routes/paths';

const ADMIN_NAV = [
  { to: PATHS.admin, label: 'Visão geral', icon: ChartIcon, end: true },
  { to: PATHS.adminAgenda, label: 'Agenda', icon: CalendarIcon, end: false },
  { to: PATHS.adminPricing, label: 'Preços', icon: TagIcon, end: false },
];

/**
 * Layout do painel do dono da arena.
 * - Desktop (lg+): barra lateral escura fixa — ferramenta de trabalho, não vitrine
 * - Celular/tablet: cabeçalho de vidro + abas segmentadas logo abaixo
 */
export function AdminLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* ---------- barra lateral (desktop) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink text-white lg:flex" aria-label="Painel da arena">
        <div className="px-6 pt-7 pb-8">
          <Link to={PATHS.admin} aria-label="Painel da arena — visão geral" className="inline-block rounded-md bg-white px-3 py-2">
            <Logo size={30} />
          </Link>
          <p className="mt-4 text-[11px] font-bold tracking-[0.14em] text-white/50 uppercase">Painel da arena</p>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Seções do painel">
          {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-semibold transition-colors duration-200 ${
                  isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Marcador amarelo-sol da seção ativa */}
                  <span
                    aria-hidden
                    className={`absolute top-2 bottom-2 left-0 w-1 rounded-full bg-cta transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          {user && (
            <div className="flex items-center gap-3 px-2">
              <Avatar name={user.name} src={user.profilePhoto} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{user.name}</p>
                <p className="truncate text-xs text-white/50">Dono da arena</p>
              </div>
            </div>
          )}
          <Link
            to={PATHS.home}
            className="mt-4 flex h-10 items-center justify-center gap-2 rounded-md bg-white/10 text-sm font-bold text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ChevronLeftIcon size={16} /> Voltar ao app
          </Link>
        </div>
      </aside>

      {/* ---------- cabeçalho + abas (celular/tablet) ---------- */}
      <header className="glass sticky top-0 z-30 shadow-[0_1px_0_rgb(0_0_0/0.04)] lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={26} />
            <span className="truncate text-[11px] font-bold tracking-[0.12em] text-ink-subtle uppercase">Painel</span>
          </div>
          <Link
            to={PATHS.home}
            className="flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            <ChevronLeftIcon size={16} /> App
          </Link>
        </div>
        <nav className="px-4 pb-3 sm:px-6" aria-label="Seções do painel">
          <div className="grid grid-cols-3 rounded-full bg-surface-muted p-1">
            {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-bold transition-all duration-200 ${
                    isActive ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {/* key = pathname: reanima a entrada ao trocar de seção */}
      <main key={pathname} className="mx-auto max-w-6xl animate-rise px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-10">
        <Outlet />
      </main>
    </div>
  );
}
