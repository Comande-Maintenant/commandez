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

function minutes(value: string, closing = false): number | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, mins] = value.split(':').map(Number);
  if (closing && hours === 24 && mins === 0) return 1440;
  return hours >= 0 && hours < 24 && mins >= 0 && mins < 60 ? hours * 60 + mins : null;
}

function slotsFor(schedule: ScheduleDay[], day: number): ScheduleSlot[] {
  const entry = schedule.find(s => s?.day === day);
  if (!entry?.enabled || !Array.isArray(entry.slots)) return [];
  return entry.slots.filter(slot => {
    if (!slot) return false;
    const open = minutes(slot.open), close = minutes(slot.close, true);
    return open !== null && close !== null && open !== close;
  }).slice().sort((a, b) => minutes(a.open)! - minutes(b.open)!);
}

function localClock(timeZone: string): { day: number; time: number } {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  let parts: Intl.DateTimeFormatPart[];
  try { parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now); }
  catch { parts = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'Europe/Paris' }).formatToParts(now); }
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)!.value;
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday')), time: Number(value('hour')) * 60 + Number(value('minute')) };
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

  const timeZone = (restaurant as DbRestaurant & { time_zone?: string }).time_zone || 'Europe/Paris';
  const { day: currentDay, time: currentTime } = localClock(timeZone);
  const todaySlots = slotsFor(schedule, currentDay);

  // Check if currently open
  for (const slot of todaySlots) {
      const open = minutes(slot.open)!, close = minutes(slot.close, true)!;
      if (currentTime >= open && (close < open || currentTime < close)) {
        return { isOpen: true, nextOpenInfo: null, currentCloseTime: slot.close, todaySlots };
      }
  }
  // A service starting yesterday remains open after midnight, even if today is disabled.
  for (const slot of slotsFor(schedule, (currentDay + 6) % 7)) {
    const open = minutes(slot.open)!, close = minutes(slot.close, true)!;
    if (close < open && currentTime < close) {
      return { isOpen: true, nextOpenInfo: null, currentCloseTime: slot.close, todaySlots };
    }
  }

  // Not currently open - find next opening
  // Check remaining slots today
  for (const slot of todaySlots) {
      if (currentTime < minutes(slot.open)!) {
        return { isOpen: false, nextOpenInfo: { isToday: true, time: slot.open }, currentCloseTime: null, todaySlots };
      }
  }

  // Check next 7 days
  for (let offset = 1; offset <= 7; offset++) {
    const checkDay = (currentDay + offset) % 7;
    const daySlots = slotsFor(schedule, checkDay);
    if (daySlots.length > 0) {
      const firstSlot = daySlots[0];
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
