/** Formatação usada no painel do dono da arena */

const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** 1250000 (centavos) -> "R$ 12,5 mil" — para eixos e cartões estreitos */
export function formatPriceCompact(cents: number): string {
  return cents === 0 ? 'R$ 0' : compactCurrency.format(cents / 100);
}

/** "2026-11" -> "novembro de 2026" */
export function formatMonth(month: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-15T12:00:00Z`),
  );
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** 33.3 -> "33,3%" (sem casa decimal quando é inteiro) */
export function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** 7 -> "7h" / 18 -> "18h" */
export const formatHour = (hour: number) => `${hour}h`;

/** Minutos desde a meia-noite -> "HH:mm" (1440 -> "24:00") */
export function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Telefone só com dígitos -> link de WhatsApp (assume Brasil se vier sem DDI) */
export function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}
