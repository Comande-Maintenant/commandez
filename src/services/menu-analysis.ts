import { supabase } from '@/integrations/supabase/client';
import type { AnalyzedMenu } from '@/types/onboarding';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getMediaType(file: File): string {
  const type = file.type;
  if (type === 'image/jpeg' || type === 'image/jpg') return 'image/jpeg';
  if (type === 'image/png') return 'image/png';
  if (type === 'image/gif') return 'image/gif';
  if (type === 'image/webp') return 'image/webp';
  // Default to jpeg for converted HEIC etc.
  return 'image/jpeg';
}

export async function analyzeMenuImages(files: File[]): Promise<AnalyzedMenu> {
  const images: { base64: string; media_type: string }[] = [];

  for (const file of files) {
    try {
      const base64 = await fileToBase64(file);
      const media_type = getMediaType(file);
      images.push({ base64, media_type });
    } catch (err) {
      console.error('Base64 conversion error:', err);
    }
  }

  if (images.length === 0) {
    throw new Error('No images converted successfully');
  }

  const { data, error } = await supabase.functions.invoke('analyze-menu', {
    body: { images },
  });

  if (error) throw error;

  return { categories: data?.categories ?? [] };
}
