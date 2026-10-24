import { randomUuid } from '@/lib/uuid';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import type { AnalyzedMenu } from '@/types/onboarding';

// The upstream analysis functions cap model output at 4096/8192 tokens.
// These generous transport/collection budgets prevent disproportionate validation work.
const MAX_MENU_RESPONSE_BYTES = 1024 * 1024;
const MAX_MENU_COLLECTION_LENGTH = 4096;

const optionSchema = z.object({ name: z.string().trim().min(1), price: z.number().finite().nonnegative() });
const menuSchema = z.object({ categories: z.array(z.object({
  name: z.string().trim().min(1),
  items: z.array(z.object({
    name: z.string().trim().min(1), price: z.number().finite().nonnegative(),
    description: z.string().default(''), variants: z.array(optionSchema).max(MAX_MENU_COLLECTION_LENGTH).optional(),
    supplements: z.array(optionSchema).max(MAX_MENU_COLLECTION_LENGTH).optional(), tags: z.array(z.string()).max(MAX_MENU_COLLECTION_LENGTH).optional(),
  })).min(1).max(MAX_MENU_COLLECTION_LENGTH),
})).min(1).max(MAX_MENU_COLLECTION_LENGTH) });

export async function analyzeMenuImages(files: File[]): Promise<AnalyzedMenu> {
  if (files.length === 0 || files.length > 5) throw new Error('Choisissez entre 1 et 5 fichiers.');
  const imageUrls: string[] = [];
  const uploadedPaths: string[] = [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  try {
    for (const file of files) {
      const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/jpeg' ? 'jpg'
        : file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const fileName = `${user.id}/${randomUuid()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('menu-uploads').upload(fileName, file);
      if (uploadError) throw uploadError;
      uploadedPaths.push(fileName);
      const { data: urlData, error: urlError } = await supabase.storage.from('menu-uploads').createSignedUrl(fileName, 15 * 60);
      if (urlError) throw urlError;
      if (!urlData?.signedUrl) throw new Error('Impossible de préparer un fichier. Réessayez.');
      imageUrls.push(urlData.signedUrl);
    }
    const { data, error } = await supabase.functions.invoke('analyze-menu', { body: { imageUrls } });
    if (error) throw error;
    const serialized = JSON.stringify(data);
    if (typeof serialized !== 'string' || serialized.length > MAX_MENU_RESPONSE_BYTES
      || new TextEncoder().encode(serialized).byteLength > MAX_MENU_RESPONSE_BYTES) {
      throw new Error('La carte n’a pas pu être lue. Essayez une photo plus nette.');
    }
    if (data?.error) throw new Error(data.error);
    const parsed = menuSchema.safeParse(data);
    if (!parsed.success) throw new Error('La carte n’a pas pu être lue. Essayez une photo plus nette.');
    // The schema validates every required field; TS has strictNullChecks disabled here.
    return parsed.data as AnalyzedMenu;
  } finally {
    if (uploadedPaths.length > 0) {
      try {
        const { error } = await supabase.storage.from('menu-uploads').remove(uploadedPaths);
        if (error) console.warn('[menu-analysis] Temporary upload cleanup failed');
      } catch {
        console.warn('[menu-analysis] Temporary upload cleanup failed');
      }
    }
  }
}
