/** Fonte única das URLs do app — evita strings soltas espalhadas pelo código */
export const PATHS = {
  login: '/login',
  register: '/cadastro',
  home: '/inicio',
  booking: '/agendar',
  lessons: '/aulas',
  live: '/ao-vivo',
  profile: '/perfil',
  // Painel do dono da arena (role ARENA_ADMIN)
  admin: '/admin',
  adminAgenda: '/admin/agenda',
  adminPricing: '/admin/precos',
} as const;

/** Para onde o usuário vai depois de entrar, se não veio de outra página */
export const DEFAULT_PRIVATE_PATH = PATHS.home;
