import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './shared/database/prisma';
import { BookingExpirationWorker } from './modules/bookings/booking-expiration';

const app = createApp();
const expirationWorker = new BookingExpirationWorker(env.BOOKING_EXPIRATION_SWEEP_MS);

// No Express 5 o callback do listen também recebe o erro (ex.: porta em uso).
// Sem checar, o log diria "rodando" e o worker iniciaria com o servidor fora do ar.
const server = app.listen(env.PORT, (error?: Error) => {
  if (error) {
    console.error(`❌ Não foi possível iniciar o servidor na porta ${env.PORT}:`, error.message);
    process.exit(1);
  }
  console.log(`🏖️  ArenaBeach API rodando em http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  expirationWorker.start();
});

/** Encerramento gracioso: para de aceitar conexões e fecha o pool do banco. */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} recebido. Encerrando...`);
  expirationWorker.stop();
  server.close(() => {
    prisma
      .$disconnect()
      .catch((error) => console.error('Falha ao fechar a conexão com o banco:', error))
      .finally(() => process.exit(0));
  });
  // Força a saída se algo travar
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Rede de segurança para erros fora do ciclo de request
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
