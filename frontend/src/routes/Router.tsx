import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { FullScreenLoader } from '@/components/ui/FullScreenLoader';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { AdminRoute, PrivateRoute, PublicOnlyRoute } from './guards';
import { DEFAULT_PRIVATE_PATH, PATHS } from './paths';

// Code splitting: cada página vira um chunk carregado sob demanda (melhor no 4G)
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const HomePage = lazy(() => import('@/pages/home/HomePage'));
const BookingPage = lazy(() => import('@/pages/booking/BookingPage'));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const LessonsPage = lazy(() => import('@/pages/lessons/LessonsPage'));
const LiveMatchPage = lazy(() => import('@/pages/live/LiveMatchPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
// Painel do dono: jogadores nunca baixam esse código
const AdminLayout = lazy(() => import('@/layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminAgendaPage = lazy(() => import('@/pages/admin/AdminAgendaPage'));
const AdminPricingPage = lazy(() => import('@/pages/admin/AdminPricingPage'));

const withSuspense = (element: ReactNode) => <Suspense fallback={<FullScreenLoader />}>{element}</Suspense>;

const router = createBrowserRouter([
  { path: '/', element: <Navigate to={DEFAULT_PRIVATE_PATH} replace /> },

  // ---------- Rotas públicas (apenas visitantes) ----------
  {
    element: <PublicOnlyRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: PATHS.login, element: withSuspense(<LoginPage />) },
          { path: PATHS.register, element: withSuspense(<RegisterPage />) },
          { path: PATHS.forgotPassword, element: withSuspense(<ForgotPasswordPage />) },
          { path: PATHS.resetPassword, element: withSuspense(<ResetPasswordPage />) },
        ],
      },
    ],
  },

  // Link do e-mail de confirmação: abre logado ou não
  { path: PATHS.verifyEmail, element: withSuspense(<VerifyEmailPage />), errorElement: <RouteErrorPage /> },

  // ---------- Rotas privadas (exigem login) ----------
  {
    element: <PrivateRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: PATHS.home, element: withSuspense(<HomePage />) },
          { path: PATHS.booking, element: withSuspense(<BookingPage />) },
          { path: PATHS.lessons, element: withSuspense(<LessonsPage />) },
          { path: PATHS.live, element: withSuspense(<LiveMatchPage />) },
          { path: PATHS.profile, element: withSuspense(<ProfilePage />) },
        ],
      },
    ],
  },

  // ---------- Painel do dono da arena (ARENA_ADMIN) ----------
  {
    element: <AdminRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: withSuspense(<AdminLayout />),
        children: [
          { path: PATHS.admin, element: withSuspense(<AdminDashboardPage />) },
          { path: PATHS.adminAgenda, element: withSuspense(<AdminAgendaPage />) },
          { path: PATHS.adminPricing, element: withSuspense(<AdminPricingPage />) },
        ],
      },
    ],
  },

  { path: '*', element: withSuspense(<NotFoundPage />), errorElement: <RouteErrorPage /> },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
