import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateVisitorId, detectDevice } from "@/lib/visitorUtils";

const SESSION_KEY = "cm_session_id";

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** Classify page path into a type and side (user vs restaurateur) */
function classifyPage(path: string): { page_type: string; side: string; restaurant_slug: string | null } {
  if (path === "/") return { page_type: "landing", side: "user", restaurant_slug: null };
  if (path === "/demo") return { page_type: "demo", side: "user", restaurant_slug: null };
  if (path.startsWith("/admin/")) return { page_type: "admin", side: "restaurateur", restaurant_slug: path.split("/")[2] || null };
  if (path === "/inscription") return { page_type: "inscription", side: "restaurateur", restaurant_slug: null };
  if (path === "/connexion") return { page_type: "connexion", side: "restaurateur", restaurant_slug: null };
  if (path === "/order") return { page_type: "order", side: "user", restaurant_slug: null };
  if (path.startsWith("/suivi/")) return { page_type: "suivi", side: "user", restaurant_slug: null };
  if (path === "/profil") return { page_type: "profil", side: "user", restaurant_slug: null };
  if (path === "/abonnement" || path === "/choisir-plan" || path === "/abonnement-confirme") return { page_type: "abonnement", side: "restaurateur", restaurant_slug: null };
  if (path === "/super-admin") return { page_type: "super_admin", side: "restaurateur", restaurant_slug: null };
  if (path.startsWith("/upload/")) return { page_type: "upload", side: "restaurateur", restaurant_slug: null };
  // /:slug = restaurant menu page
  const slug = path.slice(1);
  if (slug && !slug.includes("/")) return { page_type: "menu", side: "user", restaurant_slug: slug };
  return { page_type: "other", side: "user", restaurant_slug: null };
}

function getUtmParams(): { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null } {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
  };
}

function getReferrer(): string | null {
  if (!document.referrer) return null;
  try {
    const ref = new URL(document.referrer);
    if (ref.host === window.location.host) return null; // same-site navigation
    return ref.host;
  } catch {
    return null;
  }
}

/**
 * Tracks page views by inserting into page_views table on each navigation.
 * Must be rendered inside BrowserRouter and LanguageProvider.
 */
export function usePageTracking() {
  const location = useLocation();
  const lastPath = useRef<string>("");

  useEffect(() => {
    // Skip duplicate tracking for the same path
    const fullPath = location.pathname;
    if (fullPath === lastPath.current) return;
    lastPath.current = fullPath;

    // Don't track super-admin views (that's us, not real traffic)
    if (fullPath === "/super-admin") return;

    const { page_type, side } = classifyPage(fullPath);
    const utms = getUtmParams();
    const language = localStorage.getItem("cm_language") || "fr";

    // Fire and forget - don't block navigation
    supabase.from("page_views").insert({
      session_id: getOrCreateSessionId(),
      visitor_id: getOrCreateVisitorId(),
      page_path: fullPath,
      page_type,
      side,
      referrer: getReferrer(),
      utm_source: utms.utm_source,
      utm_medium: utms.utm_medium,
      utm_campaign: utms.utm_campaign,
      device: detectDevice(),
      language,
      user_agent: navigator.userAgent,
      screen_width: window.innerWidth,
    }).then(({ error }) => {
      if (error) console.warn("[page-tracking] insert error:", error.message);
    });
  }, [location.pathname]);
}
