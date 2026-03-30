import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, query, placeId, lat, lng, url: inputUrl } = await req.json();

    if (action === "resolve_url") {
      // Follow redirects on short Google URLs (share.google, goo.gl, etc.)
      try {
        const res = await fetch(inputUrl, { redirect: "follow" });
        const finalUrl = res.url;
        return new Response(JSON.stringify({ resolved_url: finalUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ resolved_url: inputUrl, error: e.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "search") {
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
        data.result.photo_urls = data.result.photos.slice(0, 15).map((p: any) => ({
          url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`,
          urlHigh: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${p.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`,
          width: p.width,
          height: p.height,
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
      const photoUrls = photos.map((p: any) => ({
        url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`,
        urlHigh: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${p.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`,
        attribution: p.html_attributions?.[0] ?? "",
        width: p.width,
        height: p.height,
      }));
      return new Response(JSON.stringify({ photos: photoUrls }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "nearby") {
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
