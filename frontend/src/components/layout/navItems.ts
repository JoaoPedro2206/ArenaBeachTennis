import type { ComponentType, SVGProps } from 'react';
import { CalendarIcon, HomeIcon, LiveIcon, UserIcon, WhistleIcon } from '@/components/icons';
import { PATHS } from '@/routes/paths';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
  /** Ação principal: botão central elevado na BottomTabBar */
  highlight?: boolean;
}

/** Fonte única dos itens de navegação (BottomTabBar no celular e menu do topo no desktop) */
export const NAV_ITEMS: NavItem[] = [
  { to: PATHS.home, label: 'Início', icon: HomeIcon },
  { to: PATHS.booking, label: 'Agendar', icon: CalendarIcon },
  { to: PATHS.live, label: 'Ao Vivo', icon: LiveIcon, highlight: true },
  { to: PATHS.lessons, label: 'Aulas', icon: WhistleIcon },
  { to: PATHS.profile, label: 'Perfil', icon: UserIcon },
];
