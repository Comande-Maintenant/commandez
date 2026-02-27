import { useState, useEffect } from "react";
import {
  Power,
  Truck,
  CreditCard,
  Clock,
  Bell,
  User,
  LogOut,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { updateRestaurant, fetchRestaurantHours, upsertRestaurantHours } from "@/lib/api";
import type { DbRestaurant } from "@/types/database";
import { ScheduleEditor, type ScheduleDay } from "./ScheduleEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  restaurant: DbRestaurant;
}

const availabilityModes = [
  { id: "manual", label: "Manuel", desc: "Activez/desactivez manuellement" },
  { id: "auto", label: "Automatique", desc: "Selon vos horaires configures" },
  { id: "always", label: "Toujours ouvert", desc: "Accepte les commandes 24/7" },
];

const orderModeOptions = [
  { id: "on_site", label: "Sur place" },
  { id: "pickup", label: "A emporter" },
  { id: "delivery", label: "Livraison" },
];

const paymentOptions = [
  { id: "cash", label: "Especes" },
  { id: "card", label: "Carte bancaire" },
  { id: "ticket_restaurant", label: "Ticket restaurant" },
  { id: "apple_google_pay", label: "Apple Pay / Google Pay" },
];

const notificationSounds = [
  { id: "default", label: "Par defaut" },
  { id: "bip", label: "Bip" },
  { id: "bell", label: "Cloche" },
  { id: "ding", label: "Ding" },
];

const orderedDays = [1, 2, 3, 4, 5, 6, 0];

export const DashboardParametres = ({ restaurant }: Props) => {
  const [saving, setSaving] = useState(false);
  const [isAccepting, setIsAccepting] = useState(restaurant.is_accepting_orders);
  const [availabilityMode, setAvailabilityMode] = useState(restaurant.availability_mode || "manual");
  const [orderMode, setOrderMode] = useState(restaurant.order_mode || "pickup_delivery");
  const [deliveryFee, setDeliveryFee] = useState(String(restaurant.delivery_fee ?? 0));
  const [minimumOrder, setMinimumOrder] = useState(String(restaurant.minimum_order ?? 0));
  const [estimatedTime, setEstimatedTime] = useState(restaurant.estimated_time || "20-30 min");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(restaurant.payment_methods ?? []);
  const [prepTime, setPrepTime] = useState(restaurant.prep_time_config ?? { default_minutes: 20, per_item_minutes: 3, max_minutes: 90 });
  const [notificationSound, setNotificationSound] = useState(restaurant.notification_sound || "default");
  const [phoneNumber, setPhoneNumber] = useState(restaurant.restaurant_phone || "");
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  // Load schedule from restaurant_hours
  useEffect(() => {
    fetchRestaurantHours(restaurant.id).then((data) => {
      if (data.length > 0) {
        setSchedule(
          data.map((d: any) => ({
            day: d.day_of_week,
            enabled: d.is_open,
            slots: [{ open: d.open_time || "11:00", close: d.close_time || "23:00" }],
          }))
        );
      } else {
        setSchedule(
          orderedDays.map((d) => ({
            day: d,
            enabled: d !== 0,
            slots: [{ open: "11:00", close: "23:00" }],
          }))
        );
      }
      setLoadingSchedule(false);
    });
  }, [restaurant.id]);

  const togglePayment = (id: string) => {
    setPaymentMethods((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selectedOrderModes = orderMode.split("_").filter(Boolean);
  const toggleOrderMode = (id: string) => {
    const modes = new Set(selectedOrderModes);
    if (modes.has(id)) {
      modes.delete(id);
    } else {
      modes.add(id);
    }
    setOrderMode(Array.from(modes).join("_") || "pickup");
  };

  const handleToggleAccepting = async (val: boolean) => {
    setIsAccepting(val);
    await updateRestaurant(restaurant.id, { is_accepting_orders: val } as any);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save restaurant settings
      await updateRestaurant(restaurant.id, {
        availability_mode: availabilityMode,
        order_mode: orderMode,
        delivery_fee: parseFloat(deliveryFee) || 0,
        minimum_order: parseFloat(minimumOrder) || 0,
        estimated_time: estimatedTime,
        payment_methods: paymentMethods,
        prep_time_config: prepTime,
        notification_sound: notificationSound,
        restaurant_phone: phoneNumber,
      } as any);

      // Save schedule
      const hours = schedule.map((s) => ({
        day_of_week: s.day,
        is_open: s.enabled,
        open_time: s.slots[0]?.open || "11:00",
        close_time: s.slots[s.slots.length - 1]?.close || "23:00",
      }));
      await upsertRestaurantHours(restaurant.id, hours);

      toast.success("Parametres enregistres");
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleDeleteRestaurant = async () => {
    if (!confirm("Etes-vous sur de vouloir supprimer votre restaurant ? Cette action est irreversible.")) return;
    if (!confirm("Derniere confirmation : toutes les donnees seront perdues.")) return;
    try {
      const { error } = await supabase.from("restaurants").delete().eq("id", restaurant.id);
      if (error) throw error;
      toast.success("Restaurant supprime");
      window.location.href = "/";
    } catch (e) {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      {/* Availability */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Power className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Disponibilite</h3>
        </div>

        <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Accepter les commandes</p>
            <p className="text-xs text-muted-foreground">{isAccepting ? "Les clients peuvent commander" : "Commandes suspendues"}</p>
          </div>
          <Switch checked={isAccepting} onCheckedChange={handleToggleAccepting} />
        </div>

        <div className="space-y-2">
          {availabilityModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setAvailabilityMode(mode.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border ${
                availabilityMode === mode.id ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/50"
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                availabilityMode === mode.id ? "border-foreground" : "border-muted-foreground"
              }`}>
                {availabilityMode === mode.id && <div className="w-2 h-2 rounded-full bg-foreground" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{mode.label}</p>
                <p className="text-xs text-muted-foreground">{mode.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {availabilityMode === "auto" && !loadingSchedule && (
          <div className="mt-4 pt-4 border-t border-border">
            <ScheduleEditor schedule={schedule} onChange={setSchedule} />
          </div>
        )}
      </section>

      {/* Order modes */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Modes de commande</h3>
        </div>

        <div className="space-y-2 mb-4">
          {orderModeOptions.map((opt) => (
            <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={selectedOrderModes.includes(opt.id)}
                onChange={() => toggleOrderMode(opt.id)}
                className="rounded border-muted-foreground"
              />
              <span className="text-sm text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>

        {selectedOrderModes.includes("delivery") && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div>
              <label className="text-sm text-muted-foreground">Frais de livraison (€)</label>
              <Input
                type="number"
                step="0.50"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Commande minimum (€)</label>
              <Input
                type="number"
                step="1"
                value={minimumOrder}
                onChange={(e) => setMinimumOrder(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Temps estime</label>
              <Input
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
                placeholder="20-30 min"
                className="mt-1"
              />
            </div>
          </div>
        )}
      </section>

      {/* Payment methods */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Moyens de paiement</h3>
        </div>

        <div className="space-y-2">
          {paymentOptions.map((opt) => (
            <label key={opt.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={paymentMethods.includes(opt.id)}
                onChange={() => togglePayment(opt.id)}
                className="rounded border-muted-foreground"
              />
              <span className="text-sm text-foreground">{opt.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Prep time */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Temps de preparation</h3>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-muted-foreground">Temps par defaut</label>
              <span className="text-sm font-medium text-foreground">{prepTime.default_minutes} min</span>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={5}
              value={prepTime.default_minutes}
              onChange={(e) => setPrepTime({ ...prepTime, default_minutes: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-muted-foreground">Temps par item supplementaire</label>
              <span className="text-sm font-medium text-foreground">{prepTime.per_item_minutes} min</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={prepTime.per_item_minutes}
              onChange={(e) => setPrepTime({ ...prepTime, per_item_minutes: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Temps max (min)</label>
            <Input
              type="number"
              value={prepTime.max_minutes}
              onChange={(e) => setPrepTime({ ...prepTime, max_minutes: parseInt(e.target.value) || 90 })}
              className="mt-1"
            />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Notifications</h3>
        </div>

        <div>
          <label className="text-sm text-muted-foreground">Son de notification</label>
          <select
            value={notificationSound}
            onChange={(e) => setNotificationSound(e.target.value)}
            className="mt-1 w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            {notificationSounds.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Save button */}
      <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl h-12">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer tous les parametres"}
      </Button>

      {/* Account */}
      <section className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-foreground" />
          <h3 className="text-base font-semibold text-foreground">Mon compte</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground">Telephone</label>
            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="mt-1" />
          </div>

          <Button variant="outline" className="w-full rounded-xl gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />Se deconnecter
          </Button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="bg-card rounded-2xl border border-destructive/30 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="text-base font-semibold text-destructive">Zone de danger</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          La suppression est definitive. Toutes les donnees (menu, commandes, images) seront perdues.
        </p>
        <Button variant="destructive" className="w-full rounded-xl gap-2" onClick={handleDeleteRestaurant}>
          <Trash2 className="h-4 w-4" />Supprimer mon restaurant
        </Button>
      </section>
    </div>
  );
};
