import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ getUser: vi.fn(), change: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: f.getUser, onAuthStateChange: f.change } } }));
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
beforeEach(() => { vi.clearAllMocks(); f.getUser.mockResolvedValue({ data: { user: { id: 'owner-a' } }, error: null }); f.change.mockReturnValue({ data: { subscription: { unsubscribe: f.unsubscribe } } }); });
afterEach(cleanup);
describe('Dashboard authenticated owner', () => {
  it('clears the owner immediately after logout so the old order feed is disabled', async () => {
    const { result } = renderHook(() => useDashboardAuth(false));
    await waitFor(() => expect(result.current.authUserId).toBe('owner-a'));
    act(() => f.change.mock.calls[0][0]('SIGNED_OUT', null));
    expect(result.current.authUserId).toBeNull(); expect(result.current.authError).toBe('not_logged_in');
  });
  it('uses the new owner immediately and ignores an older initial response', async () => {
    let initial!: (value: unknown) => void;
    f.getUser.mockImplementation(() => new Promise(resolve => { initial = resolve; }));
    const { result } = renderHook(() => useDashboardAuth(false));
    act(() => f.change.mock.calls[0][0]('SIGNED_IN', { user: { id: 'owner-b' } }));
    await act(async () => initial({ data: { user: { id: 'owner-a' } }, error: null }));
    expect(result.current.authUserId).toBe('owner-b'); expect(result.current.authChecked).toBe(true);
  });
  it('keeps a public demo independent of authentication', () => {
    const { result } = renderHook(() => useDashboardAuth(true));
    expect(result.current.authChecked).toBe(true);
    expect(f.getUser).not.toHaveBeenCalled(); expect(f.change).not.toHaveBeenCalled();
  });
  it('shows an error without an owner when the verified user read fails', async () => {
    f.getUser.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDashboardAuth(false));
    await waitFor(() => expect(result.current.authError).toBe('unavailable'));
    expect(result.current.authUserId).toBeNull();
  });
  it('releases the auth listener when the dashboard unmounts', () => {
    const { unmount } = renderHook(() => useDashboardAuth(false)); unmount(); expect(f.unsubscribe).toHaveBeenCalledOnce();
  });
});
