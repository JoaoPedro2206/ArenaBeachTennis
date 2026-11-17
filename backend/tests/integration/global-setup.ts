import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

/**
 * Roda uma vez antes da suíte de integração: aplica as migrations no banco
 * de teste (inclui a EXCLUDE constraint de reservas, que mocks não reproduzem).
 */
export default function setup(project: TestProject): void {
  const url = project.config.env?.DATABASE_URL as string | undefined;
  assertTestDatabase(url);

  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
  } catch (error) {
    const output = (error as { stderr?: Buffer; stdout?: Buffer }).stderr?.toString() ?? String(error);
    throw new Error(
      `Não foi possível preparar o banco de teste (${redact(url!)}).\n` +
        'Suba-o com: npm run test:db:up\n\n' +
        output,
    );
  }
}

/** Trava de segurança: a suíte apaga todas as tabelas, então só roda num banco "_test" */
export function assertTestDatabase(url: string | undefined): asserts url is string {
  if (!url || !/\/[^/?]*_test(\?|$)/.test(url)) {
    throw new Error(`DATABASE_URL de teste precisa apontar para um banco terminado em "_test" (recebido: ${redact(url ?? '')})`);
  }
}

function redact(url: string): string {
  return url.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@');
}
