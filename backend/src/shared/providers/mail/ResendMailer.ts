import type { Mailer, MailMessage } from './Mailer';

/** Envio via API do Resend (https://resend.com) — sem dependência extra, só fetch. */
export class ResendMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send({ to, subject, text, html }: MailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // Não loga o corpo da requisição (tem o link com o token)
      throw new Error(`Resend respondeu ${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
  }
}
