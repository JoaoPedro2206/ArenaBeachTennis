export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Contrato de envio de e-mail. Trocar de provedor = nova implementação. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
