import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthorizedUser = { id: string; email?: string };

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function requireUser(req: Request): Promise<AuthorizedUser | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const service = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}

export async function requireSuperAdmin(req: Request): Promise<AuthorizedUser | null> {
  const user = await requireUser(req);
  if (!user) return null;
  const service = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const { data } = await service
    .from("owners")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return data?.role === "super_admin" ? user : null;
}

export function isServiceRole(req: Request): boolean {
  const token = bearerToken(req);
  if (!token) return false;
  try {
    const payload = token.split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const decoded = JSON.parse(atob(payload));
    return decoded?.role === "service_role";
  } catch {
    return false;
  }
}
