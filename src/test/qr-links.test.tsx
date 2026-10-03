import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ png: vi.fn(async (_url: string, _options: any) => 'data:image/png;base64,fixture'), svg: vi.fn(async (_url: string, _options: any) => '<svg/>'), success: vi.fn(), error: vi.fn() }));
vi.mock('qrcode', () => ({ default: { toDataURL: mocks.png, toString: mocks.svg } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
import { DashboardQRCodes } from '@/components/dashboard/DashboardQRCodes';
import { readableQrColor } from '@/lib/qr';
import { DashboardBorneClient } from '@/components/dashboard/DashboardBorneClient';
import type { DbRestaurant } from '@/types/database';
const restaurant = { slug: 'chez-alice-paris', name: 'Chez Alice', primary_color: '#ffffff' } as DbRestaurant;
beforeEach(() => vi.clearAllMocks());
describe('merchant QR links', () => {
  it.each(['#ffffff', '#fff', '#f4a261', 'transparent', '#00000000', 'invalid'])('falls back to readable black for %s', color => {
    expect(readableQrColor(color)).toBe('#000000');
  });
  it('preserves a sufficiently dark merchant color', () => {
    expect(readableQrColor('#1d4ed8')).toBe('#1d4ed8');
  });
  it('prevents generating an empty printable sheet before the QR is ready', async () => {
    let release!: (value: string) => void;
    mocks.png.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    render(<DashboardQRCodes restaurant={restaurant}/>);
    expect(screen.getByRole('button', { name: 'dashboard.qr.download_a4' })).toBeDisabled();
    release('data:image/png;base64,fixture');
    await waitFor(() => expect(screen.getByRole('button', { name: 'dashboard.qr.download_a4' })).toBeEnabled());
  });
  it('encodes public HTTPS links and readable QR codes regardless of merchant color', async () => {
    render(<DashboardQRCodes restaurant={restaurant}/>);
    await waitFor(() => expect(mocks.png).toHaveBeenCalledTimes(4));
    expect(mocks.png.mock.calls.map(call => call[0])).toEqual([
      'https://app.commandeici.com/chez-alice-paris',
      'https://app.commandeici.com/chez-alice-paris',
      'https://app.commandeici.com/admin/chez-alice-paris?tab=caisse',
      'https://app.commandeici.com/chez-alice-paris',
    ]);
    for (const [, options] of mocks.png.mock.calls) {
      expect(options.margin).toBeGreaterThanOrEqual(4);
      expect(options.color.dark).not.toBe('#ffffff');
    }
  });
  it('reports denied clipboard writes without falsely marking the link copied', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<DashboardQRCodes restaurant={restaurant}/>);
    fireEvent.click(screen.getByRole('button', { name: 'common.copy' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('common.toast.copy_error'));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeVisible();
  });
  it('regenerates a public kiosk QR including table and takeaway configuration', async () => {
    render(<DashboardBorneClient restaurant={restaurant}/>);
    await waitFor(() => expect(mocks.png).toHaveBeenCalled());
    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getAllByRole('switch')[1]);
    await waitFor(() => expect(mocks.png).toHaveBeenLastCalledWith(
      'https://app.commandeici.com/chez-alice-paris?kiosk=true&modes=surplace%2Cemporter&table=ask',
      expect.objectContaining({ margin: 4 })
    ));
  });
});
