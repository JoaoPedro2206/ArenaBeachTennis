import type { ButtonHTMLAttributes } from 'react';

/**
 * cta       -> ação principal da tela (amarelo-sol do logo, texto preto). Use uma por tela.
 * primary   -> ação forte secundária (azul-oceano)
 * secondary -> ação neutra (branco com sombra)
 * ghost     -> ação discreta (só texto)
 * danger      -> ação destrutiva discreta (sair da conta)
 * destructive -> confirmação de ação destrutiva (dentro de um diálogo)
 */
type Variant = 'cta' | 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive';
type Size = 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Ocupa toda a largura (padrão em formulários mobile) */
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  cta: 'bg-cta text-cta-ink shadow-cta hover:bg-cta-strong hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgb(214_196_0/0.45)]',
  primary: 'bg-primary text-white shadow-primary hover:bg-primary-strong hover:-translate-y-0.5',
  secondary: 'bg-surface text-ink shadow-sm hover:-translate-y-0.5 hover:shadow-md',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white',
  destructive: 'bg-danger text-white shadow-sm hover:-translate-y-0.5 hover:bg-danger/90 hover:shadow-md',
};

const SIZES: Record<Size, string> = {
  md: 'h-12 px-6 text-[15px] rounded-md',
  lg: 'h-14 px-8 text-base rounded-lg',
};

export function Button({
  variant = 'cta',
  size = 'md',
  loading = false,
  fullWidth = true,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 font-bold tracking-[-0.01em] transition-all duration-200 ease-out active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 ${
        fullWidth ? 'w-full' : 'w-auto'
      } ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
