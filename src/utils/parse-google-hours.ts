/**
 * Parse Google Places weekday_text into structured restaurant_hours rows.
 *
 * Google returns weekday_text in either English or French, e.g.:
 *   "Monday: 11:00 AM – 2:30 PM, 5:30 – 10:30 PM"
 *   "lundi: 11:00 – 14:30, 17:30 – 22:30"
 *   "Sunday: Closed"
 *   "dimanche: Fermé"
 *
 * The DB supports one open_time + close_time per day,
 * so for split hours we take the earliest open and latest close.
 */

export interface ParsedHour {
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  is_open: boolean;
  open_time: string; // "HH:MM" 24h format
  close_time: string; // "HH:MM" 24h format
}

// Map day names (English + French) to day_of_week (0=Sun)
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

// Convert 12h time to 24h: "2:30 PM" → "14:30", "11:00 AM" → "11:00"
function to24h(timeStr: string): string {
  const cleaned = timeStr.trim();

  // Already 24h format (no AM/PM)
  if (!/[ap]m/i.test(cleaned)) {
    // Normalize: "5:30" → "05:30"
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

// Compare two HH:MM times, return <0 if a<b, 0 if equal, >0 if a>b
function compareTime(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}

/**
 * Parse a single weekday_text line into a ParsedHour.
 * Returns null if the line cannot be parsed.
 */
function parseLine(line: string): ParsedHour | null {
  // Split on first colon: "Monday: 11:00 AM – 2:30 PM"
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;

  const dayName = line.substring(0, colonIdx).trim().toLowerCase();
  const rest = line.substring(colonIdx + 1).trim();

  const dayOfWeek = DAY_MAP[dayName];
  if (dayOfWeek === undefined) return null;

  // Check for closed
  const closedPatterns = ['closed', 'fermé', 'ferme', 'fermée', 'fermee'];
  if (closedPatterns.some((p) => rest.toLowerCase().includes(p))) {
    return { day_of_week: dayOfWeek, is_open: false, open_time: '00:00', close_time: '00:00' };
  }

  // Split by comma to get multiple time ranges
  // "11:00 AM – 2:30 PM, 5:30 – 10:30 PM"
  // "11:00–14:30, 17:30–22:30"
  const ranges = rest.split(',').map((r) => r.trim()).filter(Boolean);

  let earliestOpen = '23:59';
  let latestClose = '00:00';

  for (const range of ranges) {
    // Split by dash/en-dash/em-dash, but NOT the colon inside times
    // Use a regex that matches dashes surrounded by optional spaces,
    // but only when they separate two time values
    const parts = range.split(/\s*[–—]\s*|\s+-\s+|\s+to\s+/i);
    if (parts.length < 2) continue;

    const rawOpen = parts[0].trim();
    const rawClose = parts[parts.length - 1].trim();

    // Google English format: "5:30 – 10:30 PM" → PM applies to BOTH
    // If close has AM/PM but open doesn't, inherit it
    const ampmMatch = rawClose.match(/\s*(am|pm)\s*$/i);
    let fixedOpen = rawOpen;
    if (ampmMatch && !/[ap]m/i.test(rawOpen)) {
      fixedOpen = rawOpen + ' ' + ampmMatch[1];
    }

    const openTime = to24h(fixedOpen);
    const closeTime = to24h(rawClose);

    if (compareTime(openTime, earliestOpen) < 0) {
      earliestOpen = openTime;
    }
    if (compareTime(closeTime, latestClose) > 0) {
      latestClose = closeTime;
    }
  }

  // If we couldn't parse any valid range
  if (earliestOpen === '23:59' && latestClose === '00:00') {
    return null;
  }

  return {
    day_of_week: dayOfWeek,
    is_open: true,
    open_time: earliestOpen,
    close_time: latestClose,
  };
}

/**
 * Parse Google Places weekday_text array into restaurant_hours format.
 * Returns 7 rows (one per day), with defaults for days not found.
 */
export function parseGoogleHours(weekdayText: string[]): ParsedHour[] {
  const parsed = new Map<number, ParsedHour>();

  for (const line of weekdayText) {
    const result = parseLine(line);
    if (result) {
      parsed.set(result.day_of_week, result);
    }
  }

  // Fill in all 7 days (default to closed if not found)
  const hours: ParsedHour[] = [];
  for (let d = 0; d <= 6; d++) {
    hours.push(
      parsed.get(d) ?? {
        day_of_week: d,
        is_open: false,
        open_time: '00:00',
        close_time: '00:00',
      }
    );
  }

  return hours;
}

/**
 * Format parsed hours for display in a simple list.
 * Returns lines like "Lundi : 11:00 - 22:30" or "Dimanche : Ferme"
 */
export function formatParsedHours(hours: ParsedHour[]): string[] {
  // Display in Mon-Sun order
  const ordered = [1, 2, 3, 4, 5, 6, 0];
  return ordered.map((d) => {
    const h = hours.find((x) => x.day_of_week === d);
    const label = DAY_LABELS_FR[d] || `Jour ${d}`;
    if (!h || !h.is_open) return `${label} : Ferme`;
    return `${label} : ${h.open_time} - ${h.close_time}`;
  });
}
