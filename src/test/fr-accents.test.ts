import { describe, expect, it } from "vitest";
import fr from "@/i18n/fr.json";

// Unaccented (or wrongly over-accented) French forms that must never come back
// in the French locale. Matched as whole words, case-sensitive.
const forbiddenForms = [
  // Missing accents
  "Creer", "Creez", "creer", "Creation", "Deja", "deja", "Precedent", "Recapitulatif",
  "Numero", "numero", "telephone", "Telephone", "Quantite", "quantite", "caracteres",
  "Especes", "bientot", "Bientot", "Termine", "termine", "Selectionnez", "Reglages",
  "Apercu", "Acces", "Decouvrir", "Epicerie", "creneau", "creneaux", "categorie",
  "preparation", "Preparation", "demonstration", "Demonstration", "Reinitialiser",
  "reel", "Gerer", "Gerez", "gerer", "succes", "oublie", "Disponibilite", "defaut",
  "supplement", "Supplement", "supplements", "Supplements", "supplementaire",
  "recuperez", "Specialites", "Entrees", "securise", "Probleme", "envoyee", "Desactiver",
  "Reactiver", "Recuperee", "Confirmee", "Terminee", "Annulee", "Duree", "Prevision",
  "Reguliers", "Fideles", "Ingredients", "Details", "Depense", "Generique", "francais",
  "Creperie", "Etes", "ete", "tres", "apres", "Apres", "Soiree", "Matinee", "Dernieres",
  // Over-accented forms introduced by an earlier tool
  "ajoutér", "Ajoutér", "ajoutéz", "Ajoutéz", "récupéréz", "récupérér", "désactivéz",
] as const;

// Unaccented "à" at the start of a label ("A emporter", "A partir de").
const forbiddenPatterns = [/^A (emporter|encaisser|ajouter|partir)\b/u];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wordPattern = (word: string) =>
  new RegExp(`(?<![\\p{L}\\p{M}])${escapeRegExp(word)}(?![\\p{L}\\p{M}])`, "u");

describe("French locale accents", () => {
  const entries = Object.entries(fr as Record<string, string>);

  it("loads the French catalogue", () => {
    expect(entries.length).toBeGreaterThan(1000);
  });

  it("contains no unaccented or over-accented French forms", () => {
    const offenders: string[] = [];
    for (const [key, value] of entries) {
      for (const form of forbiddenForms) {
        if (wordPattern(form).test(value)) offenders.push(`${key}: "${form}" in ${JSON.stringify(value)}`);
      }
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(value)) offenders.push(`${key}: ${pattern} in ${JSON.stringify(value)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("detects a forbidden form (guard self-test)", () => {
    expect(wordPattern("Creer").test("Creer mon compte")).toBe(true);
    expect(wordPattern("Creer").test("Créer mon compte")).toBe(false);
    expect(wordPattern("ete").test("compléter")).toBe(false);
    expect(wordPattern("ajoutér").test("+ Ajoutér d'autres fichiers")).toBe(false);
    expect(wordPattern("Ajoutér").test("+ Ajoutér d'autres fichiers")).toBe(true);
  });
});
