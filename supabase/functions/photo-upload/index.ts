import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSuperAdmin } from "../_shared/auth.ts";
import { signToken, verifyToken } from "../_shared/signed-token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TOKEN_SECRET = Deno.env.get("PHOTO_UPLOAD_TOKEN_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.commandeici.com";
const BUCKET = "prospect-uploads";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const createServiceClient = () => createClient(SUPABASE_URL, SERVICE_KEY);
type ServiceClient = ReturnType<typeof createServiceClient>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authorizeToken(token: string): Promise<{ restaurantId: string } | null> {
  const payload = await verifyToken<{
    restaurantId: string;
    purpose: string;
    exp: number;
  }>(token, TOKEN_SECRET, "prospect-photo-upload");
  return payload?.restaurantId ? { restaurantId: payload.restaurantId } : null;
}

async function listPhotos(service: ServiceClient, restaurantId: string) {
  const { data: files, error } = await service.storage.from(BUCKET).list(restaurantId, {
    limit: 50,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  const paths = (files ?? []).filter((file) => file.name !== ".emptyFolderPlaceholder")
    .map((file) => `${restaurantId}/${file.name}`);
  if (paths.length === 0) return [];
  const { data, error: signedError } = await service.storage.from(BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (signedError) throw signedError;
  return data.map((entry) => entry.signedUrl);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const service = createServiceClient();

  try {
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json();
      if (body.action !== "create_link" || !await requireSuperAdmin(req)) {
        return json({ error: "Forbidden" }, 403);
      }
      const restaurantId = String(body.restaurantId ?? "");
      const { data: restaurant } = await service.from("restaurants")
        .select("id, name")
        .eq("id", restaurantId)
        .maybeSingle();
      if (!restaurant) return json({ error: "Restaurant not found" }, 404);
      const token = await signToken({
        restaurantId,
        purpose: "prospect-photo-upload",
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
      }, TOKEN_SECRET);
      return json({
        url: `${APP_URL}/upload/${restaurantId}?token=${encodeURIComponent(token)}`,
        photos: await listPhotos(service, restaurantId),
      });
    }

    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const access = await authorizeToken(token);
    if (!access) return json({ error: "Invalid or expired link" }, 401);

    const { data: restaurant } = await service.from("restaurants")
      .select("id, name")
      .eq("id", access.restaurantId)
      .maybeSingle();
    if (!restaurant) return json({ error: "Restaurant not found" }, 404);

    if (req.method === "GET") {
      return json({ restaurantName: restaurant.name, photos: await listPhotos(service, restaurant.id) });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)
      || file.size < 1
      || file.size > MAX_FILE_SIZE
      || !ALLOWED_TYPES.has(file.type)) {
      return json({ error: "Unsupported file" }, 400);
    }
    const extension = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${restaurant.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await service.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600",
    });
    if (uploadError) throw uploadError;
    const { data: signed } = await service.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
    return json({ url: signed?.signedUrl });
  } catch (error) {
    console.error("[photo-upload]", error);
    return json({ error: "Upload service unavailable" }, 500);
  }
});
