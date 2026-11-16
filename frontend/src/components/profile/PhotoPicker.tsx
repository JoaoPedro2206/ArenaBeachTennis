import { useId, useRef, type ChangeEvent } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { ACCEPTED_PHOTO_TYPES, validatePhoto } from '@/lib/profileForm';

interface PhotoPickerProps {
  name: string;
  /** URL para o preview: foto atual, blob da nova escolhida ou null */
  previewUrl: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
  onInvalid: (message: string) => void;
  disabled?: boolean;
  error?: string;
}

/** Preview circular com botão de câmera; a troca só é enviada ao salvar */
export function PhotoPicker({ name, previewUrl, onPick, onRemove, onInvalid, disabled, error }: PhotoPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;
    const problem = validatePhoto(file);
    if (problem) return onInvalid(problem);
    onPick(file);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <Avatar name={name || '?'} src={previewUrl} size={112} className="ring-4 ring-surface shadow-md" />
        <label
          htmlFor={inputId}
          aria-label="Trocar foto de perfil"
          className={`absolute right-0 bottom-0 flex size-10 cursor-pointer items-center justify-center rounded-full bg-cta text-cta-ink shadow-cta ring-4 ring-background transition-transform hover:scale-105 active:scale-95 ${
            disabled ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {/* Câmera */}
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14.5 4h-5L7.5 6.5H5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-2.5L14.5 4Z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_PHOTO_TYPES.join(',')}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only"
        />
      </div>

      <div className="mt-4 flex items-center gap-4 text-sm font-bold">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled} className="text-primary hover:underline">
          {previewUrl ? 'Trocar foto' : 'Adicionar foto'}
        </button>
        {previewUrl && (
          <button type="button" onClick={onRemove} disabled={disabled} className="text-ink-subtle hover:text-danger">
            Remover
          </button>
        )}
      </div>
      <p className={`mt-1 text-xs ${error ? 'font-medium text-danger' : 'text-ink-subtle'}`}>
        {error ?? 'JPG, PNG ou WebP · até 5 MB'}
      </p>
    </div>
  );
}
