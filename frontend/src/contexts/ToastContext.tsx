import { createContext, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckIcon } from '@/components/icons';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 4000;
const MAX_VISIBLE = 3;

const STYLES: Record<ToastType, { box: string; icon: ReactNode }> = {
  success: {
    box: 'bg-ink text-white',
    icon: (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-cta text-cta-ink">
        <CheckIcon size={14} strokeWidth={3} />
      </span>
    ),
  },
  error: {
    box: 'bg-danger text-white',
    icon: <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">!</span>,
  },
  info: {
    box: 'bg-surface text-ink ring-1 ring-black/5',
    icon: <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">i</span>,
  },
};

/**
 * Notificações discretas no topo da tela (abaixo do cabeçalho), longe da
 * tab bar do celular. Somem sozinhas em 4s; tocar fecha antes.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), { id, type, message }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
      info: (message) => show('info', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(72px+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <button
            key={toast.id}
            type="button"
            role={toast.type === 'error' ? 'alert' : 'status'}
            onClick={() => dismiss(toast.id)}
            className={`pointer-events-auto flex w-full max-w-sm animate-scale-in items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold shadow-lg ${STYLES[toast.type].box}`}
          >
            <span aria-hidden>{STYLES[toast.type].icon}</span>
            <span className="flex-1">{toast.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
