import { isEmbeddedDemo } from '@/lib/embedded-demo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOrders, fetchDemoOrders, subscribeToOrders } from '@/lib/api';
import { readDemoOrders, storeDemoOrders } from '@/lib/demo-order-store';
import { isLocalDemoOrder } from '@/lib/demo-order';
import type { DbOrder } from '@/types/database';

type Options = { isDemo?: boolean; onNewOrder?: (order: DbOrder) => void };
type Session = { restaurantId: string | null; isDemo: boolean; fetching: boolean; overlay: Map<string, DbOrder | null>; controller: AbortController };

// Kitchen and caisse use the same recovery rules. Realtime is the fast path;
// a visible-screen snapshot catches missed messages without loading the archive.
export function useRestaurantOrders(restaurantId: string | null, { isDemo = false, onNewOrder }: Options = {}) {
  const [orders, publish] = useState<DbOrder[]>([]);
  const [notification, setNotification] = useState<{ order: DbOrder; receivedAt: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnected, setDisconnected] = useState(false);
  const ordersRef = useRef<DbOrder[]>([]);
  const callbackRef = useRef(onNewOrder);
  callbackRef.current = onNewOrder;
  const demoOverlay = useRef(new Map<string, DbOrder>());
  const sessionRef = useRef<Session | null>(null);

  const setOrders = useCallback((update: React.SetStateAction<DbOrder[]>) => {
    const previous = ordersRef.current;
    const next = typeof update === 'function' ? update(previous) : update;
    if (isDemo) {
      demoOverlay.current.clear();
      for (const order of next) if (isLocalDemoOrder(order)) demoOverlay.current.set(order.id, order);
      if (sessionRef.current?.restaurantId) storeDemoOrders(sessionRef.current.restaurantId, next);
    }
    const session = sessionRef.current;
    if (session?.fetching) {
      const previousById = new Map(previous.map(order => [order.id, order]));
      for (const order of next) {
        if (order !== previousById.get(order.id)) session.overlay.set(order.id, order);
        previousById.delete(order.id);
      }
      for (const id of previousById.keys()) session.overlay.set(id, null);
    }
    ordersRef.current = next;
    publish(next);
  }, [isDemo]);

  useEffect(() => {
    let disposed = false;
    const seen = new Set<string>();
    const session: Session = { restaurantId, isDemo, fetching: false, overlay: new Map(), controller: new AbortController() };
    sessionRef.current = session;
    const restored=isDemo && restaurantId ? readDemoOrders(restaurantId) : [];
    demoOverlay.current=new Map(restored.map(order=>[order.id,order]));
    ordersRef.current = restored;
    publish(restored);
    setLoading(true);
    setDisconnected(false);
    setNotification(null);
    if (!restaurantId) {
      setLoading(false);
      return () => { if (sessionRef.current === session) sessionRef.current = null; };
    }

    const announce = (order: DbOrder) => {
      const unseen = !seen.has(order.id);
      seen.add(order.id);
      if (unseen && order.status === 'new') {
        setNotification({ order, receivedAt: Date.now() });
        callbackRef.current?.(order);
      }
    };
    const load = async () => {
      if (disposed || session.fetching) return;
      session.fetching = true;
      session.overlay.clear();
      try {
        const data = isDemo ? await fetchDemoOrders(restaurantId) : await fetchOrders(restaurantId, { operational: true, signal: session.controller.signal });
        if (disposed) return;
        const snapshot = new Map(data.filter(order => order.restaurant_id === restaurantId).map(order => [order.id, order]));
        // Events/local confirmed changes received after this request began win
        // over the older HTTP snapshot, including inserts absent from that snapshot.
        for (const [id, order] of session.overlay) {
          if (order) snapshot.set(id, order); else snapshot.delete(id);
        }
        if (isDemo) for (const [id, order] of demoOverlay.current) snapshot.set(id, order);
        const next = [...snapshot.values()].map(order => {
          if (!isDemo || order.estimated_ready_at) return order;
          const local = ordersRef.current.find(previous => previous.id === order.id);
          return local?.estimated_ready_at ? { ...order, estimated_ready_at: local.estimated_ready_at } : order;
        });
        // One alert per recovered batch, including pending orders at startup.
        // Reopening the app must not silently hide orders received while closed.
        const pendingOrder = next.find(order => order.status === 'new' && !seen.has(order.id) && !isLocalDemoOrder(order));
        if (pendingOrder) announce(pendingOrder);
        for (const order of next) seen.add(order.id);
        ordersRef.current = next;
        publish(next);
        setDisconnected(false);
      } catch {
        if (!disposed) setDisconnected(true);
      } finally {
        session.fetching = false;
        if (!disposed) setLoading(false);
      }
    };
    const resume = () => { if (!document.hidden) void load(); };
    const offline = () => { if (!disposed && !isEmbeddedDemo(restaurantId)) setDisconnected(true); };
    const receive = (order: DbOrder) => {
      if (disposed || order.restaurant_id !== restaurantId) return;
      announce(order);
      setOrders(previous => [order, ...previous.filter(existing => existing.id !== order.id)]);
    };
    const onStatus = (status: string) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') void load();
      else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setDisconnected(true);
    };
    const unsubscribe = isDemo ? () => {} : subscribeToOrders(restaurantId, receive, onStatus);
    void load();
    const interval = setInterval(resume, isDemo ? 5000 : 30000);
    window.addEventListener('online', resume);
    window.addEventListener('offline', offline);
    window.addEventListener('commandeici:resume', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      disposed = true;
      session.controller.abort();
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', offline);
      window.removeEventListener('commandeici:resume', resume);
      document.removeEventListener('visibilitychange', resume);
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [restaurantId, isDemo, setOrders]);

  const receiveDemoOrder = useCallback((order: DbOrder) => {
    if (!isDemo || !restaurantId || sessionRef.current?.restaurantId !== restaurantId || !sessionRef.current?.isDemo || order.restaurant_id !== restaurantId || !isLocalDemoOrder(order) || demoOverlay.current.has(order.id)) return;
    setOrders(previous => [order, ...previous]);
    setNotification({ order, receivedAt: Date.now() });
    callbackRef.current?.(order);
  }, [isDemo, restaurantId, setOrders]);

  return { orders, setOrders, loading, disconnected, notification, receiveDemoOrder };
}
