import { useState, useEffect, useMemo } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchRestaurantHours } from "@/lib/api";

interface ScheduleHour {
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

interface TimeSlotGroup {
  label: string;
  slots: string[]; // ISO strings
}

interface Props {
  restaurantId: string;
  estimatedMinutes?: number;
  value: string | null; // null = ASAP, ISO string = scheduled
  onChange: (value: string | null) => void;
  primaryColor?: string;
}

// Generate 15-min slot timestamps for a given day's open/close range
function generateSlots(date: Date, openTime: string, closeTime: string): Date[] {
  const slots: Date[] = [];
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);

  const start = new Date(date);
  start.setHours(oh, om, 0, 0);

  const end = new Date(date);
  // If close time is earlier than open (crosses midnight), add a day
  if (ch < oh || (ch === oh && cm <= om)) {
    end.setDate(end.getDate() + 1);
  }
  end.setHours(ch, cm, 0, 0);

  // Step by 15 min, stop 15 min before close (need time to prepare)
  const cursor = new Date(start);
  while (cursor.getTime() < end.getTime() - 15 * 60 * 1000) {
    slots.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 15);
  }
  return slots;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const PickupTimePicker = ({ restaurantId, estimatedMinutes = 15, value, onChange, primaryColor }: Props) => {
  const [mode, setMode] = useState<"asap" | "scheduled">(value ? "scheduled" : "asap");
  const [hours, setHours] = useState<ScheduleHour[]>([]);
  const [loading, setLoading] = useState(false);
  const accent = primaryColor || "#000000";

  useEffect(() => {
    if (mode !== "scheduled") return;
    setLoading(true);
    fetchRestaurantHours(restaurantId).then((data) => {
      setHours(data as ScheduleHour[]);
      setLoading(false);
    });
  }, [restaurantId, mode]);

  // Build available slot groups
  const slotGroups = useMemo((): TimeSlotGroup[] => {
    if (hours.length === 0) return [];

    const now = new Date();
    const minPickup = new Date(now.getTime() + 20 * 60 * 1000); // 20 min from now
    const groups: TimeSlotGroup[] = [];

    // Check today and tomorrow (up to 2 days ahead)
    for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dayOfWeek = targetDate.getDay();

      const daySchedule = hours.find((h) => h.day_of_week === dayOfWeek);
      if (!daySchedule?.is_open) continue;

      const allSlots = generateSlots(targetDate, daySchedule.open_time, daySchedule.close_time);

      // Filter: only slots >= minPickup
      const available = allSlots.filter((s) => s.getTime() >= minPickup.getTime());
      if (available.length === 0) continue;

      // Group by service window (morning/afternoon split at 15:00)
      const isToday = dayOffset === 0;
      const isTomorrow = dayOffset === 1;

      // Split into service periods
      const beforeAfternoon = available.filter((s) => s.getHours() < 15);
      const afternoon = available.filter((s) => s.getHours() >= 15);

      const dayLabel = isToday ? "Aujourd'hui" : isTomorrow ? "Demain" : "";

      if (beforeAfternoon.length > 0) {
        groups.push({
          label: `${dayLabel}${beforeAfternoon[0].getHours() < 12 ? " - midi" : ""}`,
          slots: beforeAfternoon.map((s) => s.toISOString()),
        });
      }
      if (afternoon.length > 0) {
        groups.push({
          label: `${dayLabel} - soir`,
          slots: afternoon.map((s) => s.toISOString()),
        });
      }
    }

    return groups;
  }, [hours]);

  const handleSelectMode = (m: "asap" | "scheduled") => {
    setMode(m);
    if (m === "asap") {
      onChange(null);
    }
  };

  const handleSelectSlot = (iso: string) => {
    onChange(iso);
  };

  const selectedTime = value ? new Date(value) : null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <Clock className="h-4 w-4" style={{ color: accent }} />
        Quand souhaitez-vous recuperer votre commande ?
      </h3>

      {/* ASAP / Scheduled toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleSelectMode("asap")}
          className="p-3 rounded-xl text-left transition-all border-2"
          style={{
            borderColor: mode === "asap" ? accent : "transparent",
            backgroundColor: mode === "asap" ? `${accent}08` : "#f3f4f6",
          }}
        >
          <p className="text-sm font-medium text-gray-900">Des que possible</p>
          <p className="text-xs text-gray-500 mt-0.5">Environ {estimatedMinutes} min</p>
        </button>
        <button
          onClick={() => handleSelectMode("scheduled")}
          className="p-3 rounded-xl text-left transition-all border-2"
          style={{
            borderColor: mode === "scheduled" ? accent : "transparent",
            backgroundColor: mode === "scheduled" ? `${accent}08` : "#f3f4f6",
          }}
        >
          <p className="text-sm font-medium text-gray-900">Choisir un horaire</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {selectedTime ? formatTime(selectedTime) : "Planifier"}
          </p>
        </button>
      </div>

      {/* Time slots */}
      <AnimatePresence>
        {mode === "scheduled" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {loading ? (
              <div className="py-6 text-center text-sm text-gray-400">Chargement des creneaux...</div>
            ) : slotGroups.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">Aucun creneau disponible pour le moment</div>
            ) : (
              <div className="space-y-4 pt-1">
                {slotGroups.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <ChevronDown className="h-3 w-3" />
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.slots.map((iso) => {
                        const d = new Date(iso);
                        const timeStr = formatTime(d);
                        const isSelected = value === iso;
                        return (
                          <button
                            key={iso}
                            onClick={() => handleSelectSlot(iso)}
                            className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              backgroundColor: isSelected ? accent : "#f3f4f6",
                              color: isSelected ? "#ffffff" : "#374151",
                            }}
                          >
                            {timeStr}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
