import { createContext, useContext } from 'react';
import { useRestaurantOrders } from '@/hooks/useRestaurantOrders';

export const RestaurantOrdersContext = createContext<ReturnType<typeof useRestaurantOrders> | null>(null);

export function useRestaurantOrderFeed() {
  const feed = useContext(RestaurantOrdersContext);
  if (!feed) throw new Error('Merchant order screens require RestaurantOrdersContext');
  return feed;
}
