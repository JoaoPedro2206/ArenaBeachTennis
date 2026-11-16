import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { NAV_ITEMS } from '@/components/layout/navItems';
import { Logo } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { ChartIcon } from '@/components/icons';
import { PATHS } from '@/routes/paths';

/**
 * Layout das áreas logadas (mobile-first):
 * - cabeçalho de vidro fosco com o logo da arena
 * - celular: BottomTabBar flutuante embaixo
 * - tablet/desktop (md+): navegação segmentada no cabeçalho
 */
export function AppLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh pb-tabbar md:pb-12">
      <header className="glass sticky top-0 z-30 shadow-[0_1px_0_rgb(0_0_0/0.04),0_8px_24px_rgb(60_45_20/0.05)]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to={PATHS.home} aria-label="Arena Beach — início" className="shrink-0 transition-opacity hover:opacity-80">
            <Logo size={34} />
          </Link>

          <nav className="hidden rounded-full bg-surface-muted p-1 md:flex" aria-label="Navegação principal">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          {user && (
            <div className="flex min-w-0 items-center gap-2">
              {/* Atalho para o painel: só o dono da arena vê */}
              {user.role === 'ARENA_ADMIN' && (
                <Link
                  to={PATHS.admin}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-95"
                >
                  <ChartIcon size={15} /> Painel
                </Link>
              )}
              <Link
                to={PATHS.profile}
                className="flex min-w-0 items-center gap-3 rounded-full py-1 pr-1 pl-3 transition-colors hover:bg-surface-muted"
              >
                <span className="hidden truncate text-sm font-semibold text-ink-muted sm:block">{user.name.split(' ')[0]}</span>
                <Avatar name={user.name} src={user.profilePhoto} size={36} />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* key = pathname: reanima a entrada ao trocar de aba */}
      <main key={pathname} className="mx-auto max-w-5xl animate-rise px-4 pt-6 sm:px-6 sm:pt-8">
        <Outlet />
      </main>

      <BottomTabBar />
    </div>
  );
}
