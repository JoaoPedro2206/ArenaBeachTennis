import { BookingsRepository } from './bookings.repository';

/**
 * Libera quadras de reservas não pagas no prazo.
 *
 * Duas camadas garantem o "exatamente 15 minutos":
 * 1. Varredura periódica (este worker): cancela em lote todas as vencidas.
 * 2. Varredura sob demanda: antes de montar a grade ou criar uma reserva, o
 *    service chama `expireOverdue(courtId)` — assim o horário aparece livre
 *    no instante em que o prazo vence, sem esperar o próximo ciclo.
 *
 * Um setInterval no próprio processo basta para um único servidor. Com várias
 * instâncias, a mesma query continua correta (é idempotente), apenas roda
 * em paralelo; aí vale migrar para um job agendado (ex.: pg_cron/BullMQ).
 */
export class BookingExpirationWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly intervalMs: number,
    private readonly bookingsRepository = new BookingsRepository(),
  ) {}

  start(): void {
    if (this.timer) return;
    void this.sweep(); // limpa o que venceu enquanto o servidor estava parado
    this.timer = setInterval(() => void this.sweep(), this.intervalMs);
    this.timer.unref(); // não impede o processo de encerrar
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async sweep(): Promise<void> {
    if (this.running) return; // evita sobreposição se o banco estiver lento
    this.running = true;
    try {
      const expired = await this.bookingsRepository.expireOverdue();
      if (expired > 0) console.log(`[expiração] ${expired} reserva(s) não paga(s) cancelada(s)`);
    } catch (error) {
      console.error('[expiração] falha na varredura:', error);
    } finally {
      this.running = false;
    }
  }
}
