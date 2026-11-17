import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/shared/database/prisma';
import { assertTestDatabase } from './global-setup';

assertTestDatabase(process.env.DATABASE_URL);

let tables: string[] | null = null;

/** Banco limpo antes de cada teste (mantém só o histórico de migrations) */
beforeEach(async () => {
  tables ??= (
    await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  ).map((t) => `"public"."${t.tablename}"`);
  if (tables.length > 0) await prisma.$executeRawUnsafe(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
