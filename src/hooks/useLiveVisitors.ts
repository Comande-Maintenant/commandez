import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { classifyActivity } from "@/lib/visitorUtils";
import type { LiveVisitor, VisitorAlert, VisitorPresencePayload } from "@/types/visitor";

export function useLiveVisitors(restaurantId: string | null) {
  const [visitors, setVisitors] = useState<LiveVisitor[]>([]);
  const [alerts, setAlerts] = useState<VisitorAlert[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const syncState = useCallback((channel: ReturnType<typeof supabase.channel>) => {
    const state = channel.presenceState<VisitorPresencePayload>();
    const liveVisitors: LiveVisitor[] = [];

    for (const [key, presences] of Object.entries(state)) {
      for (const p of presences) {
        liveVisitors.push({
          ...(p as unknown as VisitorPresencePayload),
          presence_ref: (p as any).presence_ref || key,
          activity: classifyActivity((p as unknown as VisitorPresencePayload).last_active),
        });
      }
    }

    // Sort: active first, then idle, then inactive
    const order = { active: 0, idle: 1, inactive: 2 };
    liveVisitors.sort((a, b) => order[a.activity] - order[b.activity]);

    setVisitors(liveVisitors);

    // Calculate alerts
    const newAlerts: VisitorAlert[] = [];
    if (liveVisitors.length >= 3) {
      newAlerts.push({ type: "rush", count: liveVisitors.length });
    }
    for (const v of liveVisitors) {
      if (v.page_section === "order_form") {
        newAlerts.push({ type: "va_commander", visitor: v });
      }
      if (v.cart_total > 20) {
        newAlerts.push({ type: "grosse_commande", visitor: v, total: v.cart_total });
      }
      if (v.activity === "inactive" && v.cart_count > 0) {
        newAlerts.push({ type: "hesite", visitor: v });
      }
    }
    setAlerts(newAlerts);
  }, []);

  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase.channel(`visitors-${restaurantId}`);
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => syncState(channel))
      .subscribe();

    // Re-classify activity periodically
    const interval = setInterval(() => {
      if (channelRef.current) syncState(channelRef.current);
    }, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [restaurantId, syncState]);

  return { visitors, alerts, visitorCount: visitors.length };
}

export function useLiveOrderCounts(restaurantId: string | null) {
  const [newCount, setNewCount] = useState(0);
  const [preparingCount, setPreparingCount] = useState(0);

  const loadCounts = useCallback(async () => {
    if (!restaurantId) return;
    const { count: nc } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "new");
    const { count: pc } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "preparing");
    setNewCount(nc ?? 0);
    setPreparingCount(pc ?? 0);
  }, [restaurantId]);

  useEffect(() => {
    loadCounts();
    if (!restaurantId) return;

    const channel = supabase
      .channel(`order-counts-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => loadCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, loadCounts]);

  return { newCount, preparingCount };
}
