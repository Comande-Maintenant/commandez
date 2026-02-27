import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANALYSIS_PROMPT = `Tu es un expert en extraction de cartes de restaurant. Analyse cette photo de carte/menu et extrais TOUTES les informations visibles.

Pour chaque categorie que tu trouves, retourne :
- name : le nom de la categorie (ex: "Burgers", "Pizzas", "Desserts", "Menus/Formules")

Pour chaque article dans chaque categorie, retourne :
- name : nom exact de l'article
- price : prix en euros (nombre decimal). Si plusieurs prix (variantes), prends le prix de base.
- description : description visible sur la carte. Si aucune, mets une chaine vide.
- variants : tableau de variantes/tailles si visible. Ex: [{"name": "Normal", "price": 8.50}, {"name": "Maxi", "price": 11.50}]. Si pas de variantes, tableau vide [].
- supplements : tableau d'ajouts/extras avec prix. Ex: [{"name": "Fromage", "price": 1.00}, {"name": "Bacon", "price": 1.50}]. Si pas de supplements, tableau vide [].
- tags : tableau de tags visibles sur la carte. Valeurs possibles : "homemade", "spicy", "vegetarian", "vegan", "new", "bestseller", "gluten_free". Si aucun tag visible, tableau vide [].

IMPORTANT :
- Extrais TOUT ce qui est visible, y compris les formules/menus du jour
- Les supplements qui apparaissent globalement pour une categorie, ajoute-les a chaque item de cette categorie
- Si un prix n'est pas visible clairement, mets 0
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
          "description": "Description",
          "variants": [{"name": "Taille", "price": 9.50}],
          "supplements": [{"name": "Extra", "price": 1.00}],
          "tags": ["homemade"]
        }
      ]
    }
  ]
}`;

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

    for (const url of imageUrls) {
      const imageContent = {
        type: "image" as const,
        source: { type: "url" as const, url },
      };

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
              content: [imageContent, { type: "text", text: ANALYSIS_PROMPT }],
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

    // Merge categories with same name
    const merged: Record<string, any> = {};
    for (const cat of allCategories) {
      if (merged[cat.name]) {
        merged[cat.name].items.push(...cat.items);
      } else {
        merged[cat.name] = { ...cat };
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
