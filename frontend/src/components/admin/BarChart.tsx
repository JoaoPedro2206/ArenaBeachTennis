import { useId, useState, type ReactNode } from 'react';

export interface BarDatum {
  key: string;
  /** Rótulo do eixo X (pode ser omitido em parte das barras para não poluir) */
  axisLabel?: string;
  value: number;
  /** Conteúdo do tooltip (padrão: valor formatado) */
  tooltip: ReactNode;
  /** Mostra o valor acima da barra (rótulo direto seletivo: só destaques) */
  showValue?: boolean;
}

interface BarChartProps {
  data: BarDatum[];
  /** Formata valores do eixo Y (pode ser compacto: "R$ 2 mil") */
  format: (value: number) => string;
  /** Formata os rótulos diretos e a tabela (padrão: `format`) — use o valor exato */
  formatValue?: (value: number) => string;
  /** Descrição da série para leitores de tela (o título visível fica fora) */
  label: string;
  /** Teto mínimo do eixo (ex.: 100 para percentuais) */
  minMax?: number;
  height?: number;
}

/** Arredonda o máximo para um número "redondo" (1, 2, 2,5, 5 × 10ⁿ) */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * exp >= value) ?? 10;
  return step * exp;
}

/**
 * Gráfico de barras de UMA série (sem legenda: o título da seção nomeia a série).
 * Segue o guia de dataviz do projeto: barra fina com topo arredondado de 4px
 * ancorada na base, 2px de respiro entre barras, grade e eixos discretos,
 * texto sempre em cor de texto (nunca na cor da série), tooltip por barra com
 * área de toque maior que a barra, e uma tabela equivalente para leitores de tela.
 */
export function BarChart({ data, format, formatValue = format, label, minMax = 0, height = 180 }: BarChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();
  const max = niceCeil(Math.max(minMax, ...data.map((d) => d.value)));
  const gridValues = [max, max / 2, 0];

  return (
    <div className="relative">
      <div className="flex gap-3">
        {/* Eixo Y */}
        <div className="flex shrink-0 flex-col justify-between text-right text-[11px] font-medium text-ink-subtle tabular-nums" style={{ height }} aria-hidden>
          {gridValues.map((v) => (
            <span key={v} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {format(v)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Grade horizontal (recessiva) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height }} aria-hidden>
            {gridValues.map((v) => (
              <span key={v} className={`block h-px ${v === 0 ? 'bg-ink/15' : 'bg-ink/[0.06]'}`} />
            ))}
          </div>

          {/* Barras */}
          <div
            role="img"
            aria-label={label}
            aria-describedby={tableId}
            className="relative flex items-end gap-[2px]"
            style={{ height }}
            onMouseLeave={() => setActive(null)}
          >
            {data.map((d, i) => {
              const pct = (d.value / max) * 100;
              const isActive = active === i;
              return (
                <div
                  key={d.key}
                  className="relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  tabIndex={0}
                  aria-label={typeof d.tooltip === 'string' ? d.tooltip : undefined}
                >
                  {d.showValue && d.value > 0 && (
                    <span
                      className="absolute z-[1] text-[11px] font-bold whitespace-nowrap text-ink tabular-nums"
                      style={{ bottom: `calc(${pct}% + 4px)` }}
                    >
                      {formatValue(d.value)}
                    </span>
                  )}
                  <span
                    className={`block w-full max-w-7 rounded-t-[4px] transition-[height,background-color] duration-500 ease-out ${
                      isActive ? 'bg-primary-strong' : 'bg-primary'
                    }`}
                    // Valor > 0 sempre aparece (mínimo 2px); zero não desenha barra
                    style={{ height: d.value > 0 ? `max(${pct}%, 2px)` : 0 }}
                  />
                  {isActive && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute z-10 rounded-md bg-ink px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-lg"
                      style={{ bottom: `calc(${Math.min(pct, 82)}% + 10px)` }}
                    >
                      {d.tooltip}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Eixo X */}
          <div className="mt-2 flex gap-[2px] text-[11px] font-medium text-ink-subtle tabular-nums" aria-hidden>
            {data.map((d) => (
              <span key={d.key} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
                {d.axisLabel ?? ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Versão em tabela para leitores de tela */}
      <table id={tableId} className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.key}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
