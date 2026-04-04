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

    // ── STEP 2: Cross-reference pass with Claude ──
    // Send the merged raw data back to Claude for intelligent cross-referencing
    const mergedCategories = Object.values(merged);

    const CROSSREF_PROMPT = `Tu recois le resultat brut d'un scan de carte de restaurant, fait image par image. Certaines images etaient la carte papier (avec les prix), d'autres des photos de frigo (avec les marques visibles), et d'autres des affiches de sauces.

Ton travail : CROISER les informations pour produire un menu final COMPLET et COHERENT.

REGLES DE CROISEMENT :
1. PRIX : Si la carte indique un prix pour un type de produit (ex: "Canettes 33cl : 1,50€"), applique ce prix a TOUTES les canettes 33cl, meme celles vues dans le frigo sans prix. Le Red Bull, bieres, bouteilles ont souvent un prix different indique sur la carte.
2. VARIANTES : Si la carte indique des tailles/formats (ex: barquette petite/moyenne/grande, ou sandwich normal/maxi), cree des VARIANTS pour chaque item concerne avec les bons prix.
3. DOUBLONS : Si un meme produit apparait plusieurs fois (ex: "Coca-Cola" de la carte et "Coca-Cola 33cl" du frigo), garde une seule entree avec le bon prix.
4. SAUCES : Si des sauces ont ete detectees, ajoute-les comme supplements (prix 0) aux sandwichs et assiettes.
5. ITEMS A PRIX 0 : Essaie de deduire le prix correct a partir des autres infos. Si un groupe de produits similaires a un prix commun sur la carte, applique-le.
6. NE SUPPRIME RIEN : Garde tous les items, meme si tu n'arrives pas a trouver un prix (laisse 0).

Voici les donnees brutes :
${JSON.stringify({ categories: mergedCategories, sauces }, null, 2)}

Retourne le menu final corrige. UNIQUEMENT du JSON valide :
{
  "categories": [
    {
      "name": "Nom categorie",
      "items": [
        {
          "name": "Nom article",
          "price": 9.50,
          "description": "",
          "variants": [{"name": "Taille", "price": 9.50}],
          "supplements": [{"name": "Sauce", "price": 0}],
          "tags": []
        }
      ]
    }
  ]
}`;

    console.log(`Step 2: Cross-referencing ${mergedCategories.length} categories...`);

    const crossRefResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: CROSSREF_PROMPT,
          },
        ],
      }),
    });

    if (crossRefResponse.ok) {
      const crossRefData = await crossRefResponse.json();
      const crossRefText = crossRefData.content?.[0]?.text ?? "";

      try {
        const jsonMatch = crossRefText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const finalMenu = JSON.parse(jsonMatch[0]);
          if (finalMenu.categories && finalMenu.categories.length > 0) {
            console.log(`Cross-reference done: ${finalMenu.categories.length} categories`);
            return new Response(
              JSON.stringify({ categories: finalMenu.categories }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (parseErr) {
        console.error("Cross-reference JSON parse error:", parseErr);
      }
    } else {
      console.error("Cross-reference API error:", await crossRefResponse.text());
    }

    // Fallback: return the basic merged data if cross-reference fails
    console.log("Falling back to basic merge");
    return new Response(
      JSON.stringify({ categories: mergedCategories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
