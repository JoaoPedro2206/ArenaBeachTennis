import { useState } from 'react';

interface AvatarProps {
  name: string;
  /** URL da foto; sem foto (ou se ela falhar ao carregar) mostra as iniciais */
  src?: string | null;
  size?: number;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

/** Foto de perfil circular com fallback elegante para as iniciais */
export function Avatar({ name, src, size = 40, className = '' }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = !!src && failedSrc !== src;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink font-extrabold text-cta select-none ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {showPhoto ? (
        <img src={src} alt={`Foto de ${name}`} className="h-full w-full object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        <span aria-label={name}>{initials(name)}</span>
      )}
    </span>
  );
}
