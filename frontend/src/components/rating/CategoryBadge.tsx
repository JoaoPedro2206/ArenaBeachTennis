import { LEVEL_INFO, type PlayerLevel } from '@/types/auth';

/**
 * Medalha da categoria. Só visual: QUAL categoria o jogador tem vem do
 * backend (calculada pelo ELO). Cada nível tem uma "liga" de cor da marca:
 * areia → oceano → verde das ondas → laranja da bola → preto e sol (topo).
 */
const STYLES: Record<PlayerLevel, { medal: string; ring: string; text: string; glow: string }> = {
  INICIANTE: { medal: 'from-[#efe2bf] to-[#c9ad73]', ring: 'ring-[#e4d3a8]', text: 'text-[#5b4a22]', glow: 'shadow-[0_8px_24px_rgb(201_173_115/0.45)]' },
  D: { medal: 'from-[#3fb4dc] to-[#06739a]', ring: 'ring-[#a7dcef]', text: 'text-white', glow: 'shadow-[0_8px_24px_rgb(8_144_192/0.45)]' },
  C: { medal: 'from-[#5fc27c] to-[#2f8a4c]', ring: 'ring-[#b5e3c3]', text: 'text-white', glow: 'shadow-[0_8px_24px_rgb(47_138_76/0.45)]' },
  B: { medal: 'from-[#ff9a63] to-[#c2410c]', ring: 'ring-[#ffd0b5]', text: 'text-white', glow: 'shadow-[0_8px_24px_rgb(255_107_44/0.45)]' },
  A: { medal: 'from-[#2a2a2a] to-[#050505]', ring: 'ring-cta', text: 'text-cta', glow: 'shadow-[0_8px_28px_rgb(248_232_0/0.45)]' },
};

const SIZES = {
  sm: { box: 'size-9', code: 'text-sm', ring: 'ring-2', star: 'size-2.5 -top-0.5' },
  md: { box: 'size-14', code: 'text-xl', ring: 'ring-[3px]', star: 'size-3.5 -top-1' },
  lg: { box: 'size-24', code: 'text-[34px]', ring: 'ring-4', star: 'size-5 -top-1.5' },
} as const;

interface CategoryBadgeProps {
  level: PlayerLevel;
  size?: keyof typeof SIZES;
  className?: string;
}

export function CategoryBadge({ level, size = 'md', className = '' }: CategoryBadgeProps) {
  const style = STYLES[level];
  const dims = SIZES[size];
  const info = LEVEL_INFO[level];

  return (
    <span
      role="img"
      aria-label={info.name}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${style.medal} ${style.ring} ${style.glow} ${dims.box} ${dims.ring} ring-offset-2 ring-offset-transparent ${className}`}
    >
      {/* brilho interno */}
      <span aria-hidden className="absolute inset-[12%] rounded-full bg-gradient-to-b from-white/25 to-transparent" />
      {/* estrela no topo */}
      <svg aria-hidden viewBox="0 0 24 24" className={`absolute left-1/2 -translate-x-1/2 ${dims.star} text-cta drop-shadow`} fill="currentColor">
        <path d="m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7L12 2Z" />
      </svg>
      <span aria-hidden className={`relative font-extrabold tracking-tight ${dims.code} ${style.text}`}>
        {info.code}
      </span>
    </span>
  );
}
