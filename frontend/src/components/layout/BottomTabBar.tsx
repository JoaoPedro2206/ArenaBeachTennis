import { NavLink } from 'react-router-dom';
import { NAV_ITEMS, type NavItem } from './navItems';

interface BottomTabBarProps {
  items?: NavItem[];
}

/**
 * Barra de abas flutuante (glassmorphism) no rodapé do celular.
 * - Abas comuns: pílula azul-oceano atrás do ícone quando ativas
 * - Aba em destaque (`highlight`, ex.: "Ao Vivo"): botão central elevado,
 *   amarelo-sol, maior e com ponto pulsante — é a ação principal na quadra
 * - Some a partir de md, onde a navegação vai para o cabeçalho
 *
 * O conteúdo acima precisa reservar espaço: classe `pb-tabbar`.
 */
export function BottomTabBar({ items = NAV_ITEMS }: BottomTabBarProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul
        className="glass mx-auto grid h-16 max-w-md items-center rounded-xl shadow-lg ring-1 ring-black/5"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <li key={item.to} className="h-full">
            {item.highlight ? <HighlightTab item={item} /> : <RegularTab item={item} />}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function RegularTab({ item: { to, label, icon: Icon } }: { item: NavItem }) {
  return (
    <NavLink to={to} className="group flex h-full flex-col items-center justify-center gap-1">
      {({ isActive }) => (
        <>
          <span
            className={`flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300 ease-out ${
              isActive ? 'bg-primary text-white shadow-primary' : 'text-ink-subtle group-active:scale-90'
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
          </span>
          <span className={`text-[10px] transition-colors ${isActive ? 'font-bold text-ink' : 'font-medium text-ink-subtle'}`}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function HighlightTab({ item: { to, label, icon: Icon } }: { item: NavItem }) {
  return (
    <NavLink to={to} aria-label={label} className="group relative flex h-full flex-col items-center justify-end pb-2">
      {({ isActive }) => (
        <>
          <span
            className={`absolute -top-6 flex size-[60px] items-center justify-center rounded-full bg-cta text-cta-ink shadow-cta ring-[5px] ring-background transition-all duration-300 ease-out group-active:scale-90 ${
              isActive ? 'scale-105' : 'group-hover:-translate-y-0.5'
            }`}
          >
            <Icon size={28} strokeWidth={2.4} />
            {/* "Ao vivo": ponto vermelho pulsante */}
            <span aria-hidden className="absolute top-2 right-2 flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-danger ring-2 ring-cta" />
            </span>
          </span>
          <span className={`text-[10px] font-extrabold ${isActive ? 'text-ink' : 'text-ink-muted'}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
