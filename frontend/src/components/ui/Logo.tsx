import logoUrl from '@/assets/brand/logo-arena-beach.png';

/**
 * O PNG original (150×150) tem muita margem transparente: o desenho ocupa só
 * a área abaixo. Enquadramos essa área via CSS para o logo aparecer no tamanho
 * certo sem editar o arquivo da marca.
 */
const SOURCE = 150;
const CROP = { x: 11, y: 37, width: 136, height: 64 };

interface LogoProps {
  /** Altura visível do logo em px (a largura acompanha a proporção ~2,1:1) */
  size?: number;
  className?: string;
}

/** Logo oficial da Arena Beach */
export function Logo({ size = 40, className = '' }: LogoProps) {
  const scale = size / CROP.height;

  return (
    <span
      role="img"
      aria-label="Arena Beach"
      className={`relative block shrink-0 overflow-hidden select-none ${className}`}
      style={{ width: CROP.width * scale, height: size }}
    >
      <img
        src={logoUrl}
        alt=""
        draggable={false}
        className="absolute max-w-none"
        style={{
          width: SOURCE * scale,
          height: SOURCE * scale,
          left: -CROP.x * scale,
          top: -CROP.y * scale,
        }}
      />
    </span>
  );
}
