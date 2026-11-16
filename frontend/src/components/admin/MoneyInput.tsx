import { useEffect, useState } from 'react';

/** "1.200,50" / "120" / "R$ 99,9" -> centavos (NaN se não der para ler) */
export function parseMoney(text: string): number {
  const cleaned = text.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (cleaned === '') return NaN;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}

const formatReais = (cents: number) =>
  Number.isFinite(cents) ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

interface MoneyInputProps {
  /** Centavos (NaN = campo inválido/vazio) */
  value: number;
  onChange: (cents: number) => void;
  label: string;
  /** Sufixo exibido dentro do campo, ex.: "/h" */
  suffix?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * Campo de dinheiro em reais. Enquanto o usuário digita, o texto fica livre
 * ("12", "120,5"); ao sair do campo, vira "120,50". O valor exposto é sempre
 * em centavos — o mesmo formato da API.
 */
export function MoneyInput({ value, onChange, label, suffix = '/h', invalid, className = '' }: MoneyInputProps) {
  const [text, setText] = useState(() => formatReais(value));
  const [focused, setFocused] = useState(false);

  // Valor mudou de fora (descartar alterações, preset): reflete no texto
  useEffect(() => {
    if (!focused) setText(formatReais(value));
  }, [value, focused]);

  return (
    <div
      className={`flex h-11 items-center gap-1 rounded-md bg-surface-muted px-3 transition-all focus-within:bg-surface focus-within:ring-2 ${
        invalid ? 'ring-2 ring-danger focus-within:ring-danger' : 'focus-within:ring-primary'
      } ${className}`}
    >
      <span className="text-sm font-semibold text-ink-subtle" aria-hidden>
        R$
      </span>
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        inputMode="decimal"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(formatReais(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseMoney(e.target.value));
        }}
        className="w-full min-w-0 bg-transparent text-[15px] font-bold text-ink outline-none tabular-nums"
      />
      <span className="text-xs font-semibold text-ink-subtle" aria-hidden>
        {suffix}
      </span>
    </div>
  );
}
