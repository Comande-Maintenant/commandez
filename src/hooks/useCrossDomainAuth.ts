import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const COOKIE_DOMAIN = ".commandeici.com";
const isCommandeiciDomain = typeof window !== "undefined" && window.location.hostname.endsWith("commandeici.com");

function setUserCookie() {
  if (isCommandeiciDomain) {
    document.cookie = `commandeici_user=1; domain=${COOKIE_DOMAIN}; path=/; secure; samesite=lax; max-age=2592000`;
  }
}

function removeUserCookie() {
  if (isCommandeiciDomain) {
    document.cookie = `commandeici_user=; domain=${COOKIE_DOMAIN}; path=/; max-age=0`;
  }
}

/**
 * Listens to Supabase auth state and sets/removes a simple cookie
 * readable by the Shopify theme (commandeici.com) to toggle the gate.
 */
export function useCrossDomainAuth() {
  useEffect(() => {
    // Set cookie if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserCookie();
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session?.user) setUserCookie();
      } else if (event === "SIGNED_OUT") {
        removeUserCookie();
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);
}
