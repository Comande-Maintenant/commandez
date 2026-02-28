export interface VisitorPresencePayload {
  visitor_id: string;
  visitor_name?: string;
  cart_count: number;
  cart_total: number;
  cart_items: string[];
  page_section: string;
  arrived_at: string;
  last_active: string;
  device: "mobile" | "desktop";
  source: "qr" | "direct" | "link";
}

export interface LiveVisitor extends VisitorPresencePayload {
  presence_ref: string;
  activity: "active" | "idle" | "inactive";
}

export type VisitorAlert =
  | { type: "va_commander"; visitor: LiveVisitor }
  | { type: "grosse_commande"; visitor: LiveVisitor; total: number }
  | { type: "hesite"; visitor: LiveVisitor }
  | { type: "rush"; count: number };
