import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANALYSIS_PROMPT = `Tu es un expert en extraction de cartes de restaurant. Tu recois TOUTES les photos en meme temps. Analyse-les ENSEMBLE pour produire UN SEUL menu coherent et complet.

Les photos peuvent inclure :
- Des cartes/menus papier avec les noms des plats, prix, categories
- Des photos de frigo ou vitrine montrant les produits (boissons, desserts)
- Des photos de sauces, comptoir, presentoir

REGLE CRITIQUE - CROISEMENT INTELLIGENT DES INFORMATIONS :
- Si la carte indique "Canettes 33cl : 1,50€" et que les photos du frigo montrent des Coca-Cola, Orangina, Fanta, Oasis, 7UP, etc. → cree UN item par marque visible dans le frigo, chacun a 1,50€
- Si la carte indique un prix pour une categorie de produits (ex: "Bieres 25cl : 2,50€"), applique ce prix a toutes les bieres visibles dans le frigo
- Les prix de la carte font autorite. Les photos du frigo/vitrine servent a identifier les marques et produits disponibles
- Ne cree JAMAIS plusieurs categories pour le meme type de produit (pas "Boissons" + "Boissons fraiches" + "Boissons fraiches" → une seule categorie "Boissons")
- Si une photo montre une liste de sauces, retourne-les comme supplements globaux, pas comme categorie separee

Pour chaque categorie, retourne :
- name : le nom de la categorie (ex: "Sandwichs", "Assiettes", "Boissons", "Desserts", "Divers")

Pour chaque article dans chaque categorie, retourne :
- name : nom exact (inclure marque + format si c'est une boisson, ex: "Coca-Cola 33cl", "Perrier 50cl")
- price : prix en euros (nombre decimal). Utilise le prix de la carte si disponible. Si pas de prix visible, mets 0.
- description : description visible sur la carte. Si aucune, chaine vide.
- variants : tableau de variantes si visible. Ex: [{"name": "Normal", "price": 8.50}, {"name": "Maxi", "price": 11.50}]. Sinon [].
- supplements : tableau d'extras avec prix. Sinon [].
- tags : tableau parmi "homemade", "spicy", "vegetarian", "vegan", "new", "bestseller", "gluten_free". Sinon [].

IMPORTANT :
- Extrais TOUT ce qui est visible, y compris les formules/menus du jour
- UNE SEULE categorie par type (1 seule "Boissons", 1 seule "Sandwichs", etc.)
- Les sauces listees sur une affiche separee = supplements globaux pour les sandwichs/assiettes, PAS une categorie
- Deduplique : si un meme produit apparait sur la carte ET dans le frigo, ne le mets qu'une fois
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
  ],
  "global_sauces": ["Ketchup", "Mayonnaise", "Harissa", "Samourai", "Algerienne", "Barbecue"]
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

    // Build content blocks: all images + prompt in ONE message
    const contentBlocks: any[] = [];

    for (const url of imageUrls) {
      const isPdf = url.toLowerCase().endsWith('.pdf');
      contentBlocks.push(
        isPdf
          ? { type: "document", source: { type: "url", url } }
          : { type: "image", source: { type: "url", url } }
      );
    }

    // Add the analysis prompt after all images
    contentBlocks.push({ type: "text", text: ANALYSIS_PROMPT });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
            content: contentBlocks,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return new Response(JSON.stringify({ error: "Analysis failed: " + errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    let categories: any[] = [];
    let globalSauces: string[] = [];

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        categories = parsed.categories || [];
        globalSauces = parsed.global_sauces || [];
      }
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr);
    }

    // If global sauces were extracted, add them as supplements to sandwich/assiette categories
    if (globalSauces.length > 0) {
      const sauceSupplements = globalSauces.map((s: string) => ({ name: s, price: 0 }));
      const sauceCategories = ["sandwichs", "sandwich", "assiettes", "assiette", "kebab", "kebabs", "tacos", "wraps", "burgers"];

      for (const cat of categories) {
        if (sauceCategories.some(sc => cat.name.toLowerCase().includes(sc))) {
          for (const item of cat.items) {
            if (!item.supplements || item.supplements.length === 0) {
              item.supplements = sauceSupplements;
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ categories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
