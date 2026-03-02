export function getPaymentPrefix(method: string | null | undefined): string {
  switch (method) {
    case 'cash': return 'ESP';
    case 'ticket_restaurant': return 'TR';
    case 'card':
    default: return 'CB';
  }
}

export function formatDisplayNumber(order: {
  daily_number?: number | null;
  payment_method?: string | null;
  order_number: number;
}): string {
  if (!order.daily_number) return `#${order.order_number}`;
  return `${getPaymentPrefix(order.payment_method)}-${order.daily_number}`;
}
