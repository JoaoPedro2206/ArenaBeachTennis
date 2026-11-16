/**
 * "quinta-feira, 12 de novembro" -> "Quinta-feira, 12 de novembro".
 * (A classe CSS `capitalize` não serve: ela gera "12 De Novembro".)
 */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 12000 -> "R$ 120,00" (o backend trabalha em centavos) */
export function formatPrice(cents: number): string {
  return currency.format(cents / 100);
}

/** Preço compacto para chips: 12000 -> "R$ 120" / 22550 -> "R$ 225,50" */
export function formatPriceShort(cents: number): string {
  return cents % 100 === 0 ? `R$ ${cents / 100}` : formatPrice(cents);
}
