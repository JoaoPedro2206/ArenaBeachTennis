import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BarChart } from '@/components/admin/BarChart';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { useAsync } from '@/hooks/useAsync';
import { formatHour, formatMonth, formatPercent, formatPriceCompact, shiftMonth } from '@/lib/adminFormat';
import { formatPrice } from '@/lib/format';
import { PATHS } from '@/routes/paths';
import { adminService } from '@/services/adminService';
import type { Reports } from '@/types/admin';

/** Visão geral: a saúde do negócio em um olhar */
export default function AdminDashboardPage() {
  // undefined = mês atual (definido pelo servidor, no fuso da arena)
  const [month, setMonth] = useState<string | undefined>(undefined);
  const reports = useAsync((signal) => adminService.reports(month, signal), [month]);
  const data = reports.data;
  const currentMonth = data?.today.date.slice(0, 7);
  const shownMonth = month ?? currentMonth;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Visão geral</p>
          <h1 className="mt-1 text-[28px] leading-tight font-extrabold text-ink sm:text-[32px]">
            {data?.arena.name ?? 'Sua arena'}
          </h1>
        </div>
        {shownMonth && (
          <MonthPicker
            month={shownMonth}
            canGoForward={!!currentMonth && shownMonth < currentMonth}
            onChange={(m) => setMonth(m === currentMonth ? undefined : m)}
          />
        )}
      </header>

      {reports.error && !data ? (
        <div role="alert" className="rounded-xl bg-danger-soft px-6 py-10 text-center">
          <p className="font-bold text-ink">Não foi possível carregar os indicadores</p>
          <p className="mt-1 text-sm text-danger">{reports.error}</p>
          <button type="button" onClick={reports.reload} className="mt-4 text-sm font-bold text-primary hover:underline">
            Tentar novamente
          </button>
        </div>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        // Trocar de mês mantém o conteúdo anterior esmaecido em vez de piscar o esqueleto
        <div className={`space-y-8 transition-opacity ${reports.loading ? 'opacity-60' : ''}`} aria-busy={reports.loading}>
          <StatCards data={data} />

          <div className="grid gap-6 lg:grid-cols-5">
            <Panel title="Faturamento por dia" subtitle="Reservas pagas, pelo dia do jogo" className="lg:col-span-3">
              <RevenueChart data={data} />
            </Panel>
            <Panel title="Ocupação por quadra" subtitle={`Horas reservadas em ${formatMonth(data.month)}`} className="lg:col-span-2">
              <CourtOccupancy data={data} />
            </Panel>
          </div>

          <Panel
            title="Horários de pico"
            subtitle="Ocupação média por hora do dia, todas as quadras ativas"
            aside={
              <Link to={PATHS.adminPricing} className="text-sm font-bold text-primary hover:underline">
                Ajustar preços →
              </Link>
            }
          >
            <PeakHours data={data} />
          </Panel>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- cartões

function StatCards({ data }: { data: Reports }) {
  const { revenue, occupancy, today } = data;
  const change = revenue.changeRate;

  return (
    <section aria-label="Indicadores do mês" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* Destaque: receita */}
      <article className="relative overflow-hidden rounded-xl bg-ink p-5 text-white shadow-md sm:col-span-2 xl:col-span-1">
        <div aria-hidden className="absolute -top-14 -right-14 size-36 rounded-full bg-cta/25 blur-2xl" />
        <p className="relative text-[11px] font-bold tracking-[0.12em] text-white/60 uppercase">Receita do mês</p>
        <p className="relative mt-2 text-[32px] leading-none font-extrabold tracking-tight text-cta tabular-nums">
          {formatPrice(revenue.total)}
        </p>
        <p className="relative mt-3 text-[13px] text-white/70">
          {change === null ? (
            'Sem faturamento no mês anterior para comparar'
          ) : (
            <>
              <span className="font-bold text-white">
                {change >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(change))}
              </span>{' '}
              vs. mês anterior ({formatPriceCompact(revenue.previousMonth)})
            </>
          )}
        </p>
      </article>

      <StatCard label="Ocupação" value={formatPercent(occupancy.rate)}>
        <Meter value={occupancy.rate} label="Ocupação do mês" />
        <p className="mt-2 text-[13px] text-ink-muted tabular-nums">
          {occupancy.bookedHours.toLocaleString('pt-BR')}h de {occupancy.availableHours.toLocaleString('pt-BR')}h disponíveis
        </p>
      </StatCard>

      <StatCard label="Reservas hoje" value={String(today.bookings)}>
        <p className="mt-3 text-[13px] text-ink-muted">
          {formatPrice(today.paidRevenue)} recebidos
          {today.classes > 0 && ` · ${today.classes} ${today.classes === 1 ? 'aula' : 'aulas'}`}
        </p>
        {today.pendingPayments > 0 && (
          <p className="mt-1 text-[13px] font-semibold text-warning-ink">
            {today.pendingPayments} aguardando pagamento
          </p>
        )}
      </StatCard>

      <StatCard label="Ticket médio" value={formatPrice(revenue.averageTicket)}>
        <p className="mt-3 text-[13px] text-ink-muted">
          {revenue.paidBookings} {revenue.paidBookings === 1 ? 'reserva paga' : 'reservas pagas'}
        </p>
        {revenue.pending > 0 && (
          <p className="mt-1 text-[13px] text-ink-muted">
            <strong className="text-ink">{formatPrice(revenue.pending)}</strong> a receber
          </p>
        )}
      </StatCard>
    </section>
  );
}

function StatCard({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <article className="rounded-xl bg-surface p-5 shadow-sm">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-[32px] leading-none font-extrabold tracking-tight text-ink tabular-nums">{value}</p>
      {children}
    </article>
  );
}

/** Barra de progresso de 0–100% (trilho neutro + preenchimento na cor primária) */
function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- painéis

function Panel({
  title,
  subtitle,
  aside,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-xl bg-surface p-5 shadow-sm sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          {subtitle && <p className="text-[13px] text-ink-muted">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function RevenueChart({ data }: { data: Reports }) {
  const days = data.revenue.byDay;
  const best = Math.max(...days.map((d) => d.revenue));

  if (best === 0) {
    return <EmptyChart message="Nenhuma reserva paga neste mês ainda." />;
  }

  return (
    <BarChart
      label={`Faturamento por dia em ${formatMonth(data.month)}`}
      format={formatPriceCompact}
      formatValue={formatPrice}
      data={days.map((d) => {
        const day = Number(d.date.slice(8));
        return {
          key: d.date,
          // Rótulo a cada 5 dias: legível no celular sem amontoar
          axisLabel: day === 1 || day % 5 === 0 ? String(day) : undefined,
          value: d.revenue,
          tooltip: `Dia ${day}: ${formatPrice(d.revenue)}`,
          // Rótulo direto só no melhor dia
          showValue: d.revenue === best,
        };
      })}
    />
  );
}

function CourtOccupancy({ data }: { data: Reports }) {
  return (
    <ul className="space-y-5">
      {data.occupancy.byCourt.map((court) => (
        <li key={court.courtId}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[15px] font-bold text-ink">{court.name}</p>
            {court.status === 'ACTIVE' ? (
              <p className="shrink-0 text-[15px] font-extrabold text-ink tabular-nums">{formatPercent(court.occupancyRate)}</p>
            ) : (
              <span className="shrink-0 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-bold text-warning-ink">Em manutenção</span>
            )}
          </div>
          {court.status === 'ACTIVE' && <Meter value={court.occupancyRate} label={`Ocupação da ${court.name}`} />}
          <p className="mt-1.5 text-xs text-ink-subtle tabular-nums">
            {court.bookedHours.toLocaleString('pt-BR')}h reservadas · {formatPrice(court.revenue)}
            {court.blockedHours > 0 && ` · ${court.blockedHours.toLocaleString('pt-BR')}h bloqueadas`}
          </p>
        </li>
      ))}
    </ul>
  );
}

function PeakHours({ data }: { data: Reports }) {
  const { byHour, top } = data.peakHours;
  if (top.length === 0) return <EmptyChart message="Ainda não há reservas suficientes para identificar os picos." />;

  return (
    <div className="space-y-5">
      <BarChart
        label="Ocupação por hora do dia"
        format={formatPercent}
        minMax={10}
        height={160}
        data={byHour.map((h) => ({
          key: formatHour(h.hour),
          axisLabel: h.hour % 2 === 0 ? formatHour(h.hour) : undefined,
          value: h.occupancyRate,
          tooltip: `${formatHour(h.hour)}–${formatHour(h.hour + 1)}: ${formatPercent(h.occupancyRate)} (${h.bookedHours.toLocaleString('pt-BR')}h)`,
          showValue: top.includes(h.hour),
        }))}
      />
      <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-ink-muted">
        <strong className="text-ink">Mais disputados:</strong> {top.map((h) => `${formatHour(h)}–${formatHour(h + 1)}`).join(', ')}.
        Horários cheios são bons candidatos a preço de horário nobre.
      </p>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center rounded-lg bg-surface-muted px-6 text-center text-sm text-ink-muted">
      {message}
    </div>
  );
}

function MonthPicker({ month, canGoForward, onChange }: { month: string; canGoForward: boolean; onChange: (m: string) => void }) {
  const arrow =
    'flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-muted active:scale-95 disabled:pointer-events-none disabled:opacity-30';
  return (
    <div className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-sm">
      <button type="button" className={arrow} onClick={() => onChange(shiftMonth(month, -1))} aria-label="Mês anterior">
        <ChevronLeftIcon size={18} />
      </button>
      <span className="min-w-[150px] text-center text-sm font-bold text-ink first-letter:uppercase" aria-live="polite">
        {formatMonth(month)}
      </span>
      <button type="button" className={arrow} onClick={() => onChange(shiftMonth(month, 1))} disabled={!canGoForward} aria-label="Próximo mês">
        <ChevronRightIcon size={18} />
      </button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando indicadores">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[138px] animate-pulse rounded-xl bg-surface-muted" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="h-72 animate-pulse rounded-xl bg-surface-muted lg:col-span-3" />
        <div className="h-72 animate-pulse rounded-xl bg-surface-muted lg:col-span-2" />
      </div>
    </div>
  );
}
