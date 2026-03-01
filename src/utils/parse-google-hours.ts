/**
 * Parse Google Places weekday_text into structured schedule format.
 *
 * Google returns weekday_text in either English or French, e.g.:
 *   "Monday: 11:00 AM – 2:30 PM, 5:30 – 10:30 PM"
 *   "lundi: 11:00 – 14:30, 17:30 – 22:30"
 *   "Sunday: Closed"
 *   "dimanche: Fermé"
 *
 * Output format matches ScheduleDay[] used by ScheduleEditor and
 * checkRestaurantAvailability, with multiple slots per day.
 */

export interface ScheduleSlot {
  open: string; // "HH:MM" 24h
  close: string; // "HH:MM" 24h
}

export interface ParsedScheduleDay {
  day: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  enabled: boolean;
  slots: ScheduleSlot[];
}

// Map day names (English + French) to day number (0=Sun)
const DAY_MAP: Record<string, number> = {
  sunday: 0, dimanche: 0,
  monday: 1, lundi: 1,
  tuesday: 2, mardi: 2,
  wednesday: 3, mercredi: 3,
  thursday: 4, jeudi: 4,
  friday: 5, vendredi: 5,
  saturday: 6, samedi: 6,
};

const DAY_LABELS_FR: Record<number, string> = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

// Convert 12h time to 24h: "2:30 PM" -> "14:30", "11:00 AM" -> "11:00"
function to24h(timeStr: string): string {
  const cleaned = timeStr.trim();

  // Already 24h format (no AM/PM)
  if (!/[ap]m/i.test(cleaned)) {
    const parts = cleaned.split(':');
    if (parts.length === 2) {
      return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
    }
    return cleaned;
  }

  const isPM = /pm/i.test(cleaned);
  const timePart = cleaned.replace(/\s*(am|pm)/i, '').trim();
  const [hStr, mStr] = timePart.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.padStart(2, '0') : '00';

  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;

  return String(h).padStart(2, '0') + ':' + m;
}

/**
 * Parse a single weekday_text line into a ParsedScheduleDay.
 * Preserves multiple slots (e.g. lunch + dinner).
 */
function parseLine(line: string): ParsedScheduleDay | null {
  // Split on first colon: "Monday: 11:00 AM – 2:30 PM"
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;

  const dayName = line.substring(0, colonIdx).trim().toLowerCase();
  const rest = line.substring(colonIdx + 1).trim();

  const day = DAY_MAP[dayName];
  if (day === undefined) return null;

  // Check for closed
  const closedPatterns = ['closed', 'fermé', 'ferme', 'fermée', 'fermee'];
  if (closedPatterns.some((p) => rest.toLowerCase().includes(p))) {
    return { day, enabled: false, slots: [] };
  }

  // Split by comma to get individual time ranges
  // "11:00 AM – 2:30 PM, 5:30 – 10:30 PM" -> 2 slots
  // "11:00–14:30, 17:30–22:30" -> 2 slots
  const ranges = rest.split(',').map((r) => r.trim()).filter(Boolean);
  const slots: ScheduleSlot[] = [];

  for (const range of ranges) {
    // Split by en-dash/em-dash (always), or hyphen only with spaces
    const parts = range.split(/\s*[\u2013\u2014]\s*|\s+-\s+|\s+to\s+/i);
    if (parts.length < 2) continue;

    const rawOpen = parts[0].trim();
    const rawClose = parts[parts.length - 1].trim();

    // Google English: "5:30 – 10:30 PM" -> PM applies to both
    const ampmMatch = rawClose.match(/\s*(am|pm)\s*$/i);
    let fixedOpen = rawOpen;
    if (ampmMatch && !/[ap]m/i.test(rawOpen)) {
      fixedOpen = rawOpen + ' ' + ampmMatch[1];
    }

    slots.push({
      open: to24h(fixedOpen),
      close: to24h(rawClose),
    });
  }

  if (slots.length === 0) return null;

  return { day, enabled: true, slots };
}

/**
 * Parse Google Places weekday_text array into schedule format.
 * Returns 7 days (Mon-Sun order), preserving multiple slots per day.
 */
export function parseGoogleSchedule(weekdayText: string[]): ParsedScheduleDay[] {
  const parsed = new Map<number, ParsedScheduleDay>();

  for (const line of weekdayText) {
    const result = parseLine(line);
    if (result) {
      parsed.set(result.day, result);
    }
  }

  // Fill all 7 days (default closed if not found)
  const schedule: ParsedScheduleDay[] = [];
  for (let d = 0; d <= 6; d++) {
    schedule.push(
      parsed.get(d) ?? { day: d, enabled: false, slots: [] }
    );
  }

  return schedule;
}

/**
 * Format parsed schedule for display.
 * Returns lines like "Lundi : 11:00-14:30, 17:30-22:30" or "Dimanche : Ferme"
 */
export function formatScheduleLines(schedule: ParsedScheduleDay[]): string[] {
  const ordered = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
  return ordered.map((d) => {
    const day = schedule.find((x) => x.day === d);
    const label = DAY_LABELS_FR[d] || `Jour ${d}`;
    if (!day || !day.enabled || day.slots.length === 0) return `${label} : Ferme`;
    const slotsStr = day.slots.map((s) => `${s.open}-${s.close}`).join(', ');
    return `${label} : ${slotsStr}`;
  });
}
