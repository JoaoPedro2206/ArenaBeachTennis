import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckoutModal } from '@/components/booking/CheckoutModal';
import { CourtSelector } from '@/components/booking/CourtSelector';
import { DateCarousel } from '@/components/booking/DateCarousel';
import { TimeSlotGrid } from '@/components/booking/TimeSlotGrid';
import { bookingService } from '@/services/bookingService';
import type { TimeSlot } from '@/types/booking';
import { useAsync } from '@/hooks/useAsync';
import { dateParts, todayIn } from '@/lib/dates';
import { capitalizeFirst, formatPrice } from '@/lib/format';

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export default function BookingPage() {
  const courtsQuery = useAsync((signal) => bookingService.listCourts(signal), []);
  const courts = courtsQuery.data ?? [];

  const [pickedCourtId, setPickedCourtId] = useState<string | null>(null);
  // Até o usuário escolher, usa a primeira quadra ativa
  const courtId = pickedCourtId ?? courts.find((c) => c.status === 'ACTIVE')?.id ?? courts[0]?.id ?? null;
  const court = courts.find((c) => c.id === courtId);
  const timeZone = court?.arena.timezone ?? DEFAULT_TIMEZONE;

  const [date, setDate] = useState(() => todayIn(DEFAULT_TIMEZONE));
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const availability = useAsync(
    (signal) => bookingService.getAvailability(courtId!, date, signal),
    [courtId, date],
    !!courtId,
  );

  function changeCourt(id: string) {
    setPickedCourtId(id);
    setSelectedSlot(null);
    setNotice(null);
  }

  function changeDate(newDate: string) {
    setDate(newDate);
    setSelectedSlot(null);
    setNotice(null);
  }

  function toggleSlot(slot: TimeSlot) {
    setNotice(null);
    setSelectedSlot((current) => (current?.startTime === slot.startTime ? null : slot));
  }

  /** Fim do checkout (pagou, desistiu ou erro): a grade precisa refletir o novo estado */
  function closeCheckout() {
    setCheckoutOpen(false);
    setSelectedSlot(null);
    availability.reload();
  }

  /** O prazo de 15 min acabou sem pagamento */
  function handleExpired() {
    setCheckoutOpen(false);
    setSelectedSlot(null);
    setNotice('Reserva expirada: o tempo para pagamento acabou e o horário foi liberado. Escolha um horário novamente.');
    availability.reload();
  }

  return (
    <section className={selectedSlot ? 'pb-28 md:pb-24' : undefined}>
      <header>
        <p className="eyebrow">Reservar quadra</p>
        <h1 className="mt-1 text-[28px] leading-tight font-extrabold text-ink sm:text-[32px]">Quando você quer jogar?</h1>
      </header>

      <div className="mt-8 space-y-8">
        <Step title="Quadra">
          {courtsQuery.error ? (
            <p role="alert" className="rounded-md bg-danger-soft p-4 text-sm font-medium text-danger">
              {courtsQuery.error}{' '}
              <button type="button" onClick={courtsQuery.reload} className="font-bold text-primary hover:underline">
                Tentar novamente
              </button>
            </p>
          ) : (
            <CourtSelector courts={courts} value={courtId} onChange={changeCourt} />
          )}
        </Step>

        <Step title="Dia">
          <DateCarousel value={date} onChange={changeDate} timeZone={timeZone} />
        </Step>

        {notice && (
          <div role="alert" className="flex animate-rise items-start gap-3 rounded-lg bg-warning-soft p-4 text-sm font-medium text-warning-ink">
            <span aria-hidden className="text-lg leading-none">⏰</span>
            <span className="flex-1">{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="font-bold" aria-label="Fechar aviso">
              ✕
            </button>
          </div>
        )}

        <Step title="Horário">
          {court?.status === 'MAINTENANCE' ? (
            <div className="rounded-lg bg-warning-soft px-6 py-10 text-center">
              <p className="text-3xl" aria-hidden>
                🛠️
              </p>
              <p className="mt-3 font-bold text-ink">Quadra em manutenção</p>
              <p className="mt-1 text-sm text-warning-ink">Escolha outra quadra para ver os horários.</p>
            </div>
          ) : !courtId && !courtsQuery.loading ? (
            // Sem quadra (lista falhou ou veio vazia) não há grade — e "nenhum
            // horário livre" seria uma informação falsa
            <p className="rounded-lg bg-surface-muted px-6 py-10 text-center text-sm text-ink-muted">
              {courtsQuery.error ? 'Os horários aparecem assim que as quadras carregarem.' : 'Nenhuma quadra disponível no momento.'}
            </p>
          ) : (
            <TimeSlotGrid
              slots={availability.data?.slots ?? []}
              selected={selectedSlot?.startTime ?? null}
              onSelect={toggleSlot}
              loading={courtsQuery.loading || availability.loading}
              error={availability.error}
              onRetry={availability.reload}
            />
          )}
        </Step>
      </div>

      {/* Barra de resumo: flutua acima da BottomTabBar quando há horário escolhido */}
      {selectedSlot && court && (
        <div className="fixed inset-x-0 bottom-tabbar z-20 animate-slide-up px-4 md:bottom-6">
          {/* Vidro mais opaco que o da tab bar: os horários coloridos não "vazam" por trás */}
          <div className="mx-auto flex max-w-sm items-center gap-4 rounded-xl bg-surface/95 p-3 pl-5 shadow-lg ring-1 ring-black/5 backdrop-blur-xl md:max-w-xl">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-extrabold text-ink">
                {selectedSlot.label} · {court.name}
              </p>
              <p className="truncate text-[13px] text-ink-muted">
                {capitalizeFirst(dateParts(date).weekday)}, {dateParts(date).day} {dateParts(date).month} ·{' '}
                <strong className="text-ink">{formatPrice(selectedSlot.price)}</strong>
              </p>
            </div>
            <Button onClick={() => setCheckoutOpen(true)} fullWidth={false} className="shrink-0">
              Continuar
            </Button>
          </div>
        </div>
      )}

      {selectedSlot && court && checkoutOpen && (
        <CheckoutModal
          open
          court={court}
          slot={selectedSlot}
          date={date}
          onClose={closeCheckout}
          onExpired={handleExpired}
        />
      )}
    </section>
  );
}

/** Bloco de etapa com título discreto — separa seções pelo espaço, não por linhas */
function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
