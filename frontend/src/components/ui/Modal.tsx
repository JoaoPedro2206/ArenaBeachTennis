import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Texto curto abaixo do título */
  description?: string;
  children: ReactNode;
  /** Impede fechar (ex.: enquanto a reserva está sendo enviada) */
  dismissible?: boolean;
  /** Tela cheia no celular (formulários longos); painel grande no desktop */
  fullScreen?: boolean;
  /** Rodapé fixo (só no modo tela cheia) — use para a ação principal */
  footer?: ReactNode;
}

/**
 * Modal acessível e animado.
 * - Celular: "bottom sheet" que sobe da base da tela (alcance do polegar)
 * - Desktop: cartão centralizado com leve zoom de entrada
 * - Esc / toque no fundo fecham; foco preso dentro; rolagem da página travada
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
  fullScreen = false,
  footer,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Em ref (e fora das dependências do efeito): `dismissible` muda a cada
  // envio de formulário, e reexecutar o efeito jogaria o foco de volta para o
  // primeiro botão do modal no meio do uso.
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Foca o primeiro elemento interativo do modal
    const focusables = () =>
      panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [];
    // O painel já está no DOM quando o efeito roda: foca direto (sem rAF,
    // que não dispara em abas que não estão desenhando quadros)
    focusables()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissibleRef.current) onCloseRef.current();
      if (event.key !== 'Tab') return;
      const items = [...focusables()];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  if (fullScreen) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex justify-center sm:items-center sm:p-6">
        <div
          aria-hidden
          onClick={() => dismissible && onClose()}
          className="absolute inset-0 hidden animate-fade-in bg-[rgb(17_17_17/0.38)] backdrop-blur-[3px] sm:block"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className="relative flex h-dvh w-full animate-slide-up flex-col bg-background sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:max-w-lg sm:animate-scale-in sm:rounded-xl sm:shadow-lg"
        >
          {/* Cabeçalho fixo */}
          <header className="glass sticky top-0 z-10 flex items-center gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 shadow-[0_1px_0_rgb(0_0_0/0.05)] sm:rounded-t-xl sm:px-6 sm:pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={!dismissible}
              aria-label="Fechar"
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-muted active:scale-95 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-lg font-extrabold text-ink">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="truncate text-[13px] text-ink-muted">
                  {description}
                </p>
              )}
            </div>
          </header>

          {/* Conteúdo rolável */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">{children}</div>

          {/* Ação principal sempre visível, acima do teclado/gestos do celular */}
          {footer && (
            <footer className="glass sticky bottom-0 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-1px_0_rgb(0_0_0/0.05)] sm:rounded-b-xl sm:px-6 sm:pb-6">
              {footer}
            </footer>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      {/* Overlay suave: escurece pouco e desfoca o fundo */}
      <div
        aria-hidden
        onClick={() => dismissible && onClose()}
        className="absolute inset-0 animate-fade-in bg-[rgb(17_17_17/0.38)] backdrop-blur-[3px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full max-w-md animate-slide-up rounded-t-xl bg-surface px-6 pt-3 pb-[calc(var(--space-6)+env(safe-area-inset-bottom))] shadow-lg sm:animate-scale-in sm:rounded-xl sm:p-8"
      >
        {/* "Pegador" do bottom sheet no celular */}
        <div aria-hidden className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-surface-sunken sm:hidden" />

        <h2 id={titleId} className="text-xl font-extrabold text-ink">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-1 text-[15px] text-ink-muted">
            {description}
          </p>
        )}

        <div className="mt-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
