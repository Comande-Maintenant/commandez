import { supabase } from '@/integrations/supabase/client';
import type { AnalyzedMenu } from '@/types/onboarding';

export async function analyzeMenuImages(files: File[]): Promise<AnalyzedMenu> {
  const imageUrls: string[] = [];

  for (const file of files) {
    const fileName = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('menu-uploads')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from('menu-uploads')
      .getPublicUrl(fileName);

    if (urlData?.publicUrl) {
      imageUrls.push(urlData.publicUrl);
    }
  }

  if (imageUrls.length === 0) {
    throw new Error('No images uploaded successfully');
  }

  const { data, error } = await supabase.functions.invoke('analyze-menu', {
    body: { imageUrls },
  });

  if (error) throw error;

  return { categories: data?.categories ?? [] };
}
