import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ signUp: vi.fn(), owner: vi.fn(), profile: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signUp: mocks.signUp } } }));
vi.mock('@/services/onboarding', () => ({ createOwner: mocks.owner }));
vi.mock('@/lib/api', () => ({ upsertCustomerProfile: mocks.profile }));
import { registerOwner, registerCustomer } from '@/services/account-registration';
const user = { id: 'account-id', email: 'owner@example.test' };
beforeEach(() => { vi.clearAllMocks(); });
describe('registration with mandatory email confirmation', () => {
  it('does not write an owner without an authenticated session', async () => {
    mocks.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    expect(await registerOwner(' owner@example.test ', 'password', '0600000000', 'https://app.commandeici.com/inscription')).toBe('confirmation');
    expect(mocks.owner).not.toHaveBeenCalled();
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: user.email, options: { data: { role: 'owner', phone: '0600000000' }, emailRedirectTo: 'https://app.commandeici.com/inscription' } }));
  });
  it('creates the owner when an authenticated session is returned', async () => {
    mocks.signUp.mockResolvedValue({ data: { user, session: { user } }, error: null });
    expect(await registerOwner(user.email, 'password', '', '/inscription')).toBe('ready');
    expect(mocks.owner).toHaveBeenCalledWith(user.id, user.email, '');
  });
  it('does not create a customer profile before verification', async () => {
    mocks.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    expect(await registerCustomer(user.email, 'password', 'Client', '', '/profil')).toBe('confirmation');
    expect(mocks.profile).not.toHaveBeenCalled();
  });
  it('propagates authentication errors without creating any profile', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null, session: null }, error: new Error('rate limit') });
    await expect(registerOwner(user.email, 'password', '', '/inscription')).rejects.toThrow('rate limit');
    expect(mocks.owner).not.toHaveBeenCalled();
  });
});
