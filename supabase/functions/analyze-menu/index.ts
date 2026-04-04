import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANALYSIS_PROMPT = `Tu es un expert en extraction de cartes de restaurant. Analyse cette photo et extrais TOUTES les informations visibles.

La photo peut etre :
- Une carte/menu classique (papier, tableau, ardoise, ecran)
- Une photo de frigo ou vitrine avec des produits visibles (boissons, desserts, etc.)
- Une photo de comptoir, presentoir ou etagere avec des produits et prix
- Une affiche listant des sauces ou supplements

Pour les photos de frigo/vitrine/presentoir :
- Identifie chaque produit visible (bouteilles, canettes, gateaux, etc.)
- Lis les marques et noms sur les emballages (ex: Coca-Cola 33cl, Orangina 25cl, Perrier, Red Bull, Oasis, etc.)
- Cree une categorie "Boissons" (pas "Boissons fraiches" ni autre variante)
- Si le format/taille est visible (33cl, 50cl, 1.5L), inclus-le dans le nom

Pour les affiches de sauces :
- Retourne une categorie speciale nommee exactement "__SAUCES__" avec chaque sauce comme item a prix 0

Pour chaque categorie que tu trouves, retourne :
- name : le nom de la categorie (ex: "Sandwichs", "Assiettes", "Boissons", "Desserts", "Divers", "__SAUCES__")

Pour chaque article dans chaque categorie, retourne :
- name : nom exact de l'article (inclure marque + format si c'est une boisson, ex: "Coca-Cola 33cl")
- price : prix en euros (nombre decimal). Si plusieurs prix (variantes), prends le prix de base.
- description : description visible. Si aucune, mets une chaine vide.
- variants : tableau de variantes/tailles si visible. Ex: [{"name": "Normal", "price": 8.50}, {"name": "Maxi", "price": 11.50}]. Si pas de variantes, tableau vide [].
- supplements : tableau d'ajouts/extras avec prix. Sinon [].
- tags : tableau parmi "homemade", "spicy", "vegetarian", "vegan", "new", "bestseller", "gluten_free". Sinon [].

IMPORTANT :
- Extrais TOUT ce qui est visible, y compris les formules/menus du jour
- Les supplements qui apparaissent globalement pour une categorie, ajoute-les a chaque item de cette categorie
- Si un prix n'est pas visible clairement, mets 0
- Pour les boissons en frigo, identifie au maximum les marques meme si l'etiquette de prix n'est pas nette
- Retourne UNIQUEMENT du JSON valide, sans texte avant ou apres

Format de sortie :
{
  "categories": [
    {
      "name": "Nom categorie",
      "items": [
        {
          "name": "Nom article",
          "price": 9.50,
          "description": "",
          "variants": [],
          "supplements": [],
          "tags": []
        }
      ]
    }
  ]
}`;

/**
 * Normalize category name for merging.
 * "Boissons fraiches", "Boissons fraîches", "BOISSONS" → "boissons"
 */
function normalizeCategory(name: string): string {
  let n = name.toLowerCase().trim();
  // Merge all drink variants into "boissons"
  if (n.includes("boisson")) return "boissons";
  if (n.includes("drink")) return "boissons";
  // Merge sandwich variants
  if (n.includes("sandwich")) return "sandwichs";
  // Merge assiette variants
  if (n.includes("assiette")) return "assiettes";
  if (n.includes("dessert")) return "desserts";
  if (n.includes("diver")) return "divers";
  return n;
}

/**
 * Pretty-print category name from normalized key
 */
function prettyCategory(normalized: string, original: string): string {
  const map: Record<string, string> = {
    boissons: "Boissons",
    sandwichs: "Sandwichs",
    assiettes: "Assiettes",
    desserts: "Desserts",
    divers: "Divers",
  };
  return map[normalized] || original;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageUrls } = await req.json();

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(JSON.stringify({ error: "imageUrls array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allCategories: any[] = [];

    // Analyze each image separately (reliable, works with all formats)
    for (const url of imageUrls) {
      const isPdf = url.toLowerCase().endsWith('.pdf');
      const contentBlock = isPdf
        ? { type: "document" as const, source: { type: "url" as const, url } }
        : { type: "image" as const, source: { type: "url" as const, url } };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [contentBlock, { type: "text", text: ANALYSIS_PROMPT }],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Anthropic API error:", errText);
        continue;
      }

      const data = await response.json();
      const text = data.content?.[0]?.text ?? "";

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.categories) {
            allCategories.push(...parsed.categories);
          }
        }
      } catch (parseErr) {
        console.error("JSON parse error:", parseErr);
      }
    }

    // ── Smart merge: group by normalized category name ──
    const merged: Record<string, { name: string; items: any[] }> = {};
    const sauces: string[] = [];

    for (const cat of allCategories) {
      // Extract sauces into a separate list
      if (cat.name === "__SAUCES__") {
        for (const item of cat.items) {
          if (!sauces.includes(item.name)) {
            sauces.push(item.name);
          }
        }
        continue;
      }

      const key = normalizeCategory(cat.name);

      if (merged[key]) {
        // Deduplicate items by name
        for (const item of cat.items) {
          const exists = merged[key].items.some(
            (existing: any) => existing.name.toLowerCase() === item.name.toLowerCase()
          );
          if (!exists) {
            merged[key].items.push(item);
          }
        }
      } else {
        merged[key] = {
          name: prettyCategory(key, cat.name),
          items: [...cat.items],
        };
      }
    }

    // ── Apply sauces as supplements to sandwichs/assiettes ──
    if (sauces.length > 0) {
      const sauceSupplements = sauces.map((s: string) => ({ name: s, price: 0 }));
      const sauceTargets = ["sandwichs", "assiettes", "kebabs", "tacos", "wraps", "burgers"];

      for (const [key, cat] of Object.entries(merged)) {
        if (sauceTargets.includes(key)) {
          for (const item of cat.items) {
            if (!item.supplements || item.supplements.length === 0) {
              item.supplements = sauceSupplements;
            }
          }
        }
      }
    }

    // ── Cross-reference: apply prices from carte to fridge items ──
    // Find drink items WITH a price (from carte)
    if (merged["boissons"]) {
      const items = merged["boissons"].items;
      // Find the most common non-zero price for canettes (likely from the carte)
      const canettePrices = items
        .filter((i: any) => i.price > 0 && i.name.toLowerCase().includes("33cl"))
        .map((i: any) => i.price);

      if (canettePrices.length > 0) {
        // Most common canette price
        const defaultCanettePrice = canettePrices.sort(
          (a: number, b: number) =>
            canettePrices.filter((v: number) => v === b).length -
            canettePrices.filter((v: number) => v === a).length
        )[0];

        // Apply to items with price 0 that look like canettes
        for (const item of items) {
          if (item.price === 0 && /33cl|canette/i.test(item.name)) {
            item.price = defaultCanettePrice;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ categories: Object.values(merged) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
