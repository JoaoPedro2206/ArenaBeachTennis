import { Navigate, Outlet, useLocation, type Location } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
import { DEFAULT_PRIVATE_PATH, PATHS } from './paths';

/** Estado passado ao redirecionar para o login, para voltar depois */
export interface RedirectState {
  from?: Location;
}

/**
 * Rotas privadas: só renderiza os filhos com sessão válida.
 * Sem sessão -> /login, lembrando a página que o usuário tentou abrir.
 */
export function PrivateRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <FullScreenLoader />;
  if (status === 'unauthenticated') {
    return <Navigate to={PATHS.login} replace state={{ from: location } satisfies RedirectState} />;
  }
  return <Outlet />;
}

/**
 * Painel do dono da arena: além de logado, precisa ser ARENA_ADMIN.
 * Isto é só a porta da interface — quem protege os dados é o backend, que
 * confere a role (lida do banco) em toda rota /admin.
 */
export function AdminRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <FullScreenLoader />;
  if (status === 'unauthenticated') {
    return <Navigate to={PATHS.login} replace state={{ from: location } satisfies RedirectState} />;
  }
  if (user?.role !== 'ARENA_ADMIN') return <Navigate to={DEFAULT_PRIVATE_PATH} replace />;
  return <Outlet />;
}

/**
 * Rotas só para visitantes (login/cadastro): quem já está logado
 * é levado de volta para onde estava indo (ou para o Início).
 */
export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') return <FullScreenLoader />;
  if (status === 'authenticated') {
    const from = (location.state as RedirectState | null)?.from;
    const target = from ? `${from.pathname}${from.search}${from.hash}` : DEFAULT_PRIVATE_PATH;
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
