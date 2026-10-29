export type OrderPaymentOption = 'card' | 'cash';

const ORDER_PAYMENT_OPTIONS: OrderPaymentOption[] = ['card', 'cash'];

// Settings and legacy rows store several spellings for the same in-person payment.
const PAYMENT_ALIASES: Record<string, OrderPaymentOption> = {
  card: 'card',
  CB: 'card',
  'Carte bancaire': 'card',
  apple_google_pay: 'card',
  cash: 'cash',
  Especes: 'cash',
  'Espèces': 'cash',
};

// Online orders only offer card or cash; a commerce without a usable setting keeps both.
export function orderPaymentOptions(accepted: string[] | null | undefined): OrderPaymentOption[] {
  const normalized = new Set((accepted ?? []).map((method) => PAYMENT_ALIASES[method]).filter(Boolean));
  const offered = ORDER_PAYMENT_OPTIONS.filter((option) => normalized.has(option));
  return offered.length > 0 ? offered : ORDER_PAYMENT_OPTIONS;
}

export function allowedPaymentMethod(current: string, options: OrderPaymentOption[]): OrderPaymentOption {
  return options.includes(current as OrderPaymentOption) ? (current as OrderPaymentOption) : options[0];
}
