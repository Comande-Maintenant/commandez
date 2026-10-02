import { supabase } from '@/integrations/supabase/client';
import { createOwner } from '@/services/onboarding';
import { upsertCustomerProfile } from '@/lib/api';

export type RegistrationResult = 'ready' | 'confirmation';

export async function registerOwner(email: string, password: string, phone: string, redirect: string): Promise<RegistrationResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(), password,
    options: { data: { role: 'owner', phone }, emailRedirectTo: redirect },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Inscription échouée');
  if (!data.session) return 'confirmation';
  await createOwner(data.user.id, data.user.email || email.trim(), phone);
  return 'ready';
}

export async function registerCustomer(email: string, password: string, name: string, phone: string, redirect: string): Promise<RegistrationResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(), password,
    options: { data: { role: 'customer', name, phone }, emailRedirectTo: redirect },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Inscription échouée');
  if (!data.session) return 'confirmation';
  await upsertCustomerProfile({ id: data.user.id, name, email: data.user.email || email.trim(), phone: phone || null });
  return 'ready';
}
