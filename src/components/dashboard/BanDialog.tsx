import { useState } from "react";
import { banCustomer } from "@/lib/api";
import type { DbCustomer } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldBan } from "lucide-react";

interface Props {
  customer: DbCustomer | { id?: string; customer_name: string; customer_phone: string; restaurant_id: string };
  open: boolean;
  onClose: () => void;
  onBanned: () => void;
  restaurantId: string;
}

export const BanDialog = ({ customer, open, onClose, onBanned, restaurantId }: Props) => {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("permanent");
  const [submitting, setSubmitting] = useState(false);

  const handleBan = async () => {
    if (!("id" in customer) || !customer.id) return;
    setSubmitting(true);
    try {
      let expiresAt: string | null = null;
      if (duration === "7d") {
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (duration === "30d") {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      }
      await banCustomer(customer.id, reason, expiresAt);
      toast.success(`${customer.customer_name || customer.customer_phone} a ete banni`);
      onBanned();
      onClose();
    } catch {
      toast.error("Erreur lors du bannissement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldBan className="h-5 w-5 text-destructive" />
            Bannir un client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-secondary/50 rounded-xl">
            <p className="text-sm font-medium text-foreground">{customer.customer_name || "Client inconnu"}</p>
            <p className="text-xs text-muted-foreground">{customer.customer_phone}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Raison (optionnel)</label>
            <Textarea
              placeholder="Commande non recuperee, comportement inapproprie..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-xl resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Duree</label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 jours</SelectItem>
                <SelectItem value="30d">30 jours</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleBan}
            disabled={submitting}
            className="rounded-xl"
          >
            {submitting ? "..." : "Confirmer le ban"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
