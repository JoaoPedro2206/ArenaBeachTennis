import { Logo } from './Logo';

export function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background" role="status" aria-live="polite">
      <Logo size={56} className="animate-pulse" />
      <span className="h-1 w-24 overflow-hidden rounded-full bg-surface-sunken">
        <span className="block h-full w-1/2 animate-[slide-x_1s_ease-in-out_infinite_alternate] rounded-full bg-primary" />
      </span>
      <span className="sr-only">Carregando…</span>
      <style>{'@keyframes slide-x{from{transform:translateX(-50%)}to{transform:translateX(150%)}}'}</style>
    </div>
  );
}
