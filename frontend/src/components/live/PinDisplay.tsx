import { useToast } from '@/hooks/useToast';

/** PIN gigante, alto contraste (amarelo sobre preto) para ler de longe e ao sol */
export function PinDisplay({ pin }: { pin: string }) {
  const toast = useToast();
  const pretty = `${pin.slice(0, 3)} ${pin.slice(3)}`;
  const message = `Entra na minha partida no Arena Beach! Código: ${pretty}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(pin);
      toast.success('Código copiado');
    } catch {
      toast.error('Não foi possível copiar. Dite o código: ' + pretty);
    }
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: 'Partida ao vivo', text: message }).catch(() => undefined); // cancelado pelo usuário
    } else {
      void copy();
    }
  }

  return (
    <section aria-label="Código da partida" className="relative overflow-hidden rounded-xl bg-ink px-5 py-7 text-center text-white shadow-md">
      <div aria-hidden className="absolute -top-20 -left-16 size-48 rounded-full bg-primary/40 blur-3xl" />
      <div aria-hidden className="absolute -right-12 -bottom-24 size-48 rounded-full bg-cta/30 blur-3xl" />

      <p className="relative text-xs font-bold tracking-[0.2em] text-white/60 uppercase">Código da partida</p>
      <p
        className="relative mt-2 font-extrabold tracking-[0.12em] text-cta tabular-nums"
        style={{ fontSize: 'clamp(48px, 16vw, 72px)', lineHeight: 1 }}
        aria-label={pin.split('').join(' ')}
      >
        {pretty}
      </p>
      <p className="relative mt-3 text-sm text-white/70">Os outros jogadores digitam este código no app</p>

      <div className="relative mt-5 flex justify-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="h-11 rounded-full bg-white/12 px-5 text-sm font-bold ring-1 ring-white/20 transition-all hover:bg-white/20 active:scale-95"
        >
          Copiar
        </button>
        <button
          type="button"
          onClick={share}
          className="h-11 rounded-full bg-cta px-5 text-sm font-bold text-cta-ink transition-all hover:-translate-y-0.5 active:scale-95"
        >
          Compartilhar
        </button>
      </div>
    </section>
  );
}
