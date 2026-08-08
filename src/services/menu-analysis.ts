import { supabase } from '@/integrations/supabase/client';
import type { AnalyzedMenu } from '@/types/onboarding';

export async function analyzeMenuImages(files: File[]): Promise<AnalyzedMenu> {
  const imageUrls: string[] = [];
  const uploadedPaths: string[] = [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const fileName = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('menu-uploads')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      continue;
    }

    uploadedPaths.push(fileName);
    const { data: urlData } = await supabase.storage
      .from('menu-uploads')
      .createSignedUrl(fileName, 15 * 60);

    if (urlData?.signedUrl) {
      imageUrls.push(urlData.signedUrl);
    }
  }

  if (imageUrls.length === 0) {
    throw new Error('No images uploaded successfully');
  }

  try {
    const { data, error } = await supabase.functions.invoke('analyze-menu', {
      body: { imageUrls },
    });
    if (error) throw error;
    return { categories: data?.categories ?? [] };
  } finally {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from('menu-uploads').remove(uploadedPaths);
    }
  }
}
