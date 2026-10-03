import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
const f = vi.hoisted(() => ({ sync: vi.fn(), getSession: vi.fn(), native: vi.fn(() => true) }));
vi.mock('@/lib/native', () => ({ isNative: f.native }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: f.getSession } } }));
vi.mock('@/services/native-push-client', () => ({ nativePush: { sync: f.sync, enable: vi.fn() }, nativePushStatus: () => 'prompt', subscribeNativePush: () => () => {} }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
import { NativeOrderNotifications } from '@/components/NativeOrderNotifications';
const owner = '520191e5-1b13-4b56-8c69-ae36ac03df1b';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('offers notifications immediately after the first restaurant is created', async () => {
  f.getSession.mockResolvedValue({ data: { session: { user: { id: owner } } }, error: null });
  render(<NativeOrderNotifications ownerUserId={owner} />);
  await vi.waitFor(() => expect(f.sync).toHaveBeenCalledWith(owner));
});
it('never activates a device for a stale or different merchant account', async () => {
  f.getSession.mockResolvedValue({ data: { session: { user: { id: 'different-user' } } }, error: null });
  render(<NativeOrderNotifications ownerUserId={owner} />);
  await vi.waitFor(() => expect(f.getSession).toHaveBeenCalled());
  expect(f.sync).not.toHaveBeenCalled();
});
