import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MoneyInput } from '@/components/admin/MoneyInput';
import { Button } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { formatPrice, formatPriceShort } from '@/lib/format';
import { WEEKDAYS, describeDays, endMinutes, resolvePrice, ruleProblem, toMinutes } from '@/lib/pricing';
import { ApiError } from '@/services/api';
import { adminService } from '@/services/adminService';
import type { PricingConfig, PricingCourt, PricingRule } from '@/types/admin';

/** Regra no formulário: `key` estável para o React (regras novas ainda não têm id) */
type FormRule = PricingRule & { key: string };

interface FormState {
  courts: Array<{ id: string; pricePerHour: number }>;
  rules: FormRule[];
}

let keySeq = 0;
const newKey = () => `rule-${++keySeq}`;

function toForm(config: PricingConfig): FormState {
  return {
    courts: config.courts.map((c) => ({ id: c.id, pricePerHour: c.pricePerHour })),
    rules: config.rules.map((r) => ({ ...r, key: r.id ?? newKey() })),
  };
}

/** Comparação sem as chaves de UI: detecta alterações não salvas */
const snapshot = (form: FormState) =>
  JSON.stringify({ c: form.courts, r: form.rules.map(({ key: _k, id: _i, ...rule }) => rule) });

/** Arredonda para múltiplos de R$ 10 (preços "de cardápio") */
const roundTo10 = (cents: number) => Math.round(cents / 1000) * 1000;

export default function AdminPricingPage() {
  const config = useAsync((signal) => adminService.pricing(signal), []);

  if (config.error && !config.data) {
    return (
      <div role="alert" className="rounded-xl bg-danger-soft px-6 py-10 text-center">
        <p className="font-bold text-ink">Não foi possível carregar os preços</p>
        <p className="mt-1 text-sm text-danger">{config.error}</p>
        <button type="button" onClick={config.reload} className="mt-4 text-sm font-bold text-primary hover:underline">
          Tentar novamente
        </button>
      </div>
    );
  }
  if (!config.data) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Carregando preços">
        <div className="h-12 w-1/2 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-surface-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-surface-muted" />
      </div>
    );
  }
  return <PricingEditor initial={config.data} />;
}

function PricingEditor({ initial }: { initial: PricingConfig }) {
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(() => toForm(initial));
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const dirty = snapshot(form) !== snapshot(toForm(saved));
  const courtProblems = form.courts.filter((c) => !Number.isFinite(c.pricePerHour) || c.pricePerHour < 0).map((c) => c.id);
  const problems = new Map(form.rules.map((r) => [r.key, ruleProblem(r)] as const).filter(([, p]) => p !== null));
  const valid = courtProblems.length === 0 && problems.size === 0;

  // Sair da página com alterações não salvas: o navegador pergunta antes
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const courts = saved.courts;
  const maxBase = Math.max(...form.courts.map((c) => (Number.isFinite(c.pricePerHour) ? c.pricePerHour : 0)), 0);

  function setCourtPrice(id: string, pricePerHour: number) {
    setForm((f) => ({ ...f, courts: f.courts.map((c) => (c.id === id ? { ...c, pricePerHour } : c)) }));
  }

  function updateRule(key: string, patch: Partial<PricingRule>) {
    setForm((f) => ({ ...f, rules: f.rules.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  }

  function addRule(rule: PricingRule) {
    setForm((f) => ({ ...f, rules: [...f.rules, { ...rule, key: newKey() }] }));
  }

  async function save() {
    if (!valid) {
      setShowErrors(true);
      toast.error('Revise os campos destacados antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      const updated = await adminService.updatePricing({
        courts: form.courts.map((c) => ({ courtId: c.id, pricePerHour: c.pricePerHour })),
        rules: form.rules.map(({ key: _k, id: _i, ...rule }) => rule),
      });
      setSaved(updated);
      setForm(toForm(updated));
      setShowErrors(false);
      toast.success('Preços salvos. Valem para as próximas reservas.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível salvar os preços.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`space-y-8 ${dirty ? 'pb-28' : ''}`}>
      <header>
        <p className="eyebrow">Configurações financeiras</p>
        <h1 className="mt-1 text-[28px] leading-tight font-extrabold text-ink sm:text-[32px]">Preços das quadras</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
          Defina o preço base de cada quadra e crie regras para cobrar diferente em horários nobres ou no fim de semana.
          Mudanças valem para <strong className="text-ink">novas reservas</strong> — quem já reservou mantém o valor pago.
        </p>
      </header>

      {/* ---------- preço base ---------- */}
      <section className="rounded-xl bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="base-title">
        <h2 id="base-title" className="text-lg font-extrabold text-ink">
          Preço base
        </h2>
        <p className="text-[13px] text-ink-muted">Cobrado em qualquer horário sem regra especial</p>
        <ul className="mt-5 divide-y divide-surface-muted">
          {courts.map((court) => {
            const value = form.courts.find((c) => c.id === court.id)?.pricePerHour ?? NaN;
            return (
              <li key={court.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold text-ink">{court.name}</p>
                  <p className="text-xs text-ink-subtle">
                    {court.openTime}–{court.closeTime === '00:00' ? '24:00' : court.closeTime} · slots de {court.slotDurationMin} min
                    {court.status === 'MAINTENANCE' && ' · em manutenção'}
                  </p>
                </div>
                <MoneyInput
                  label={`Preço base da ${court.name} por hora`}
                  value={value}
                  onChange={(cents) => setCourtPrice(court.id, cents)}
                  invalid={showErrors && courtProblems.includes(court.id)}
                  className="w-44"
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------- regras ---------- */}
      <section aria-labelledby="rules-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="rules-title" className="text-lg font-extrabold text-ink">
              Regras de preço
            </h2>
            <p className="text-[13px] text-ink-muted">
              Regra de uma quadra vence a regra geral; se duas valerem ao mesmo tempo, vale o maior preço.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <PresetButton
            onClick={() =>
              addRule({ name: 'Horário nobre', courtId: null, daysOfWeek: [1, 2, 3, 4, 5], startTime: '18:00', endTime: '22:00', pricePerHour: roundTo10(maxBase * 1.3) })
            }
          >
            ☀️ Horário nobre <span className="text-ink-subtle">Seg–Sex 18h–22h</span>
          </PresetButton>
          <PresetButton
            onClick={() =>
              addRule({ name: 'Fim de semana', courtId: null, daysOfWeek: [6, 0], startTime: '08:00', endTime: '18:00', pricePerHour: roundTo10(maxBase * 1.2) })
            }
          >
            🏖️ Fim de semana <span className="text-ink-subtle">Sáb–Dom 8h–18h</span>
          </PresetButton>
          <PresetButton
            onClick={() =>
              addRule({ name: 'Promoção da manhã', courtId: null, daysOfWeek: [1, 2, 3, 4, 5], startTime: '06:00', endTime: '09:00', pricePerHour: roundTo10(maxBase * 0.8) })
            }
          >
            🌅 Promoção da manhã <span className="text-ink-subtle">Seg–Sex 6h–9h</span>
          </PresetButton>
          <PresetButton
            onClick={() => addRule({ name: '', courtId: null, daysOfWeek: [], startTime: '18:00', endTime: '22:00', pricePerHour: maxBase })}
          >
            + Regra em branco
          </PresetButton>
        </div>

        {form.rules.length === 0 ? (
          <div className="rounded-xl bg-surface-muted px-6 py-10 text-center">
            <p className="font-bold text-ink">Nenhuma regra: todos os horários custam o preço base</p>
            <p className="mt-1 text-sm text-ink-muted">Use um dos atalhos acima para começar.</p>
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {form.rules.map((rule) => (
              <RuleCard
                key={rule.key}
                rule={rule}
                courts={courts}
                problem={showErrors ? (problems.get(rule.key) ?? null) : null}
                onChange={(patch) => updateRule(rule.key, patch)}
                onRemove={() => setForm((f) => ({ ...f, rules: f.rules.filter((r) => r.key !== rule.key) }))}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ---------- prévia ---------- */}
      <PriceMap courts={courts} form={form} />

      {/* ---------- barra de salvar ---------- */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 animate-slide-up px-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:pl-[calc(16rem+16px)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-xl bg-ink p-3 pl-5 text-white shadow-lg">
            <p className="min-w-0 flex-1 text-sm font-semibold">
              Alterações não salvas
              {!valid && showErrors && <span className="block text-xs font-medium text-cta">Há campos a corrigir</span>}
            </p>
            <Button
              variant="ghost"
              fullWidth={false}
              onClick={() => {
                setForm(toForm(saved));
                setShowErrors(false);
              }}
              disabled={saving}
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              Descartar
            </Button>
            <Button fullWidth={false} onClick={save} loading={saving}>
              Salvar preços
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PresetButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-bold text-ink shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm active:scale-95"
    >
      {children}
    </button>
  );
}

function RuleCard({
  rule,
  courts,
  problem,
  onChange,
  onRemove,
}: {
  rule: FormRule;
  courts: PricingCourt[];
  problem: string | null;
  onChange: (patch: Partial<PricingRule>) => void;
  onRemove: () => void;
}) {
  const inputClass =
    'h-11 w-full rounded-md bg-surface-muted px-3 text-[15px] font-semibold text-ink outline-none transition-all focus:bg-surface focus:ring-2 focus:ring-primary';

  return (
    <li className={`animate-rise rounded-xl bg-surface p-5 shadow-sm ${problem ? 'ring-2 ring-danger' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          aria-label="Nome da regra"
          value={rule.name}
          maxLength={60}
          placeholder="Nome da regra (ex.: Horário nobre)"
          onChange={(e) => onChange({ name: e.target.value })}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-base font-extrabold text-ink outline-none placeholder:font-semibold placeholder:text-ink-subtle focus:bg-surface-muted"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover regra ${rule.name || 'sem nome'}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger"
        >
          ✕
        </button>
      </div>

      {/* Dias */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
        {WEEKDAYS.map((day) => {
          const on = rule.daysOfWeek.includes(day.value);
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={on}
              aria-label={day.long}
              onClick={() =>
                onChange({ daysOfWeek: on ? rule.daysOfWeek.filter((d) => d !== day.value) : [...rule.daysOfWeek, day.value] })
              }
              className={`h-9 w-11 rounded-full text-xs font-bold transition-all active:scale-95 ${
                on ? 'bg-ink text-white' : 'bg-surface-muted text-ink-muted hover:bg-surface-sunken'
              }`}
            >
              {day.short}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-1">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Das</span>
          <input type="time" step={1800} value={rule.startTime} onChange={(e) => onChange({ startTime: e.target.value })} className={inputClass} />
        </label>
        <label className="col-span-1">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Até</span>
          <input type="time" step={1800} value={rule.endTime} onChange={(e) => onChange({ endTime: e.target.value })} className={inputClass} />
        </label>
        <div className="col-span-2">
          <span className="mb-1 block text-xs font-semibold text-ink-muted">Preço</span>
          <MoneyInput label={`Preço por hora da regra ${rule.name}`} value={rule.pricePerHour} onChange={(cents) => onChange({ pricePerHour: cents })} />
        </div>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-ink-muted">Vale para</span>
        <select value={rule.courtId ?? ''} onChange={(e) => onChange({ courtId: e.target.value || null })} className={inputClass}>
          <option value="">Todas as quadras</option>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              Só {c.name}
            </option>
          ))}
        </select>
      </label>

      {problem ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {problem}
        </p>
      ) : (
        <p className="mt-3 text-xs text-ink-subtle">
          {rule.daysOfWeek.length > 0 ? describeDays(rule.daysOfWeek) : 'Nenhum dia'} · {rule.startTime}–{rule.endTime === '00:00' ? '24:00' : rule.endTime}
          {Number.isFinite(rule.pricePerHour) && ` · ${formatPrice(rule.pricePerHour)}/h`}
        </p>
      )}
    </li>
  );
}

/**
 * Mapa da semana: o preço que cada horário vai custar com as regras ATUAIS do
 * formulário (antes de salvar). Cor = magnitude (uma só cor, do claro para o
 * escuro); o valor está sempre escrito na célula, então a cor nunca é a única pista.
 */
function PriceMap({ courts, form }: { courts: PricingCourt[]; form: FormState }) {
  const [courtId, setCourtId] = useState(courts[0]?.id ?? '');
  const court = courts.find((c) => c.id === courtId) ?? courts[0];

  const grid = useMemo(() => {
    if (!court) return null;
    const pricePerHour = form.courts.find((c) => c.id === court.id)?.pricePerHour ?? court.pricePerHour;
    const validRules = form.rules.filter((r) => ruleProblem(r) === null);
    const open = toMinutes(court.openTime);
    const close = endMinutes(court.closeTime);
    const rows: number[] = [];
    for (let m = open; m + court.slotDurationMin <= close; m += court.slotDurationMin) rows.push(m);

    const cells = rows.map((minute) =>
      WEEKDAYS.map((day) => resolvePrice({ id: court.id, pricePerHour: Number.isFinite(pricePerHour) ? pricePerHour : 0 }, validRules, day.value, minute)),
    );
    const prices = cells.flat().map((c) => c.pricePerHour);
    return { rows, cells, min: Math.min(...prices), max: Math.max(...prices) };
  }, [court, form]);

  if (!court || !grid) return null;

  // 4 degraus da mesma cor (sequencial): mais escuro = mais caro
  const STEPS = ['bg-surface-muted', 'bg-primary/15', 'bg-primary/30', 'bg-primary/50'];
  const step = (price: number) =>
    grid.max === grid.min ? 0 : Math.min(STEPS.length - 1, Math.floor(((price - grid.min) / (grid.max - grid.min)) * (STEPS.length - 1) + 0.5));
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  return (
    <section className="rounded-xl bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="map-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="map-title" className="text-lg font-extrabold text-ink">
            Mapa de preços da semana
          </h2>
          <p className="text-[13px] text-ink-muted">Prévia com as regras acima (por hora). Passe o mouse para ver a regra aplicada.</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-full bg-surface-muted p-1" role="tablist" aria-label="Quadra">
          {courts.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === court.id}
              onClick={() => setCourtId(c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${c.id === court.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[560px] border-separate border-spacing-[2px] text-center text-xs tabular-nums">
          <thead>
            <tr>
              <th className="w-14" />
              {WEEKDAYS.map((d) => (
                <th key={d.value} scope="col" className="pb-1 font-bold text-ink-muted">
                  {d.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((minute, r) => (
              <tr key={minute}>
                <th scope="row" className="pr-2 text-right font-semibold text-ink-subtle">
                  {hhmm(minute)}
                </th>
                {grid.cells[r].map((cell, d) => (
                  <td
                    key={WEEKDAYS[d].value}
                    title={`${WEEKDAYS[d].long}, ${hhmm(minute)}: ${formatPrice(cell.pricePerHour)}/h · ${cell.rule ? cell.rule.name || 'regra sem nome' : 'preço base'}`}
                    className={`h-8 rounded-[4px] font-semibold text-ink ${STEPS[step(cell.pricePerHour)]}`}
                  >
                    {formatPriceShort(cell.pricePerHour)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-ink-subtle" aria-hidden>
        <span>{formatPriceShort(grid.min)}</span>
        {STEPS.map((s) => (
          <span key={s} className={`h-3 w-6 rounded-[3px] ${s}`} />
        ))}
        <span>{formatPriceShort(grid.max)}</span>
      </div>
    </section>
  );
}
