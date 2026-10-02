import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<RegistrationResult>;
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

  const loadProfile = useCallback(async (u: User) => {
    try {
      let p = await fetchCustomerProfile(u.id);
      if (!p && u.email_confirmed_at && u.email) {
        await upsertCustomerProfile({ id: u.id, email: u.email, name: u.user_metadata?.name || u.email.split('@')[0], phone: u.user_metadata?.phone || null });
        await linkOrdersToUser(u.id, u.email, u.user_metadata?.phone).catch(() => {});
        p = await fetchCustomerProfile(u.id);
      }
      setProfile(p);
      if (p) {
        // Sync with cm_customer localStorage for compatibility
        localStorage.setItem("cm_customer", JSON.stringify({
          name: p.name,
          phone: p.phone || "",
          email: p.email,
        }));
      }
    } catch {
      // Profile may not exist yet
      setProfile(null);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && isCustomerUser(session.user)) {
        setUser(session.user);
        await loadProfile(session.user);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && isCustomerUser(session.user)) {
        setUser(session.user);
        setIsLoading(true);
        setTimeout(() => { void loadProfile(session.user).finally(() => setIsLoading(false)); }, 0);
      } else {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, [isCustomerUser, loadProfile]);

  const signUp = useCallback(async (email: string, password: string, name: string, phone?: string) => {
    const result = await registerCustomer(email, password, name, phone || '', authRedirectUrl('/profil'));
    if (result === 'ready') {
      const { data: { user: confirmed } } = await supabase.auth.getUser();
      if (confirmed) { setUser(confirmed); await loadProfile(confirmed); }
    }
    return result;
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("Connexion échouée");

    // Check not an owner
    const role = data.user.user_metadata?.role;
    if (role === "owner" || data.user.user_metadata?.is_owner) {
      await supabase.auth.signOut();
      throw new Error("Ce compte est un compte restaurateur. Utilisez la page admin.");
    }

    setUser(data.user);
    await loadProfile(data.user);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    // Clear cm_customer to avoid stale data
    localStorage.removeItem("cm_customer");
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl('/reinitialiser-mot-de-passe') });
    if (error) throw error;
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Pick<CustomerProfile, "name" | "phone" | "default_order_type">>) => {
    if (!user) return;
    await apiUpdateProfile(user.id, updates);
    setProfile((prev) => prev ? { ...prev, ...updates, updated_at: new Date().toISOString() } : prev);
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
  }, [user]);

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('delete_own_account' as never, { p_confirmation: 'DELETE' } as never);
    if (error || !(data as { deleted?: boolean })?.deleted) throw new Error('La suppression du compte a échoué. Réessayez.');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    localStorage.removeItem("cm_customer");
  }, [user]);

  const isLoggedIn = !!user && !!profile;

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
