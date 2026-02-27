import { Plus, Copy, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface ScheduleSlot {
  open: string;
  close: string;
}

export interface ScheduleDay {
  day: number;
  enabled: boolean;
  slots: ScheduleSlot[];
}

const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const orderedDays = [1, 2, 3, 4, 5, 6, 0];

const defaultSchedule: ScheduleDay[] = orderedDays.map((d) => ({
  day: d,
  enabled: d !== 0,
  slots: [{ open: "11:00", close: "23:00" }],
}));

interface Props {
  schedule: ScheduleDay[];
  onChange: (schedule: ScheduleDay[]) => void;
}

export const ScheduleEditor = ({ schedule, onChange }: Props) => {
  const days = orderedDays.map(
    (d) => schedule.find((s) => s.day === d) ?? defaultSchedule.find((s) => s.day === d)!
  );

  const updateDay = (dayNum: number, updates: Partial<ScheduleDay>) => {
    onChange(
      schedule.map((s) => (s.day === dayNum ? { ...s, ...updates } : s))
    );
  };

  const updateSlot = (dayNum: number, slotIdx: number, field: keyof ScheduleSlot, value: string) => {
    const day = schedule.find((s) => s.day === dayNum);
    if (!day) return;
    const newSlots = day.slots.map((slot, i) =>
      i === slotIdx ? { ...slot, [field]: value } : slot
    );
    updateDay(dayNum, { slots: newSlots });
  };

  const addSlot = (dayNum: number) => {
    const day = schedule.find((s) => s.day === dayNum);
    if (!day) return;
    updateDay(dayNum, { slots: [...day.slots, { open: "14:00", close: "22:00" }] });
  };

  const removeSlot = (dayNum: number, slotIdx: number) => {
    const day = schedule.find((s) => s.day === dayNum);
    if (!day || day.slots.length <= 1) return;
    updateDay(dayNum, { slots: day.slots.filter((_, i) => i !== slotIdx) });
  };

  const copyToAll = () => {
    const monday = schedule.find((s) => s.day === 1);
    if (!monday) return;
    onChange(
      schedule.map((s) => ({
        ...s,
        enabled: monday.enabled,
        slots: [...monday.slots],
      }))
    );
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground">Horaires par jour</p>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={copyToAll}>
          <Copy className="h-3.5 w-3.5" />Copier lundi a tous
        </Button>
      </div>
      <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
        {days.map((day) => (
          <div key={day.day} className={`px-4 py-3 transition-opacity ${day.enabled ? "" : "opacity-50"}`}>
            <div className="flex items-center gap-3 mb-2">
              <Switch
                checked={day.enabled}
                onCheckedChange={(v) => updateDay(day.day, { enabled: v })}
                className="scale-75 shrink-0"
              />
              <span className="text-sm font-medium text-foreground w-24">{dayNames[day.day]}</span>
              {!day.enabled && <span className="text-sm text-muted-foreground">Ferme</span>}
            </div>
            {day.enabled && (
              <div className="ml-11 space-y-2">
                {day.slots.map((slot, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={slot.open}
                      onChange={(e) => updateSlot(day.day, si, "open", e.target.value)}
                      className="w-28 h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={slot.close}
                      onChange={(e) => updateSlot(day.day, si, "close", e.target.value)}
                      className="w-28 h-8 text-sm"
                    />
                    {day.slots.length > 1 && (
                      <button
                        onClick={() => removeSlot(day.day, si)}
                        className="p-1 rounded hover:bg-destructive/10 transition-colors"
                      >
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => addSlot(day.day)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" />Ajouter un creneau
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
