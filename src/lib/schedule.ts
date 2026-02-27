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
 * Returns { isOpen, nextOpenLabel } where nextOpenLabel is a human-readable string
 * like "Lundi a 11:00" if the restaurant is currently closed.
 */
export function checkRestaurantAvailability(restaurant: DbRestaurant): {
  isOpen: boolean;
  nextOpenLabel: string | null;
} {
  const mode = restaurant.availability_mode || "manual";

  if (mode === "always") {
    return { isOpen: true, nextOpenLabel: null };
  }

  if (mode === "manual") {
    return { isOpen: restaurant.is_open, nextOpenLabel: null };
  }

  // mode === "auto" - check schedule
  const schedule: ScheduleDay[] = restaurant.schedule ?? [];
  if (schedule.length === 0) {
    return { isOpen: restaurant.is_open, nextOpenLabel: null };
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0=sunday
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // Check if currently open
  const todaySchedule = schedule.find((s) => s.day === currentDay);
  if (todaySchedule?.enabled) {
    for (const slot of todaySchedule.slots) {
      if (currentTime >= slot.open && currentTime < slot.close) {
        return { isOpen: true, nextOpenLabel: null };
      }
    }
  }

  // Not currently open - find next opening
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  // Check remaining slots today
  if (todaySchedule?.enabled) {
    for (const slot of todaySchedule.slots) {
      if (currentTime < slot.open) {
        return { isOpen: false, nextOpenLabel: `Aujourd'hui a ${slot.open}` };
      }
    }
  }

  // Check next 7 days
  for (let offset = 1; offset <= 7; offset++) {
    const checkDay = (currentDay + offset) % 7;
    const daySchedule = schedule.find((s) => s.day === checkDay);
    if (daySchedule?.enabled && daySchedule.slots.length > 0) {
      const firstSlot = daySchedule.slots[0];
      return { isOpen: false, nextOpenLabel: `${dayNames[checkDay]} a ${firstSlot.open}` };
    }
  }

  return { isOpen: false, nextOpenLabel: null };
}

/**
 * Check if an order can be placed right now.
 * Returns { canOrder, reason }.
 */
export function canPlaceOrder(restaurant: DbRestaurant): {
  canOrder: boolean;
  reason: string | null;
} {
  // Check accepting orders toggle first
  if (!restaurant.is_accepting_orders) {
    return { canOrder: false, reason: "Ce restaurant n'accepte pas de commandes pour le moment." };
  }

  const { isOpen, nextOpenLabel } = checkRestaurantAvailability(restaurant);

  if (!isOpen) {
    const reason = nextOpenLabel
      ? `Ce restaurant est ferme. Prochaine ouverture : ${nextOpenLabel}`
      : "Ce restaurant est ferme.";
    return { canOrder: false, reason };
  }

  return { canOrder: true, reason: null };
}
