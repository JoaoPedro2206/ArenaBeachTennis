import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/hooks/useToast';
import { formatInZone } from '@/lib/dates';
import { capitalizeFirst } from '@/lib/format';
import { PATHS } from '@/routes/paths';
import { ApiError } from '@/services/api';
import { matchService } from '@/services/matchService';
import type { LiveMatch } from '@/types/match';
import { PinInput } from './PinInput';

const PIN_LENGTH = 6;

interface LiveEntryProps {
  onEnterMatch: (match: LiveMatch) => void;
}

/**
 * Tela inicial do "Ao Vivo": duas ações grandes e claras —
 * entrar com o código de alguém ou abrir a sala da própria reserva.
 */
export function LiveEntry({ onEnterMatch }: LiveEntryProps) {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [joining, setJoining] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const bookings = useAsync((signal) => matchService.eligibleBookings(signal), []);

  async function join(code = pin) {
    if (code.length !== PIN_LENGTH || joining) return;
    setJoining(true);
    setPinError(null);
    try {
      const match = await matchService.join(code);
      toast.success('Você entrou na partida! 🎾');
      onEnterMatch(match);
    } catch (err) {
      setPinError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.');
      setJoining(false);
    }
  }

  async function open(bookingId: string) {
    setOpeningId(bookingId);
    try {
      onEnterMatch(await matchService.create(bookingId));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível abrir a partida.');
      setOpeningId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-danger" aria-hidden /> Ao vivo
        </p>
        <h1 className="mt-1 text-[28px] leading-tight font-extrabold text-ink sm:text-[32px]">Bora jogar?</h1>
        <p className="mt-2 max-w-md text-[15px] text-ink-muted">
          Todos que entram na sala ganham pontos no ranking ao final do jogo — não só quem reservou.
        </p>
      </header>

      {/* Ação 1: entrar com código */}
      <section className="rounded-xl bg-surface p-5 shadow-md sm:p-6" aria-labelledby="join-title">
        <h2 id="join-title" className="text-lg font-extrabold text-ink">
          Entrar com código
        </h2>
        <p className="mt-1 text-sm text-ink-muted">Peça o código de {PIN_LENGTH} dígitos para quem abriu a partida.</p>

        <div className="mt-5">
          <PinInput
            value={pin}
            onChange={(value) => {
              setPin(value);
              if (pinError) setPinError(null);
            }}
            onComplete={(value) => void join(value)}
            disabled={joining}
            invalid={!!pinError}
          />
          {pinError && (
            <p role="alert" className="mt-3 text-center text-sm font-semibold text-danger">
              {pinError}
            </p>
          )}
        </div>

        <Button size="lg" className="mt-5" onClick={() => join()} loading={joining} disabled={pin.length !== PIN_LENGTH}>
          {joining ? 'Entrando…' : 'Entrar na partida'}
        </Button>
      </section>

      {/* Ação 2: abrir a sala da própria reserva */}
      <section className="rounded-xl bg-ink p-5 text-white shadow-md sm:p-6" aria-labelledby="open-title">
        <h2 id="open-title" className="text-lg font-extrabold">
          Abrir minha reserva
        </h2>
        <p className="mt-1 text-sm text-white/70">Gere o código e chame sua turma para a sala.</p>

        <div className="mt-5 space-y-3">
          {bookings.loading && !bookings.data ? (
            <div className="h-[76px] animate-pulse rounded-lg bg-white/10" />
          ) : bookings.error ? (
            // Falha de rede não pode aparecer como "você não tem reservas"
            <div role="alert" className="rounded-lg bg-white/10 p-4 text-sm text-white/80">
              {bookings.error}{' '}
              <button type="button" onClick={bookings.reload} className="font-bold text-cta hover:underline">
                Tentar novamente
              </button>
            </div>
          ) : bookings.data && bookings.data.length > 0 ? (
            bookings.data.map((booking) => {
              const tz = booking.court.arena.timezone;
              const start = formatInZone(booking.startTime, tz);
              const end = formatInZone(booking.endTime, tz).time;
              return (
                <div
                  key={booking.id}
                  className="flex flex-col gap-3 rounded-lg bg-white/10 p-4 sm:flex-row sm:items-center sm:p-3 sm:pl-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{booking.court.name}</p>
                    <p className="text-[13px] text-white/70">
                      {capitalizeFirst(start.date)} · {start.time}–{end}
                    </p>
                  </div>
                  <Button
                    fullWidth={false}
                    className="w-full shrink-0 sm:w-auto"
                    onClick={() => open(booking.id)}
                    loading={openingId === booking.id}
                    disabled={!!openingId}
                  >
                    Abrir partida
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg bg-white/10 p-4 text-sm text-white/80">
              Nenhuma reserva paga nas próximas 2 horas.{' '}
              <Link to={PATHS.booking} className="font-bold text-cta hover:underline">
                Reservar quadra
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
