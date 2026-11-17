import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres!!',
      APP_URL: 'http://app.test',
      MAIL_PROVIDER: 'console',
    },
  },
});
