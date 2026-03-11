// Static demand patterns for the forecast calendar
// Day indices: 0=dimanche, 1=lundi ... 6=samedi (JS convention)

interface DaySlot {
  midi: number; // 0-100
  soir: number; // 0-100
}

export const WEEKLY_PATTERNS: Record<number, DaySlot> = {
  0: { midi: 55, soir: 35 },  // Dimanche
  1: { midi: 40, soir: 50 },  // Lundi
  2: { midi: 50, soir: 60 },  // Mardi
  3: { midi: 50, soir: 55 },  // Mercredi
  4: { midi: 55, soir: 65 },  // Jeudi
  5: { midi: 70, soir: 90 },  // Vendredi
  6: { midi: 65, soir: 95 },  // Samedi
};

// Distribution horaire typique (0-100) pour chaque heure de la journee
export const HOURLY_DISTRIBUTION: Record<number, number> = {
  0: 2, 1: 1, 2: 0, 3: 0, 4: 0, 5: 0,
  6: 3, 7: 5, 8: 8, 9: 10, 10: 15,
  11: 55, 12: 95, 13: 80, 14: 35,
  15: 10, 16: 8, 17: 15, 18: 50,
  19: 90, 20: 85, 21: 60, 22: 25, 23: 8,
};

export function getIntensityColor(value: number): string {
  if (value < 30) return "bg-emerald-100 text-emerald-800";
  if (value < 55) return "bg-amber-100 text-amber-800";
  if (value < 75) return "bg-orange-200 text-orange-900";
  return "bg-red-200 text-red-900";
}

// Returns an i18n key - callers must wrap with t()
export function getIntensityLabel(value: number): string {
  if (value < 30) return "dashboard.demand.calm";
  if (value < 55) return "dashboard.demand.moderate";
  if (value < 75) return "dashboard.demand.busy";
  return "dashboard.demand.very_busy";
}

// Returns an i18n key - callers must wrap with t()
export function getDayName(dayIndex: number): string {
  return `dashboard.demand.day_${dayIndex}`;
}

// Ordered for display: Lun -> Dim
export function getWeekDays(): number[] {
  return [1, 2, 3, 4, 5, 6, 0];
}

// Returns an i18n key - callers must wrap with t()
// Thresholds aligned with getIntensityLabel: <55 = calm, >=55 = busy
export function getCurrentDemandTip(): string {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const pattern = WEEKLY_PATTERNS[day];

  if (hour >= 8 && hour < 11) {
    return pattern.midi >= 55 ? "dashboard.demand.tip_morning_busy" : "dashboard.demand.tip_morning_calm";
  }
  if (hour >= 11 && hour < 14) {
    return pattern.midi >= 55 ? "dashboard.demand.tip_lunch_busy" : "dashboard.demand.tip_lunch_calm";
  }
  if (hour >= 14 && hour < 17) {
    return pattern.soir >= 55 ? "dashboard.demand.tip_afternoon_busy" : "dashboard.demand.tip_afternoon_calm";
  }
  if (hour >= 17 && hour < 19) {
    return pattern.soir >= 55 ? "dashboard.demand.tip_evening_prep_busy" : "dashboard.demand.tip_evening_prep_calm";
  }
  if (hour >= 19 && hour < 22) {
    return pattern.soir >= 55 ? "dashboard.demand.tip_evening_busy" : "dashboard.demand.tip_evening_calm";
  }
  if (day === 5 || day === 6) {
    return "dashboard.demand.tip_late_weekend";
  }
  return "dashboard.demand.tip_late_default";
}

export function getHourlyChartData(dayOfWeek: number): { hour: string; intensite: number }[] {
  const pattern = WEEKLY_PATTERNS[dayOfWeek];
  const dayMultiplier = ((pattern.midi + pattern.soir) / 2) / 75;

  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}h`,
    intensite: Math.round((HOURLY_DISTRIBUTION[h] || 0) * dayMultiplier),
  }));
}
