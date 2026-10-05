import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ native: false, share: vi.fn(), web: vi.fn(), copy: vi.fn() }));
vi.mock('@/lib/native', () => ({ isNative: () => api.native }));
vi.mock('@capacitor/share', () => ({ Share: { share: api.share } }));
import { discoveryUrl, shareAppDiscovery } from '@/services/app-discovery-share';
beforeEach(() => {
  api.native = false; vi.clearAllMocks(); api.share.mockResolvedValue({ activityType: 'com.apple.UIKit.activity.CopyToPasteboard' }); api.web.mockResolvedValue(undefined); api.copy.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'share', { configurable: true, value: api.web });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: api.copy } });
});
it('uses the native sheet only on a deliberate call and the public link', async () => {
  api.native = true;
  expect(api.share).not.toHaveBeenCalled();
  expect(await shareAppDiscovery('CommandeIci', 'Retrait sur place')).toBe('shared');
  expect(api.share).toHaveBeenCalledWith({ title: 'CommandeIci', text: 'Retrait sur place', url: discoveryUrl });
});
it('uses the web share sheet when available', async () => {
  expect(await shareAppDiscovery('CommandeIci', 'Retrait sur place')).toBe('shared');
  expect(api.web).toHaveBeenCalledWith({ title: 'CommandeIci', text: 'Retrait sur place', url: discoveryUrl });
});
it('treats web and native cancellation without a copy or failure alarm', async () => {
  api.web.mockRejectedValue(new DOMException('User cancelled', 'AbortError'));
  expect(await shareAppDiscovery('CommandeIci', 'Retrait sur place')).toBe('cancelled');
  api.native = true; api.share.mockRejectedValue(new Error('Share canceled'));
  expect(await shareAppDiscovery('CommandeIci', 'Retrait sur place')).toBe('cancelled');
  expect(api.copy).not.toHaveBeenCalled();
});
it('offers a clipboard fallback when a sheet cannot be opened', async () => {
  api.web.mockRejectedValue(new DOMException('Unsupported', 'NotAllowedError'));
  expect(await shareAppDiscovery('CommandeIci', 'Retrait sur place')).toBe('copied');
  expect(api.copy).toHaveBeenCalledWith('Retrait sur place\nhttps://commandeici.com');
});
it('reports unavailable rather than pretending a failed clipboard copy succeeded', async () => {
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }); api.copy.mockRejectedValue(new Error('Denied'));
  expect(await shareAppDiscovery('CommandeIci', 'Retrait sur place')).toBe('unavailable');
});
