import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/** Classes compartilhadas por input e select: campo "afundado" na areia, sem borda dura */
const FIELD_CLASSES =
  'h-[52px] w-full rounded-md bg-surface-muted px-4 text-base text-ink outline-none ring-1 ring-transparent transition-all duration-200 placeholder:text-ink-subtle hover:bg-surface-sunken focus:bg-surface focus:ring-2 focus:ring-primary focus:shadow-[0_0_0_6px_var(--primary-soft)]';

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Conteúdo à direita do rótulo (ex.: contador de caracteres) */
  aside?: ReactNode;
  children: ReactNode;
}

function FieldShell({ id, label, error, hint, aside, children }: FieldShellProps) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-semibold text-ink">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-sm text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, className = '', ...props }: TextFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        {...props}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        // text-base (16px) evita o zoom automático do iOS ao focar
        className={`${FIELD_CLASSES} ${error ? 'ring-2 ring-danger/60' : ''} ${className}`}
      />
    </FieldShell>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
}

export function SelectField({ label, hint, className = '', children, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <div className="relative">
        <select id={id} {...props} className={`${FIELD_CLASSES} appearance-none pr-11 ${className}`}>
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ink-subtle"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Mostra o contador "n/max" e fica laranja perto do limite */
  maxChars?: number;
}

export function TextAreaField({ label, error, hint, maxChars, value, className = '', ...props }: TextAreaFieldProps) {
  const id = useId();
  const length = typeof value === 'string' ? value.length : 0;
  const near = maxChars !== undefined && length > maxChars * 0.9;
  const over = maxChars !== undefined && length > maxChars;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      aside={
        maxChars !== undefined && (
          <span
            aria-live="polite"
            className={`text-xs font-semibold tabular-nums ${over ? 'text-danger' : near ? 'text-accent-strong' : 'text-ink-subtle'}`}
          >
            {length}/{maxChars}
          </span>
        )
      }
    >
      <textarea
        id={id}
        value={value}
        {...props}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`${FIELD_CLASSES} h-auto min-h-[112px] resize-none py-3 leading-relaxed ${error ? 'ring-2 ring-danger/60' : ''} ${className}`}
      />
    </FieldShell>
  );
}
