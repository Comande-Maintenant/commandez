import type { ReactNode } from 'react';

interface Props {
  restaurantId: string;
  children: ReactNode;
}

// Merchant access is currently free. Authentication and restaurant ownership
// remain enforced by AdminPage and database policies, independently of billing.
export function SubscriptionGate({ children }: Props) {
  return <>{children}</>;
}
