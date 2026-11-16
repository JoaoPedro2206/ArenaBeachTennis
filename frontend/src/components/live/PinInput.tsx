import { useRef, useState } from 'react';

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Chamado quando os N dígitos são preenchidos (entra direto, sem apertar botão) */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * Campo de PIN em caixas grandes — fácil de ler sob o sol e de tocar.
 * Por baixo é UM input numérico invisível sobre as caixas: assim funcionam
 * colar o código, o autocompletar do teclado e o backspace, sem gambiarras.
 */
export function PinInput({ value, onChange, onComplete, length = 6, disabled, invalid }: PinInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  }

  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        aria-label={`Código da partida, ${length} dígitos`}
        maxLength={length}
        value={value}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div aria-hidden className={`grid gap-2 ${invalid ? 'animate-[shake_.35s_ease-in-out]' : ''}`} style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
        {Array.from({ length }, (_, i) => {
          const digit = value[i];
          const isCaret = focused && i === Math.min(value.length, length - 1);
          return (
            <span
              key={i}
              className={`flex h-16 items-center justify-center rounded-md text-[32px] font-extrabold tabular-nums transition-all duration-150 ${
                invalid
                  ? 'bg-danger-soft text-danger ring-2 ring-danger/50'
                  : isCaret
                    ? 'bg-surface text-ink ring-2 ring-primary shadow-[0_0_0_5px_var(--primary-soft)]'
                    : digit
                      ? 'bg-surface text-ink shadow-sm'
                      : 'bg-surface-muted text-ink-subtle'
              } ${i === length / 2 - 1 ? 'mr-1.5' : ''}`}
            >
              {digit ?? (isCaret ? <span className="h-8 w-0.5 animate-pulse rounded-full bg-primary" /> : '')}
            </span>
          );
        })}
      </div>
      <style>{'@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}'}</style>
    </div>
  );
}
