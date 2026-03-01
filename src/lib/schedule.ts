import type { DbRestaurant } from "@/types/database";

interface ScheduleSlot {
  open: string;
  close: string;
}

interface ScheduleDay {
  day: number;
  enabled: boolean;
  slots: ScheduleSlot[];
}

/**
 * Check if restaurant is currently open based on availability mode and schedule.
 * Returns { isOpen, nextOpenLabel, currentCloseTime, todaySlots } where:
 * - nextOpenLabel is "Lundi a 11:00" if currently closed
 * - currentCloseTime is "14:30" if currently open (close time of current slot)
 * - todaySlots are today's schedule slots for display
 */
export function checkRestaurantAvailability(restaurant: DbRestaurant): {
  isOpen: boolean;
  nextOpenLabel: string | null;
  currentCloseTime: string | null;
  todaySlots: ScheduleSlot[];
} {
  const mode = restaurant.availability_mode || "manual";

  if (mode === "always") {
    return { isOpen: true, nextOpenLabel: null, currentCloseTime: null, todaySlots: [] };
  }

  if (mode === "manual") {
    return { isOpen: restaurant.is_open, nextOpenLabel: null, currentCloseTime: null, todaySlots: [] };
  }

  // mode === "auto" - check schedule
  const schedule: ScheduleDay[] = restaurant.schedule ?? [];
  if (schedule.length === 0) {
    return { isOpen: restaurant.is_open, nextOpenLabel: null, currentCloseTime: null, todaySlots: [] };
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0=sunday
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const todaySchedule = schedule.find((s) => s.day === currentDay);
  const todaySlots = todaySchedule?.enabled ? todaySchedule.slots : [];

  // Check if currently open
  if (todaySchedule?.enabled) {
    for (const slot of todaySchedule.slots) {
      if (currentTime >= slot.open && currentTime < slot.close) {
        return { isOpen: true, nextOpenLabel: null, currentCloseTime: slot.close, todaySlots };
      }
    }
  }

  // Not currently open - find next opening
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  // Check remaining slots today
  if (todaySchedule?.enabled) {
    for (const slot of todaySchedule.slots) {
      if (currentTime < slot.open) {
        return { isOpen: false, nextOpenLabel: `Aujourd'hui a ${slot.open}`, currentCloseTime: null, todaySlots };
      }
    }
  }

  // Check next 7 days
  for (let offset = 1; offset <= 7; offset++) {
    const checkDay = (currentDay + offset) % 7;
    const daySchedule = schedule.find((s) => s.day === checkDay);
    if (daySchedule?.enabled && daySchedule.slots.length > 0) {
      const firstSlot = daySchedule.slots[0];
      return { isOpen: false, nextOpenLabel: `${dayNames[checkDay]} a ${firstSlot.open}`, currentCloseTime: null, todaySlots };
    }
  }

  return { isOpen: false, nextOpenLabel: null, currentCloseTime: null, todaySlots: [] };
}

/**
 * Check if an order can be placed right now.
 * The "Disponible" toggle (is_accepting_orders) is the master switch.
 * If the restaurateur sets it to true, orders are accepted regardless of schedule.
 */
export function canPlaceOrder(restaurant: DbRestaurant): {
  canOrder: boolean;
  reason: string | null;
} {
  if (!restaurant.is_accepting_orders) {
    return { canOrder: false, reason: "Ce restaurant n'accepte pas de commandes pour le moment." };
  }

  return { canOrder: true, reason: null };
}
