// Centralized timestamp formatting for the entire app
// Paliers: "À l'instant" → "Il y a X min" → heure exacte → "Hier à HH:MM" → "JJ/MM à HH:MM"

const LOCALE_MAP: Record<string, string> = {
  fr: "fr-FR", en: "en-US", es: "es-ES", de: "de-DE", it: "it-IT",
  pt: "pt-PT", nl: "nl-NL", ar: "ar-SA", zh: "zh-CN", ja: "ja-JP",
  ko: "ko-KR", ru: "ru-RU", tr: "tr-TR", vi: "vi-VN",
};

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function isYesterday(date: Date, now: Date): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

function clockTime(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatOrderTime(
  dateStr: string | Date,
  language: string,
  t: (key: string, params?: Record<string, string>) => string,
): string {
  const now = new Date();
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const locale = LOCALE_MAP[language] || "fr-FR";
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  // 0-10 seconds
  if (diffSec < 10) return t("time.just_now");

  // 10-59 seconds
  if (diffSec < 60) return t("time.few_seconds");

  // 1-5 minutes
  if (diffMin <= 5) return t("time.minutes_ago", { min: String(diffMin) });

  // Same day, 6+ minutes → exact time
  if (isSameDay(date, now)) return clockTime(date, locale);

  // Yesterday
  if (isYesterday(date, now)) return t("time.yesterday_at", { time: clockTime(date, locale) });

  // Older → DD/MM à HH:MM
  const dayMonth = date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  return t("time.date_at", { date: dayMonth, time: clockTime(date, locale) });
}

// For customer profile: relative time for "last order" (can be days/months ago)
export function formatRelativeTime(
  dateStr: string | null,
  language: string,
  t: (key: string, params?: Record<string, string>) => string,
): string {
  if (!dateStr) return t("time.never");
  const now = new Date();
  const date = new Date(dateStr);
  const locale = LOCALE_MAP[language] || "fr-FR";
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 10) return t("time.just_now");
  if (diffMin < 60) return t("time.minutes_ago", { min: String(diffMin) });

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return t("time.hours_ago", { h: String(diffHours) });

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return t("time.days_ago", { d: String(diffDays) });

  const diffMonths = Math.floor(diffDays / 30);
  return t("time.months_ago", { m: String(diffMonths) });
}
