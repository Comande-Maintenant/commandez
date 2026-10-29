export type OrderPaymentOption = 'card' | 'cash';

const ORDER_PAYMENT_OPTIONS: OrderPaymentOption[] = ['card', 'cash'];

// Online orders only offer card or cash; a commerce without a usable setting keeps both.
export function orderPaymentOptions(accepted: string[] | null | undefined): OrderPaymentOption[] {
  const offered = ORDER_PAYMENT_OPTIONS.filter((option) => accepted?.includes(option));
  return offered.length > 0 ? offered : ORDER_PAYMENT_OPTIONS;
}
