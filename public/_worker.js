const SUPABASE_FUNCTIONS_URL =
  "https://tgtvkzmokypztdudwzne.supabase.co/functions/v1";

const SOCIAL_CRAWLER =
  /bot|crawler|facebookexternalhit|linkedinbot|pinterest|slackbot|twitterbot|whatsapp/i;

const RESERVED_PATHS = new Set([
  "abonnement",
  "abonnement-confirme",
  "admin",
  "choisir-plan",
  "connexion",
  "inscription",
  "mot-de-passe-oublie",
  "order",
  "profil",
  "reinitialiser-mot-de-passe",
  "signup",
  "suivi",
  "super-admin",
  "unsubscribe",
  "upload",
]);

function restaurantSlug(request) {
  if (request.method !== "GET") return null;
  if (!SOCIAL_CRAWLER.test(request.headers.get("user-agent") || "")) return null;

  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  if (segments.length !== 1 || RESERVED_PATHS.has(segments[0])) return null;
  return segments[0];
}

export default {
  async fetch(request, env) {
    const slug = restaurantSlug(request);
    if (!slug) return env.ASSETS.fetch(request);

    try {
      const endpoint = `${SUPABASE_FUNCTIONS_URL}/og-restaurant?slug=${encodeURIComponent(slug)}`;
      const upstream = await fetch(endpoint, { redirect: "manual" });

      // The Edge Function redirects unknown slugs. Let the SPA handle those
      // instead of reflecting the redirect back into this Worker.
      if (upstream.status !== 200) return env.ASSETS.fetch(request);

      const headers = new Headers(upstream.headers);
      headers.set("content-type", "text/html; charset=utf-8");
      headers.set("vary", "User-Agent");
      headers.set("x-content-type-options", "nosniff");
      return new Response(upstream.body, { status: 200, headers });
    } catch {
      // Social metadata is an enhancement. A backend outage must never make
      // the restaurant page unavailable.
      return env.ASSETS.fetch(request);
    }
  },
};
