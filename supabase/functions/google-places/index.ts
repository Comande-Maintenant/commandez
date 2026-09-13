import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";
import { signToken, verifyToken } from "../_shared/signed-token.ts";

const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? "";
const GOOGLE_PHOTO_TOKEN_SECRET = Deno.env.get("GOOGLE_PHOTO_TOKEN_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    if (req.method === "GET" && requestUrl.searchParams.get("action") === "photo") {
      const payload = await verifyToken<{ ref: string; width: number; purpose: string; exp: number }>(
        requestUrl.searchParams.get("token") ?? "",
        GOOGLE_PHOTO_TOKEN_SECRET,
        "google-place-photo",
      );
      if (!payload?.ref) return new Response("Invalid photo token", { status: 401 });
      const width = Math.min(1600, Math.max(200, Number(payload.width) || 800));
      const upstream = await fetch(
        `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${width}&photo_reference=${encodeURIComponent(payload.ref)}&key=${GOOGLE_PLACES_API_KEY}`,
        { redirect: "follow" },
      );
      if (!upstream.ok || !upstream.body) return new Response("Photo unavailable", { status: 502 });
      return new Response(upstream.body, {
        headers: {
          "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    if (!await requireUser(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { action, query, placeId, lat, lng, url: inputUrl } = await req.json();

    if (action === "resolve_url") {
      // share.google links use a JS challenge, but the fallback HTML contains
      // a /search?q=Business+Name link we can extract the name from
      try {
        const target = new URL(inputUrl);
        const allowedHosts = new Set(["share.google", "maps.app.goo.gl", "www.google.com", "google.com"]);
        if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) {
          return new Response(JSON.stringify({ error: "Unsupported URL" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const res = await fetch(inputUrl, {
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        });
        const html = await res.text();
        // Extract business name from fallback link: /search?q=Le+M%C3%A9sopotamie&...
        const searchMatch = html.match(/\/search\?q=([^&"]+)/);
        if (searchMatch) {
          const businessName = decodeURIComponent(searchMatch[1].replace(/\+/g, " "));
          return new Response(JSON.stringify({ business_name: businessName }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Fallback: return the final URL
        return new Response(JSON.stringify({ resolved_url: res.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "search") {
      if (typeof query !== "string" || query.trim().length < 2 || query.length > 200) {
        return new Response(JSON.stringify({ error: "Invalid query" }), { status: 400, headers: corsHeaders });
      }
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=restaurant&key=${GOOGLE_PLACES_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      return new Response(JSON.stringify({ results: data.results ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "details") {
      const fields = "place_id,name,formatted_address,formatted_phone_number,rating,types,opening_hours,photos,website,geometry";
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_PLACES_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      // Enrich photos with full URLs (key is server-side only)
      if (data.result?.photos) {
        data.result.photo_urls = await Promise.all(data.result.photos.slice(0, 15).map(async (p: any) => {
          const expires = Date.now() + 60 * 60 * 1000;
          const token = await signToken({ ref: p.photo_reference, width: 800, purpose: "google-place-photo", exp: expires }, GOOGLE_PHOTO_TOKEN_SECRET);
          const highToken = await signToken({ ref: p.photo_reference, width: 1600, purpose: "google-place-photo", exp: expires }, GOOGLE_PHOTO_TOKEN_SECRET);
          return {
            url: `${SUPABASE_URL}/functions/v1/google-places?action=photo&token=${encodeURIComponent(token)}`,
            urlHigh: `${SUPABASE_URL}/functions/v1/google-places?action=photo&token=${encodeURIComponent(highToken)}`,
            width: p.width,
            height: p.height,
          };
        }));
      }
      return new Response(JSON.stringify({ result: data.result ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "photos") {
      // Return photo URLs for a place (up to maxPhotos)
      const maxPhotos = 15;
      const fields = "photos";
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_PLACES_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      const photos = (data.result?.photos ?? []).slice(0, maxPhotos);
      const photoUrls = await Promise.all(photos.map(async (p: any) => {
        const expires = Date.now() + 60 * 60 * 1000;
        const token = await signToken({ ref: p.photo_reference, width: 800, purpose: "google-place-photo", exp: expires }, GOOGLE_PHOTO_TOKEN_SECRET);
        const highToken = await signToken({ ref: p.photo_reference, width: 1600, purpose: "google-place-photo", exp: expires }, GOOGLE_PHOTO_TOKEN_SECRET);
        return {
          url: `${SUPABASE_URL}/functions/v1/google-places?action=photo&token=${encodeURIComponent(token)}`,
          urlHigh: `${SUPABASE_URL}/functions/v1/google-places?action=photo&token=${encodeURIComponent(highToken)}`,
          attribution: p.html_attributions?.[0] ?? "",
          width: p.width,
          height: p.height,
        };
      }));
      return new Response(JSON.stringify({ photos: photoUrls }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "nearby") {
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))
        || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) {
        return new Response(JSON.stringify({ error: "Invalid coordinates" }), { status: 400, headers: corsHeaders });
      }
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1000&type=restaurant&key=${GOOGLE_PLACES_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      return new Response(JSON.stringify({ results: data.results ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
