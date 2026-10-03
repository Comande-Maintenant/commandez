import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';

const f = vi.hoisted(() => ({
  sync: vi.fn(), dispose: vi.fn(), getUser: vi.fn(), owned: vi.fn(),
  authChange: null as null | ((event: string, session: { user: { id: string } } | null) => void),
  unsubscribe: vi.fn(), appListener: vi.fn(), pushListener: vi.fn(),
  subscriptions: [] as Array<unknown>, autoInitial: false,
  action: null as null | ((event: { notification: { data: Record<string, unknown> } }) => Promise<void>),
}));
vi.mock('@/lib/native', () => ({ isNative: () => true }));
vi.mock('@/services/native-push-client', () => ({ nativePush: { sync: f.sync, dispose: f.dispose } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: f.appListener } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: { addListener: f.pushListener } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: f.getUser, onAuthStateChange: (callback: typeof f.authChange) => {
    f.authChange = callback; f.subscriptions.push(callback);
    if (f.autoInitial) queueMicrotask(() => callback!('INITIAL_SESSION', { user: { id: '520191e5-1b13-4b56-8c69-ae36ac03df1b' } }));
    return { data: { subscription: { unsubscribe: f.unsubscribe } } };
  } },
  from: () => ({ select: () => ({ eq: f.owned }) }),
} }));
import { NativePushLifecycle } from '@/components/NativePushLifecycle';

const first = '520191e5-1b13-4b56-8c69-ae36ac03df1b';
const second = '620191e5-1b13-4b56-8c69-ae36ac03df1b';
beforeEach(() => {
  vi.resetAllMocks(); f.authChange = null; f.action = null;
  f.subscriptions.length = 0; f.autoInitial = false;
  f.appListener.mockResolvedValue({ remove: vi.fn() });
  f.pushListener.mockImplementation(async (_event, callback) => { f.action = callback; return { remove: vi.fn() }; });
  f.sync.mockResolvedValue(undefined); f.dispose.mockResolvedValue(undefined);
  f.getUser.mockResolvedValue({ data: { user: { id: first } }, error: null });
  f.owned.mockResolvedValue({ data: [{ slug: 'chez-alice' }], error: null });
});
afterEach(cleanup);

function RouterProbe() {
  const location = useLocation();
  return <><output aria-label="current-route">{location.pathname}{location.search}</output><Link to="/profil">Profile</Link></>;
}

describe('push identity lifecycle', () => {
  async function mounted() {
    render(<MemoryRouter><NativePushLifecycle /></MemoryRouter>);
    f.authChange!('INITIAL_SESSION', { user: { id: first } });
    await vi.waitFor(() => expect(f.sync).toHaveBeenCalledWith(first));
    f.sync.mockClear();
  }

  it('neutralizes a changed account before its ownership lookup finishes', async () => {
    await mounted();
    let release!: (value: { data: { slug: string }[]; error: null }) => void;
    f.getUser.mockResolvedValue({ data: { user: { id: second } }, error: null });
    f.owned.mockImplementationOnce(() => new Promise(done => { release = done; }));
    f.authChange!('SIGNED_IN', { user: { id: second } });
    expect(f.sync).toHaveBeenCalledWith(null);
    await vi.waitFor(() => expect(release).toBeDefined());
    expect(f.sync).not.toHaveBeenCalledWith(second);
    release({ data: [{ slug: 'chez-bob' }], error: null });
    await vi.waitFor(() => expect(f.sync).toHaveBeenCalledWith(second));
  });

  it('keeps the old account neutralized when the new ownership lookup fails', async () => {
    await mounted();
    f.getUser.mockResolvedValue({ data: { user: { id: second } }, error: null });
    f.owned.mockRejectedValueOnce(new Error('offline'));
    f.authChange!('SIGNED_IN', { user: { id: second } });
    expect(f.sync).toHaveBeenCalledWith(null);
    await vi.waitFor(() => expect(f.owned).toHaveBeenCalledWith('owner_id', second));
    expect(f.sync).not.toHaveBeenCalledWith(second);
  });

  it('does not revoke the same account on an ordinary session refresh', async () => {
    await mounted();
    f.authChange!('TOKEN_REFRESHED', { user: { id: first } });
    await vi.waitFor(() => expect(f.sync).toHaveBeenCalledWith(first));
    expect(f.sync).not.toHaveBeenCalledWith(null);
  });

  it('keeps one native subscription and the same device identity across router navigation', async () => {
    f.autoInitial = true;
    render(<MemoryRouter initialEntries={['/admin/chez-alice']}><NativePushLifecycle /><RouterProbe /></MemoryRouter>);
    await vi.waitFor(() => expect(f.sync).toHaveBeenCalledWith(first));
    f.sync.mockClear();
    fireEvent.click(screen.getByRole('link', { name: 'Profile' }));
    await vi.waitFor(() => expect(screen.getByLabelText('current-route')).toHaveTextContent('/profil'));
    expect(f.subscriptions).toHaveLength(1);
    expect(f.appListener).toHaveBeenCalledOnce(); expect(f.pushListener).toHaveBeenCalledOnce();
    expect(f.unsubscribe).not.toHaveBeenCalled(); expect(f.dispose).not.toHaveBeenCalled();
    expect(f.sync).not.toHaveBeenCalledWith(null);
  });

  it('routes an owned notification after navigation without replacing its listener', async () => {
    f.autoInitial = true;
    render(<MemoryRouter initialEntries={['/admin/chez-alice']}><NativePushLifecycle /><RouterProbe /></MemoryRouter>);
    await vi.waitFor(() => expect(f.sync).toHaveBeenCalledWith(first));
    const action = f.action!;
    fireEvent.click(screen.getByRole('link', { name: 'Profile' }));
    await act(async () => { await action({ notification: { data: { type: 'new_order', restaurant_slug: 'chez-alice' } } }); });
    expect(screen.getByLabelText('current-route')).toHaveTextContent('/admin/chez-alice?view=cuisine');
    expect(f.action).toBe(action); expect(f.subscriptions).toHaveLength(1);
  });
});
