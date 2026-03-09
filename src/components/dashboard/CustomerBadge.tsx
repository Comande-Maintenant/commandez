import { AlertTriangle, Star, ShieldBan, MessageSquare } from "lucide-react";
import type { DbCustomer } from "@/types/database";

interface Props {
  customer: DbCustomer | null;
  compact?: boolean;
}

export const CustomerBadge = ({ customer, compact }: Props) => {
  if (!customer) return null;

  return (
    <span className="inline-flex items-center gap-0.5 ms-1">
      {customer.is_banned && (
        <ShieldBan className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-red-500 flex-shrink-0`} />
      )}
      {customer.flagged && !customer.is_banned && (
        <AlertTriangle className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-red-500 flex-shrink-0`} />
      )}
      {customer.notes && !customer.flagged && !customer.is_banned && (
        <MessageSquare className={`${compact ? "h-2.5 w-2.5" : "h-3 w-3"} text-amber-500 flex-shrink-0`} />
      )}
      {customer.total_orders >= 10 && !customer.is_banned && (
        <Star className={`${compact ? "h-2.5 w-2.5" : "h-3 w-3"} text-amber-500 flex-shrink-0`} />
      )}
    </span>
  );
};
