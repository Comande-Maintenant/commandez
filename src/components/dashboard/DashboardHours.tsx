import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Power, Loader2 } from "lucide-react";
import { fetchRestaurantHours, upsertRestaurantHours, updateRestaurant } from "@/lib/api";
import type { DbRestaurant } from "@/types/database";

interface Props {
  restaurant: DbRestaurant;
}

const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

interface DaySchedule {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

export const DashboardHours = ({ restaurant }: Props) => {
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [isAcceptingOrders, setIsAcceptingOrders] = useState(restaurant.is_accepting_orders);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRestaurantHours(restaurant.id).then((data) => {
      if (data.length > 0) {
        setSchedule(data.map((d: any) => ({ day_of_week: d.day_of_week, is_open: d.is_open, open_time: d.open_time, close_time: d.close_time })));
      } else {
        // Default schedule
        setSchedule(
          [1, 2, 3, 4, 5, 6, 0].map((d) => ({
            day_of_week: d,
            is_open: d !== 0,
            open_time: "11:00",
            close_time: "23:00",
          }))
        );
      }
      setLoading(false);
    });
  }, [restaurant.id]);

  const update = (dayOfWeek: number, field: keyof DaySchedule, value: string | boolean) => {
    setSchedule((prev) =>
      prev.map((s) => (s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s))
    );
  };

  const handleToggleOrders = async (val: boolean) => {
    setIsAcceptingOrders(val);
    await updateRestaurant(restaurant.id, { is_accepting_orders: val } as any);
  };

  const handleSave = async () => {
    setSaving(true);
    await upsertRestaurantHours(restaurant.id, schedule);
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  // Sort: Mon-Sun
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((d) => schedule.find((s) => s.day_of_week === d)!).filter(Boolean);

  return (
    <div className="max-w-xl">
      <div className="bg-card rounded-2xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isAcceptingOrders ? "bg-[hsl(var(--success))]/10" : "bg-muted"}`}>
              <Power className={`h-5 w-5 ${isAcceptingOrders ? "text-[hsl(var(--success))]" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{isAcceptingOrders ? "Prise de commandes activée" : "Prise de commandes désactivée"}</p>
              <p className="text-xs text-muted-foreground">{isAcceptingOrders ? "Les clients peuvent commander en ligne" : "Les commandes en ligne sont suspendues"}</p>
            </div>
          </div>
          <Switch checked={isAcceptingOrders} onCheckedChange={handleToggleOrders} />
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Horaires d'ouverture</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Définissez vos créneaux par jour</p>
        </div>
        <div className="divide-y divide-border">
          {ordered.map((day) => (
            <motion.div key={day.day_of_week} className="flex items-center gap-4 px-5 py-3.5" initial={false} animate={{ opacity: day.is_open ? 1 : 0.5 }}>
              <Switch checked={day.is_open} onCheckedChange={(v) => update(day.day_of_week, "is_open", v)} className="scale-75 shrink-0" />
              <span className="text-sm font-medium text-foreground w-24">{dayNames[day.day_of_week]}</span>
              {day.is_open ? (
                <div className="flex items-center gap-2">
                  <Input type="time" value={day.open_time} onChange={(e) => update(day.day_of_week, "open_time", e.target.value)} className="w-28 h-8 text-sm" />
                  <span className="text-xs text-muted-foreground">à</span>
                  <Input type="time" value={day.close_time} onChange={(e) => update(day.day_of_week, "close_time", e.target.value)} className="w-28 h-8 text-sm" />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Fermé</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl mt-4">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer les horaires"}
      </Button>
    </div>
  );
};
