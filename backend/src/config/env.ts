import 'dotenv/config';
import { z } from 'zod';

/**
 * Validação das variáveis de ambiente na inicialização (fail-fast).
 * Se algo estiver faltando/inválido, a aplicação nem sobe.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim())),
  /**
   * Quantos proxies reversos (Nginx, load balancer) ficam na frente da API.
   * 0 = acesso direto. Em produção atrás de proxy, sem isso TODOS os usuários
   * chegam com o mesmo IP e o limite de tentativas de login bloqueia todo mundo.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /** A cada quantos ms o worker cancela reservas não pagas no prazo */
  BOOKING_EXPIRATION_SWEEP_MS: z.coerce.number().int().min(1000).default(30_000),

  // ---- E-mail (recuperação de senha e verificação) ----
  /** URL pública do frontend — base dos links enviados por e-mail */
  APP_URL: z
    .string()
    .url()
    .default('http://localhost:5173')
    .transform((url) => url.replace(/\/+$/, '')),
  /** "console" imprime o e-mail no terminal (dev); "resend" envia de verdade */
  MAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  MAIL_FROM: z.string().min(3).default('Arena Beach <nao-responda@arenabeach.local>'),
  RESEND_API_KEY: z.string().min(1).optional(),
});

const envWithRules = envSchema.superRefine((value, ctx) => {
  if (value.MAIL_PROVIDER === 'resend' && !value.RESEND_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'Obrigatória quando MAIL_PROVIDER=resend' });
  }
  if (value.NODE_ENV === 'production' && value.MAIL_PROVIDER === 'console') {
    ctx.addIssue({ code: 'custom', path: ['MAIL_PROVIDER'], message: 'Em produção use um provedor real (resend)' });
  }
});

const parsed = envWithRules.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
