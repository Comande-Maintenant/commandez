import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCustomerProfile,
  upsertCustomerProfile,
  updateCustomerProfile as apiUpdateProfile,
  linkOrdersToUser,
  type CustomerProfile,
} from "@/lib/api";
import { registerCustomer, type RegistrationResult } from '@/services/account-registration';
import { authRedirectUrl } from '@/lib/native';
import type { User } from "@supabase/supabase-js";

interface CustomerAuthContextValue {
  user: User | null;
  profile: CustomerProfile | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, name: string, phone?: string, redirect?: '/profil' | '/order') => Promise<RegistrationResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: Partial<Pick<CustomerProfile, "name" | "phone" | "default_order_type">>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isCustomerUser = useCallback((u: User | null): boolean => {
    if (!u) return false;
    const role = u.user_metadata?.role;
    // Accept customer role or no role (not owner)
    return role === "customer" || (!role && !u.user_metadata?.is_owner);
  }, []);

  const revisionRef = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  const authUserIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const current = useCallback((u: User, revision: number) =>
    mountedRef.current && revisionRef.current === revision && currentUserIdRef.current === u.id, []);

  const beginSession = useCallback((candidate: User | null) => {
    const revision = ++revisionRef.current;
    const next = isCustomerUser(candidate) ? candidate : null;
    authUserIdRef.current = candidate?.id || null;
    if (currentUserIdRef.current !== (next?.id || null)) {
      setProfile(null);
      try { localStorage.removeItem("cm_customer"); } catch { /* preferences are optional */ }
    }
    currentUserIdRef.current = next?.id || null;
    setUser(next);
    setIsLoading(Boolean(next));
    return { next, revision };
  }, [isCustomerUser]);

  const loadProfile = useCallback(async (u: User, revision: number) => {
    if (!current(u, revision)) return;
    try {
      let p = await fetchCustomerProfile(u.id);
      if (!current(u, revision)) return;
      if (!p && u.email_confirmed_at && u.email) {
        await upsertCustomerProfile({ id: u.id, email: u.email, name: u.user_metadata?.name || u.email.split('@')[0], phone: u.user_metadata?.phone || null });
        if (!current(u, revision)) return;
        await linkOrdersToUser(u.id, u.email, u.user_metadata?.phone).catch(() => {});
        if (!current(u, revision)) return;
        p = await fetchCustomerProfile(u.id);
      }
      if (!current(u, revision)) return;
      // Never apply a response belonging to a different authenticated customer.
      if (p && p.id !== u.id) { setProfile(null); return; }
      setProfile(p);
      if (p) {
        try { localStorage.setItem("cm_customer", JSON.stringify({
          name: p.name, phone: p.phone || "", email: p.email,
        })); } catch { /* a valid profile does not depend on preferences storage */ }
      }
    } catch {
      if (current(u, revision)) setProfile(null);
    } finally {
      if (current(u, revision)) setIsLoading(false);
    }
  }, [current]);

  useEffect(() => {
    mountedRef.current = true;
    const initialRevision = revisionRef.current;
    supabase.auth.getSession().then(({ data: { session } }) => {
      // A newer auth event wins over the initial asynchronous storage read.
      if (!mountedRef.current || revisionRef.current !== initialRevision) return;
      const { next, revision } = beginSession(session?.user || null);
      if (next) void loadProfile(next, revision);
    }).catch(() => {
      if (mountedRef.current && revisionRef.current === initialRevision) beginSession(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      const { next, revision } = beginSession(session?.user || null);
      // Supabase auth listeners must return before querying the authenticated API.
      if (next) setTimeout(() => { void loadProfile(next, revision); }, 0);
    });
    return () => {
      mountedRef.current = false;
      revisionRef.current++;
      subscription.unsubscribe();
    };
  }, [beginSession, loadProfile]);

  const signUp = useCallback(async (email: string, password: string, name: string, phone?: string, redirect: '/profil' | '/order' = '/profil') => {
    const result = await registerCustomer(email, password, name, phone || '', authRedirectUrl(redirect));
    if (result === 'ready') {
      const { data: { user: confirmed } } = await supabase.auth.getUser();
      if (confirmed) { const { next, revision } = beginSession(confirmed); if (next) await loadProfile(next, revision); }
    }
    return result;
  }, [beginSession, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const startedRevision = revisionRef.current;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("Connexion échouée");
    if (!mountedRef.current || (revisionRef.current !== startedRevision && authUserIdRef.current !== data.user.id)) return;

    // Check not an owner
    const role = data.user.user_metadata?.role;
    if (role === "owner" || data.user.user_metadata?.is_owner) {
      await supabase.auth.signOut();
      throw new Error("Ce compte est un compte restaurateur. Utilisez la page admin.");
    }

    const { next, revision } = beginSession(data.user);
    if (next) await loadProfile(next, revision);
  }, [beginSession, loadProfile]);

  const signOut = useCallback(async () => {
    beginSession(null);
    try { localStorage.removeItem("cm_customer"); } catch { /* preferences are optional */ }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [beginSession]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl('/reinitialiser-mot-de-passe') });
    if (error) throw error;
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Pick<CustomerProfile, "name" | "phone" | "default_order_type">>) => {
    if (!user) return;
    const revision = revisionRef.current;
    await apiUpdateProfile(user.id, updates);
    if (!current(user, revision)) return;
    setProfile((prev) => prev?.id === user.id ? { ...prev, ...updates, updated_at: new Date().toISOString() } : prev);
    // Sync localStorage
    if (updates.name || updates.phone) {
      try {
        const raw = localStorage.getItem("cm_customer");
        const current = raw ? JSON.parse(raw) : {};
        if (updates.name) current.name = updates.name;
        if (updates.phone !== undefined) current.phone = updates.phone || "";
        localStorage.setItem("cm_customer", JSON.stringify(current));
      } catch { /* ignore */ }
    }
  }, [user, current]);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('delete_own_account' as never, { p_confirmation: 'DELETE' } as never);
    if (error || !(data as { deleted?: boolean })?.deleted) throw new Error('La suppression du compte a échoué. Réessayez.');
    if (currentUserIdRef.current !== user.id) return;
    beginSession(null);
    await supabase.auth.signOut();
    try { localStorage.removeItem("cm_customer"); } catch { /* preferences are optional */ }
  }, [user, beginSession]);

  const isLoggedIn = !!user && profile?.id === user.id;

  return (
    <CustomerAuthContext.Provider value={{
      user,
      profile,
      isLoggedIn,
      isLoading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updateProfile,
      deleteAccount,
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  return ctx;
}
