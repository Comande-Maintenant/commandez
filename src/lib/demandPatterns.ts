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
  if (value < 75) return "bg-rose-100 text-rose-800";
  return "bg-red-100 text-red-800";
}

export function getIntensityLabel(value: number): string {
  if (value < 30) return "Calme";
  if (value < 55) return "Moyen";
  if (value < 75) return "Fort";
  return "Tres fort";
}

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export function getDayName(dayIndex: number): string {
  return DAY_NAMES[dayIndex] || "";
}

// Ordered for display: Lun -> Dim
export function getWeekDays(): number[] {
  return [1, 2, 3, 4, 5, 6, 0];
}

export function getCurrentDemandTip(): string {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const pattern = WEEKLY_PATTERNS[day];

  // Morning prep window
  if (hour >= 8 && hour < 11) {
    if (pattern.midi >= 70) {
      return "Le midi s'annonce charge. Pensez a preparer les ingredients en avance.";
    }
    return "Midi devrait etre tranquille, bon moment pour mettre a jour la carte.";
  }

  // Lunch rush
  if (hour >= 11 && hour < 14) {
    if (pattern.midi >= 70) {
      return "C'est le rush du midi. Concentrez-vous sur la rapidite de service.";
    }
    return "Flux modere au dejeuner. Profitez-en pour soigner la presentation.";
  }

  // Afternoon lull
  if (hour >= 14 && hour < 17) {
    if (pattern.soir >= 75) {
      return "Ce soir s'annonce tres charge. Preparez les stocks des plats populaires.";
    }
    return "Profitez du creux pour reapprovisionner et preparer le service du soir.";
  }

  // Evening prep
  if (hour >= 17 && hour < 19) {
    if (pattern.soir >= 75) {
      return "Gros rush prevu ce soir. Tout est pret ?";
    }
    return "Soiree calme prevue, l'occasion de tester de nouvelles recettes.";
  }

  // Evening service
  if (hour >= 19 && hour < 22) {
    if (pattern.soir >= 75) {
      return "Plein rush du soir. Gardez le rythme !";
    }
    return "Service du soir en cours. Flux normal.";
  }

  // Late / closed
  if (day === 5 || day === 6) {
    return "Demain sera une journee chargee, reposez-vous bien.";
  }
  return "Bonne fin de journee. A demain !";
}

export function getHourlyChartData(dayOfWeek: number): { hour: string; intensite: number }[] {
  const pattern = WEEKLY_PATTERNS[dayOfWeek];
  const dayMultiplier = ((pattern.midi + pattern.soir) / 2) / 75;

  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}h`,
    intensite: Math.round((HOURLY_DISTRIBUTION[h] || 0) * dayMultiplier),
  }));
}
