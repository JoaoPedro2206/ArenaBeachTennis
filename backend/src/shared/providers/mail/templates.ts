import type { MailMessage } from './Mailer';

const BRAND = '#0890c0'; // azul das ondas do logo

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

interface LayoutInput {
  title: string;
  greeting: string;
  paragraphs: string[];
  cta: { label: string; url: string };
  footnote: string;
}

function layout({ title, greeting, paragraphs, cta, footnote }: LayoutInput): { text: string; html: string } {
  const text = [
    greeting,
    '',
    ...paragraphs,
    '',
    `${cta.label}: ${cta.url}`,
    '',
    footnote,
    '',
    '— Equipe Arena Beach',
  ].join('\n');

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f7f3ea;font-family:Arial,Helvetica,sans-serif;color:#1f2a30">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:${BRAND};padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold">🏖️ Arena Beach</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(greeting)}</p>
${paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(p)}</p>`).join('\n')}
<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:${BRAND};color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:999px;display:inline-block">${escapeHtml(cta.label)}</a></p>
<p style="margin:0 0 12px;font-size:13px;color:#5b6a72;line-height:1.5">Se o botão não funcionar, copie e cole este link no navegador:<br><a href="${escapeHtml(cta.url)}" style="color:${BRAND};word-break:break-all">${escapeHtml(cta.url)}</a></p>
<p style="margin:16px 0 0;font-size:13px;color:#5b6a72;line-height:1.5">${escapeHtml(footnote)}</p>
</td></tr></table></td></tr></table></body></html>`;

  return { text, html };
}

export function passwordResetEmail(input: { to: string; name: string; url: string; expiresInMinutes: number }): MailMessage {
  const subject = 'Redefinir sua senha — Arena Beach';
  return {
    to: input.to,
    subject,
    ...layout({
      title: 'Redefinir senha',
      greeting: `Olá, ${input.name.split(' ')[0]}!`,
      paragraphs: [
        'Recebemos um pedido para redefinir a senha da sua conta.',
        `O link abaixo vale por ${input.expiresInMinutes} minutos e só pode ser usado uma vez.`,
      ],
      cta: { label: 'Criar nova senha', url: input.url },
      footnote: 'Se você não fez este pedido, ignore este e-mail: sua senha continua a mesma.',
    }),
  };
}

export function emailVerificationEmail(input: { to: string; name: string; url: string; expiresInHours: number }): MailMessage {
  const subject = 'Confirme seu e-mail — Arena Beach';
  return {
    to: input.to,
    subject,
    ...layout({
      title: 'Confirme seu e-mail',
      greeting: `Bem-vindo(a), ${input.name.split(' ')[0]}!`,
      paragraphs: [
        'Falta só um passo: confirme que este e-mail é seu para poder reservar quadras e pagar.',
        `O link abaixo vale por ${input.expiresInHours} horas.`,
      ],
      cta: { label: 'Confirmar e-mail', url: input.url },
      footnote: 'Se você não criou uma conta na Arena Beach, ignore este e-mail.',
    }),
  };
}
