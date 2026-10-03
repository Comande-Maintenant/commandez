import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
const f = vi.hoisted(() => ({ suspend: vi.fn(), rpc: vi.fn(), signOut: vi.fn(), navigate: vi.fn() }));
vi.mock('@/services/native-push-client', () => ({ suspendNativePushBeforeSignOut: f.suspend }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: f.rpc, auth: { signOut: f.signOut } } }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => f.navigate }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
import { DeleteAccountButton } from '@/components/auth/DeleteAccountButton';
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function confirm() {
  render(<DeleteAccountButton />); fireEvent.click(screen.getByRole('button', { name: 'account.delete' }));
  const dialog = screen.getByRole('alertdialog'); fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'DELETE' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'account.delete' }));
}
describe('native account deletion', () => {
  it('revokes device registration while the session still exists before deleting', async () => {
    f.suspend.mockResolvedValue(undefined); f.rpc.mockResolvedValue({ error: null }); f.signOut.mockResolvedValue({ error: null }); confirm();
    await vi.waitFor(() => expect(f.navigate).toHaveBeenCalled());
    expect(f.suspend.mock.invocationCallOrder[0]).toBeLessThan(f.rpc.mock.invocationCallOrder[0]);
    expect(f.rpc.mock.invocationCallOrder[0]).toBeLessThan(f.signOut.mock.invocationCallOrder[0]);
  });
  it('keeps the account and offers retry when device revocation fails', async () => {
    f.suspend.mockRejectedValue(new Error('offline')); f.rpc.mockResolvedValue({ error: null }); confirm();
    await vi.waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('client.delete_error'));
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.signOut).not.toHaveBeenCalled();
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'account.delete' })).toBeEnabled();
  });
});
