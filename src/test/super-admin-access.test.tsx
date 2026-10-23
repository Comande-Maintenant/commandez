import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), fetchOwner: vi.fn(), privilegedRead: vi.fn(), from: vi.fn(), changeLanguage: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}));
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'fr', changeLanguage: mocks.changeLanguage }),
}));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...await importOriginal<object>(),
  fetchOwner: mocks.fetchOwner,
  fetchSuperAdminKPIs: mocks.privilegedRead,
  fetchAcquisitionFunnel: vi.fn().mockResolvedValue(null),
  fetchProspectList: vi.fn().mockResolvedValue([]),
  fetchDemoStats: vi.fn().mockResolvedValue(null),
  fetchAllPromoCodes: vi.fn().mockResolvedValue([]),
  fetchAllReferrals: vi.fn().mockResolvedValue(null),
  fetchAllProspects: vi.fn().mockResolvedValue([]),
  fetchAcquisitionStats: vi.fn().mockResolvedValue(null),
  fetchLiveSessions: vi.fn().mockResolvedValue([]),
}));

import SuperAdminPage from '@/pages/SuperAdminPage';

function SignInDestination() {
  return <p>Connexion {useLocation().search}</p>;
}

function renderPage() {
  render(<MemoryRouter initialEntries={['/super-admin']}><Routes>
    <Route path="/super-admin" element={<SuperAdminPage />} />
    <Route path="/connexion" element={<SignInDestination />} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.fetchOwner.mockResolvedValue({ role: 'owner' });
  mocks.privilegedRead.mockImplementation(() => new Promise(() => {}));
  const query = new Proxy({}, {
    get: (_, key) => key === 'then'
      ? (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], count: 0 }).then(resolve)
      : () => query,
  });
  mocks.from.mockReturnValue(query);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Super-admin access', () => {
  it('asks an anonymous visitor to sign in and preserves the destination', async () => {
    renderPage();
    expect(await screen.findByText('Connexion ?redirect=%2Fsuper-admin')).toBeVisible();
    expect(mocks.fetchOwner).not.toHaveBeenCalled();
    expect(mocks.privilegedRead).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('keeps a signed-in merchant outside the super-admin dashboard', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'merchant-1' } }, error: null });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Acces refuse' })).toBeVisible();
    expect(mocks.fetchOwner).toHaveBeenCalledWith('merchant-1');
    expect(mocks.privilegedRead).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('reads dashboard data only for the authenticated super-admin', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mocks.fetchOwner.mockResolvedValue({ role: 'super_admin' });
    renderPage();
    await waitFor(() => expect(mocks.privilegedRead).toHaveBeenCalledOnce());
    expect(screen.queryByRole('heading', { name: 'Acces refuse' })).not.toBeInTheDocument();
  });
});
