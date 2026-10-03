import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
const f = vi.hoisted(() => ({ suspend: vi.fn(), rpc: vi.fn(), signOut: vi.fn(), navigate: vi.fn(), getUser: vi.fn(), getSession: vi.fn() }));
vi.mock('@/services/native-push-client', () => ({ suspendNativePushBeforeSignOut: f.suspend }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: f.rpc, auth: { signOut: f.signOut, getUser: f.getUser, getSession: f.getSession } } }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => f.navigate }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
import { DeleteAccountButton } from '@/components/auth/DeleteAccountButton';
beforeEach(() => { f.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner-a' } } }, error: null }); f.getUser.mockResolvedValue({ data: { user: { id: 'owner-a' } }, error: null }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function confirm() {
  render(<DeleteAccountButton />); fireEvent.click(screen.getByRole('button', { name: 'account.delete' }));
  const dialog = screen.getByRole('alertdialog'); fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'DELETE' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'account.delete' }));
}
describe('native account deletion', () => {
  it('revokes device registration while the session still exists before deleting', async () => {
    f.suspend.mockResolvedValue(undefined); f.rpc.mockResolvedValue({ data: { deleted: true }, error: null }); f.signOut.mockResolvedValue({ error: null }); confirm();
    await vi.waitFor(() => expect(f.navigate).toHaveBeenCalled());
    expect(f.suspend.mock.invocationCallOrder[0]).toBeLessThan(f.rpc.mock.invocationCallOrder[0]);
    expect(f.rpc.mock.invocationCallOrder[0]).toBeLessThan(f.signOut.mock.invocationCallOrder[0]);
  });
  it('keeps the account and offers retry when device revocation fails', async () => {
    f.suspend.mockRejectedValue(new Error('offline')); f.rpc.mockResolvedValue({ data: { deleted: true }, error: null }); confirm();
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('client.delete_error'));
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.signOut).not.toHaveBeenCalled();
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'account.delete' })).toBeEnabled();
  });
  it('never deletes account B if it replaces A during device cleanup', async () => {
    f.getUser.mockResolvedValueOnce({ data: { user: { id: 'owner-a' } }, error: null }).mockResolvedValue({ data: { user: { id: 'owner-b' } }, error: null });
    f.suspend.mockResolvedValue(undefined); confirm();
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('client.delete_error'));
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.signOut).not.toHaveBeenCalled();
  });
  it('does not accept an unconfirmed deletion as success', async () => {
    f.suspend.mockResolvedValue(undefined); f.rpc.mockResolvedValue({ data: { deleted: false }, error: null }); confirm();
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('client.delete_error'));
    expect(f.signOut).not.toHaveBeenCalled(); expect(f.navigate).not.toHaveBeenCalled();
  });
  it('does not sign out a newer account after a delayed successful deletion', async () => {
    f.getUser.mockResolvedValueOnce({ data: { user: { id: 'owner-a' } }, error: null }).mockResolvedValueOnce({ data: { user: { id: 'owner-a' } }, error: null }).mockResolvedValue({ data: { user: { id: 'owner-b' } }, error: null });
    f.suspend.mockResolvedValue(undefined); f.rpc.mockResolvedValue({ data: { deleted: true }, error: null }); confirm();
    f.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner-b' } } }, error: null });
    await vi.waitFor(() => expect(f.getSession).toHaveBeenCalled());
    expect(f.signOut).not.toHaveBeenCalled(); expect(f.navigate).not.toHaveBeenCalled();
  });
  it('offers retry after a rejected deletion request', async () => {
    f.suspend.mockResolvedValue(undefined); f.rpc.mockRejectedValue(new Error('offline')); confirm();
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('client.delete_error'));
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'account.delete' })).toBeEnabled();
  });

});
