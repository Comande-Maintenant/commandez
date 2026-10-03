import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ native: false, share: vi.fn(), open: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native }, registerPlugin: () => ({ share: mocks.share, openExternalUrl: mocks.open }) }));
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn(), open: vi.fn() } }));
import { exportPublicFile, openExternalUrl } from '@/lib/native';

beforeEach(() => { mocks.native = true; vi.clearAllMocks(); });
describe('public file export on iOS and web', () => {
  it('opens an HTTPS OAuth URL in the system browser on iOS', async () => {
    mocks.open.mockResolvedValue({});
    const url = 'https://tgtvkzmokypztdudwzne.supabase.co/auth/v1/authorize?provider=google';
    await openExternalUrl(url);
    expect(mocks.open).toHaveBeenCalledWith({ url });
  });
  it.each(['http://example.test', 'file:///tmp/qr.pdf', 'javascript:alert(1)', 'https://user:password@example.test', 'https://example.test:444'])('rejects unsafe external browser URL %s', async url => {
    await expect(openExternalUrl(url)).rejects.toThrow();
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it('hands the actual PDF bytes and filename to the iOS share sheet', async () => {
    mocks.share.mockResolvedValue({ completed: true });
    expect(await exportPublicFile('data:application/pdf;base64,JVBERg==', 'qr-chez-alice.pdf', 'application/pdf')).toBe(true);
    expect(mocks.share).toHaveBeenCalledWith({ base64: 'JVBERg==', filename: 'qr-chez-alice.pdf', mimeType: 'application/pdf' });
  });
  it('preserves UTF-8 SVG bytes for native file sharing', async () => {
    mocks.share.mockResolvedValue({ completed: true });
    await exportPublicFile('<svg>é</svg>', 'qr.svg', 'image/svg+xml');
    const base64 = mocks.share.mock.calls[0][0].base64;
    expect(new TextDecoder().decode(Uint8Array.from(atob(base64), character => character.charCodeAt(0)))).toBe('<svg>é</svg>');
  });
  it('does not report a cancelled share sheet as a successful download', async () => {
    mocks.share.mockResolvedValue({ completed: false });
    expect(await exportPublicFile('data:image/png;base64,YQ==', 'qr.png', 'image/png')).toBe(false);
  });
  it('surfaces a native export failure to the calling UI', async () => {
    mocks.share.mockRejectedValue(new Error('File export failed'));
    await expect(exportPublicFile('data:image/png;base64,YQ==', 'qr.png', 'image/png')).rejects.toThrow('File export failed');
  });
  it('rejects mismatched data URLs and unsupported files before plugin invocation', async () => {
    await expect(exportPublicFile('data:text/html;base64,YQ==', 'qr.png', 'image/png')).rejects.toThrow();
    await expect(exportPublicFile('x', '../qr.svg', 'image/svg+xml')).rejects.toThrow();
    expect(mocks.share).not.toHaveBeenCalled();
  });
  it('keeps normal browser downloads working without calling an iOS plugin', async () => {
    mocks.native = false;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await exportPublicFile('data:image/png;base64,YQ==', 'qr.png', 'image/png');
    expect(click).toHaveBeenCalled();
    expect(mocks.share).not.toHaveBeenCalled();
    click.mockRestore();
  });
});
