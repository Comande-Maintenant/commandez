import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/context/CartContext";
import { getOrCreateVisitorId, detectDevice, detectSource, debounce } from "@/lib/visitorUtils";
import type { VisitorPresencePayload } from "@/types/visitor";

export function useVisitorTracking(restaurantId: string | null) {
  const { totalItems, subtotal, items } = useCart();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cartRef = useRef({ totalItems, subtotal, items });

  // Keep cart ref fresh without triggering re-subscription
  useEffect(() => {
    cartRef.current = { totalItems, subtotal, items };
  }, [totalItems, subtotal, items]);

  // Debounced track update for cart changes
  const debouncedTrackRef = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    if (!restaurantId) return;

    const visitorId = getOrCreateVisitorId();
    const arrivedAt = new Date().toISOString();
    const device = detectDevice();
    const source = detectSource();

    const channel = supabase.channel(`visitors-${restaurantId}`, {
      config: { presence: { key: visitorId } },
    });

    // Read customer name from localStorage
    let visitorName: string | undefined;
    try {
      const raw = localStorage.getItem("cm_customer");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.name) visitorName = saved.name;
      }
    } catch { /* ignore */ }

    const buildPayload = (): VisitorPresencePayload => ({
      visitor_id: visitorId,
      visitor_name: visitorName,
      cart_count: cartRef.current.totalItems,
      cart_total: cartRef.current.subtotal,
      cart_items: cartRef.current.items.slice(0, 5).map((i) => i.menuItem.name),
      page_section: "menu",
      arrived_at: arrivedAt,
      last_active: new Date().toISOString(),
      device,
      source,
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track(buildPayload());
      }
    });

    channelRef.current = channel;

    // Debounced cart tracker
    const debouncedTrack = debounce(() => {
      if (channelRef.current) {
        channelRef.current.track(buildPayload());
      }
    }, 1000);
    debouncedTrackRef.current = debouncedTrack;

    return () => {
      debouncedTrack.cancel();
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [restaurantId]);

  // React to cart changes with debounce
  useEffect(() => {
    if (debouncedTrackRef.current) {
      debouncedTrackRef.current();
    }
  }, [totalItems, subtotal]);

  const updateSection = useCallback((section: string) => {
    if (!channelRef.current) return;
    const visitorId = getOrCreateVisitorId();
    const { totalItems: count, subtotal: total, items: cartItems } = cartRef.current;
    channelRef.current.track({
      visitor_id: visitorId,
      cart_count: count,
      cart_total: total,
      cart_items: cartItems.slice(0, 5).map((i) => i.menuItem.name),
      page_section: section,
      arrived_at: localStorage.getItem("cm_arrived_at") || new Date().toISOString(),
      last_active: new Date().toISOString(),
      device: detectDevice(),
      source: detectSource(),
    } satisfies VisitorPresencePayload);
  }, []);

  return { updateSection };
}
