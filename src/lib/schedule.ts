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
 * Returns { isOpen, nextOpenInfo, currentCloseTime, todaySlots } where:
 * - nextOpenInfo contains structured data for the next opening (to be formatted with i18n)
 * - currentCloseTime is "14:30" if currently open (close time of current slot)
 * - todaySlots are today's schedule slots for display
 */
export function checkRestaurantAvailability(restaurant: DbRestaurant): {
  isOpen: boolean;
  nextOpenInfo: { isToday: boolean; dayIndex?: number; time: string } | null;
  currentCloseTime: string | null;
  todaySlots: ScheduleSlot[];
} {
  const mode = restaurant.availability_mode || "manual";

  if (mode === "always") {
    return { isOpen: true, nextOpenInfo: null, currentCloseTime: null, todaySlots: [] };
  }

  if (mode === "manual") {
    return { isOpen: restaurant.is_open, nextOpenInfo: null, currentCloseTime: null, todaySlots: [] };
  }

  // mode === "auto" - check schedule
  const schedule: ScheduleDay[] = restaurant.schedule ?? [];
  if (schedule.length === 0) {
    return { isOpen: restaurant.is_open, nextOpenInfo: null, currentCloseTime: null, todaySlots: [] };
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
        return { isOpen: true, nextOpenInfo: null, currentCloseTime: slot.close, todaySlots };
      }
    }
  }

  // Not currently open - find next opening
  // Check remaining slots today
  if (todaySchedule?.enabled) {
    for (const slot of todaySchedule.slots) {
      if (currentTime < slot.open) {
        return { isOpen: false, nextOpenInfo: { isToday: true, time: slot.open }, currentCloseTime: null, todaySlots };
      }
    }
  }

  // Check next 7 days
  for (let offset = 1; offset <= 7; offset++) {
    const checkDay = (currentDay + offset) % 7;
    const daySchedule = schedule.find((s) => s.day === checkDay);
    if (daySchedule?.enabled && daySchedule.slots.length > 0) {
      const firstSlot = daySchedule.slots[0];
      return { isOpen: false, nextOpenInfo: { isToday: false, dayIndex: checkDay, time: firstSlot.open }, currentCloseTime: null, todaySlots };
    }
  }

  return { isOpen: false, nextOpenInfo: null, currentCloseTime: null, todaySlots: [] };
}

/**
 * Check if an order can be placed right now.
 * The "Disponible" toggle (is_accepting_orders) is the master switch.
 * Schedule is also checked when availability_mode is "auto".
 */
export function canPlaceOrder(restaurant: DbRestaurant): {
  canOrder: boolean;
  reason: string | null;
} {
  if ((restaurant as any).is_demo) {
    return { canOrder: true, reason: null };
  }

  if (!restaurant.is_accepting_orders) {
    return { canOrder: false, reason: "schedule.not_accepting" };
  }

  // Also check schedule when in auto mode
  const { isOpen } = checkRestaurantAvailability(restaurant);
  if (!isOpen) {
    return { canOrder: false, reason: "schedule.currently_closed" };
  }

  return { canOrder: true, reason: null };
}
