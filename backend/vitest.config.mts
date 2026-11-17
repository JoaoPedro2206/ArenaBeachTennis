import { defineConfig } from 'vitest/config';

/**
 * Banco da suíte de integração. Padrão = serviço `postgres-test` do
 * docker-compose (porta 5434). No CI, defina TEST_DATABASE_URL.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5434/arenabeach_test?schema=public&connection_limit=10';

const baseEnv = {
  NODE_ENV: 'test',
  JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres!!',
  APP_URL: 'http://app.test',
  MAIL_PROVIDER: 'console',
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/integration/**'],
          // Os unitários nunca abrem conexão: um endereço inválido garante isso
          env: { ...baseEnv, DATABASE_URL: 'postgresql://unit:unit@127.0.0.1:1/never' },
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          env: { ...baseEnv, DATABASE_URL: TEST_DATABASE_URL },
          globalSetup: ['tests/integration/global-setup.ts'],
          setupFiles: ['tests/integration/setup.ts'],
          // Todos os arquivos compartilham o mesmo banco: um de cada vez
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/@types/**'],
      reporter: ['text-summary', 'text', 'html'],
      // Critério de aceite: >= 90% nas regras puras (dinheiro, ranking e horários)
      thresholds: {
        'src/modules/rating/elo.service.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/modules/rating/categories.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/modules/bookings/slot-rules.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/shared/utils/timezone.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/modules/pricing/pricing.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        'src/modules/admin/admin.schemas.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
