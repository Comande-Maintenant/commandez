import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCustomerProfile,
  upsertCustomerProfile,
  updateCustomerProfile as apiUpdateProfile,
  deleteCustomerProfile as apiDeleteProfile,
  linkOrdersToUser,
  type CustomerProfile,
} from "@/lib/api";
import type { User } from "@supabase/supabase-js";

interface CustomerAuthContextValue {
  user: User | null;
  profile: CustomerProfile | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<void>;
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
      const p = await fetchCustomerProfile(u.id);
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && isCustomerUser(session.user)) {
        setUser(session.user);
        loadProfile(session.user);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && isCustomerUser(session.user)) {
        setUser(session.user);
        loadProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, [isCustomerUser, loadProfile]);

  const signUp = useCallback(async (email: string, password: string, name: string, phone?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "customer", name, phone: phone || "" },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Inscription echouee");

    // Create profile row
    await upsertCustomerProfile({
      id: data.user.id,
      name,
      email,
      phone: phone || null,
    });

    // Link existing orders by email/phone
    await linkOrdersToUser(data.user.id, email, phone).catch(() => {});

    // Set state
    setUser(data.user);
    const p = await fetchCustomerProfile(data.user.id);
    setProfile(p);

    // Sync localStorage
    localStorage.setItem("cm_customer", JSON.stringify({ name, phone: phone || "", email }));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error("Connexion echouee");

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
    const { error } = await supabase.auth.resetPasswordForEmail(email);
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
    await apiDeleteProfile(user.id);
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
