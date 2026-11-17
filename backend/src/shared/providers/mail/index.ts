import { env } from '../../../config/env';
import { ConsoleMailer } from './ConsoleMailer';
import { ResendMailer } from './ResendMailer';
import type { Mailer } from './Mailer';

export type { Mailer, MailMessage } from './Mailer';

/** Escolhido por MAIL_PROVIDER: "console" (dev) ou "resend" (produção). */
export function createMailer(): Mailer {
  if (env.MAIL_PROVIDER === 'resend') return new ResendMailer(env.RESEND_API_KEY!, env.MAIL_FROM);
  return new ConsoleMailer();
}

export const mailer: Mailer = createMailer();
