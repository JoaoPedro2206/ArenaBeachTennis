import { PrismaClient } from '@prisma/client';
import { env, isProduction } from '../../config/env';

/**
 * Instância única do PrismaClient (evita múltiplos pools de conexão
 * durante o hot-reload do tsx em desenvolvimento).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Nos testes, erros esperados (conflitos, deadlocks provocados) não poluem a saída
    log: isProduction ? ['error'] : env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
