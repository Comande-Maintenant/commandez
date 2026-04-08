import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://rbqgsxhkccbhqdmdtxwr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJicWdzeGhrY2NiaHFkbWR0eHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTUxMDgsImV4cCI6MjA4Nzc5MTEwOH0.NC1DkzxoJGDsbqvvScUVFdrWfqVmyTBV3k6b2yolOeY";

const APP_URL = "https://app.commandeici.com";

// Cover images by cuisine type
const COVER_IMAGES: Record<string, string> = {
  kebab: `${APP_URL}/images/covers/kebab.jpg`,
  pizza: `${APP_URL}/images/covers/pizza.jpg`,
  burger: `${APP_URL}/images/covers/burger.jpg`,
};
const DEFAULT_COVER = `${APP_URL}/images/covers/default.jpg`;

function getCoverImage(cuisine: string | null, cuisineType: string | null): string {
  if (cuisineType && COVER_IMAGES[cuisineType]) return COVER_IMAGES[cuisineType];
  const c = (cuisine || "").toLowerCase();
  if (c.includes("pizza") || c.includes("italien")) return COVER_IMAGES.pizza;
  if (c.includes("kebab") || c.includes("turc")) return COVER_IMAGES.kebab;
  if (c.includes("burger")) return COVER_IMAGES.burger;
  return DEFAULT_COVER;
}

function getCuisineEmoji(cuisineType: string | null): string {
  const emojis: Record<string, string> = {
    kebab: "🥙", pizza: "🍕", burger: "🍔", sushi: "🍣",
    chinese: "🥡", indian: "🍛", creperie: "🥞", poke: "🥗",
  };
  return emojis[cuisineType || ""] || "🍽️";
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name, city, address, cuisine, cuisine_type, image, cover_image, rating, categories")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant) {
    // Redirect to app anyway
    return Response.redirect(`${APP_URL}/${slug}`, 302);
  }

  const emoji = getCuisineEmoji(restaurant.cuisine_type);
  const title = `${emoji} ${restaurant.name} - Commandez en ligne`;
  const desc = restaurant.city
    ? `Decouvrez la carte de ${restaurant.name} a ${restaurant.city} et commandez en ligne. ${restaurant.cuisine || ""}`
    : `Decouvrez la carte de ${restaurant.name} et commandez en ligne.`;
  const ogImage = restaurant.image || restaurant.cover_image || getCoverImage(restaurant.cuisine, restaurant.cuisine_type);
  const pageUrl = `${APP_URL}/${slug}`;
  const categories = (restaurant.categories || []).slice(0, 4).join(" · ");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}${categories ? " | " + categories : ""}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="commandeici">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${ogImage}">
  <meta http-equiv="refresh" content="0;url=${pageUrl}">
</head>
<body>
  <p>Redirection vers <a href="${pageUrl}">${restaurant.name}</a>...</p>
</body>
</html>`;

  const body = new TextEncoder().encode(html);
  return new Response(body, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
