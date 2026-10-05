import { Share } from '@capacitor/share';
import { isNative } from '@/lib/native';
export const discoveryUrl = 'https://commandeici.com';
export type DiscoveryShareResult = 'shared' | 'copied' | 'cancelled' | 'unavailable';
export async function shareAppDiscovery(title: string, text: string): Promise<DiscoveryShareResult> {
  try {
    const payload = { title, text, url: discoveryUrl };
    if (isNative()) { await Share.share(payload); return 'shared'; }
    if (navigator.share) { await navigator.share(payload); return 'shared'; }
  } catch (error) {
    if ((error instanceof DOMException && error.name === 'AbortError') || (error instanceof Error && /cancel(?:l)?ed|dismissed/i.test(error.message))) return 'cancelled';
  }
  try { await navigator.clipboard.writeText(`${text}\n${discoveryUrl}`); return 'copied'; }
  catch { return 'unavailable'; }
}
