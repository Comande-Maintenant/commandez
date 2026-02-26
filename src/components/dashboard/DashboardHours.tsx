import { useState } from "react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Power } from "lucide-react";

interface DaySchedule {
  day: string;
  enabled: boolean;
  open: string;
  close: string;
}

const initialSchedule: DaySchedule[] = [
  { day: "Lundi", enabled: true, open: "11:00", close: "23:00" },
  { day: "Mardi", enabled: true, open: "11:00", close: "23:00" },
  { day: "Mercredi", enabled: true, open: "11:00", close: "23:00" },
  { day: "Jeudi", enabled: true, open: "11:00", close: "23:00" },
  { day: "Vendredi", enabled: true, open: "11:00", close: "00:00" },
  { day: "Samedi", enabled: true, open: "11:00", close: "00:00" },
  { day: "Dimanche", enabled: false, open: "12:00", close: "22:00" },
];

export const DashboardHours = () => {
  const [schedule, setSchedule] = useState<DaySchedule[]>(initialSchedule);
  const [isAcceptingOrders, setIsAcceptingOrders] = useState(true);

  const update = (index: number, field: keyof DaySchedule, value: string | boolean) => {
    setSchedule((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  return (
    <div className="max-w-xl">
      {/* Accept orders toggle */}
      <div className="bg-card rounded-2xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isAcceptingOrders ? "bg-[hsl(var(--success))]/10" : "bg-muted"}`}>
              <Power className={`h-5 w-5 ${isAcceptingOrders ? "text-[hsl(var(--success))]" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isAcceptingOrders ? "Prise de commandes activée" : "Prise de commandes désactivée"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAcceptingOrders
                  ? "Les clients peuvent commander en ligne"
                  : "Les commandes en ligne sont suspendues"}
              </p>
            </div>
          </div>
          <Switch checked={isAcceptingOrders} onCheckedChange={setIsAcceptingOrders} />
        </div>
      </div>

      {/* Weekly schedule */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Horaires d'ouverture</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Définissez vos créneaux par jour</p>
        </div>

        <div className="divide-y divide-border">
          {schedule.map((day, i) => (
            <motion.div
              key={day.day}
              className="flex items-center gap-4 px-5 py-3.5"
              initial={false}
              animate={{ opacity: day.enabled ? 1 : 0.5 }}
            >
              <Switch
                checked={day.enabled}
                onCheckedChange={(v) => update(i, "enabled", v)}
                className="scale-75 shrink-0"
              />
              <span className="text-sm font-medium text-foreground w-24">{day.day}</span>

              {day.enabled ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={day.open}
                    onChange={(e) => update(i, "open", e.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">à</span>
                  <Input
                    type="time"
                    value={day.close}
                    onChange={(e) => update(i, "close", e.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Fermé</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <Button className="w-full rounded-xl mt-4">
        Enregistrer les horaires
      </Button>
    </div>
  );
};
