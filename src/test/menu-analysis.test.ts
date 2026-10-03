import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), upload: vi.fn(), createSignedUrl: vi.fn(), remove: vi.fn(), invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: mocks.getUser }, functions: { invoke: mocks.invoke }, storage: { from: () => mocks } } }));
import { analyzeMenuImages } from '@/services/menu-analysis';
const page = () => new File(['image'], 'menu.jpg', { type: 'image/jpeg' });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-1' } } });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.com/signed.jpg' }, error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.invoke.mockResolvedValue({ data: { categories: [{ name: 'Plats', items: [{ name: 'Pizza', price: 9, description: '' }] }] }, error: null });
  vi.stubGlobal('crypto', { randomUUID: () => 'file-id' });
});
describe('Menu upload and analysis reliability', () => {
  it('rejects too many pages before uploading', async () => {
    await expect(analyzeMenuImages(Array.from({ length: 6 }, page))).rejects.toThrow();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('fails a partial upload without sending an incomplete menu to analysis', async () => {
    mocks.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: new Error('upload failed') });
    await expect(analyzeMenuImages([page(), page()])).rejects.toThrow();
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalled();
  });
  it('cleans uploaded files when signed URL creation fails', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: new Error('sign failed') });
    await expect(analyzeMenuImages([page()])).rejects.toThrow();
    expect(mocks.remove).toHaveBeenCalledWith(['owner-1/file-id.jpg']);
  });
  it('propagates an analysis error body and cleans temporary uploads', async () => {
    mocks.invoke.mockResolvedValue({ data: { error: 'Model unavailable' }, error: null });
    await expect(analyzeMenuImages([page()])).rejects.toThrow('Model unavailable');
    expect(mocks.remove).toHaveBeenCalled();
  });
  it('rejects invalid prices returned by analysis', async () => {
    mocks.invoke.mockResolvedValue({ data: { categories: [{ name: 'Plats', items: [{ name: 'Pizza', price: -9 }] }] }, error: null });
    await expect(analyzeMenuImages([page()])).rejects.toThrow();
  });
  it('returns a valid analyzed menu and removes temporary files', async () => {
    expect((await analyzeMenuImages([page()])).categories[0].items[0].price).toBe(9);
    expect(mocks.remove).toHaveBeenCalled();
  });
});
