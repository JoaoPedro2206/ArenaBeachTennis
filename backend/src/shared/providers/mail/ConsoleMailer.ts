import type { Mailer, MailMessage } from './Mailer';

/** Desenvolvimento: em vez de enviar, imprime o e-mail (com o link) no terminal. */
export class ConsoleMailer implements Mailer {
  async send({ to, subject, text }: MailMessage): Promise<void> {
    console.log(`\n📧 [ConsoleMailer] Para: ${to}\n   Assunto: ${subject}\n${text}\n`);
  }
}
