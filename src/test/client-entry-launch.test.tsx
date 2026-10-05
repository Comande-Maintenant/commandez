import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fr from '@/i18n/fr.json';
const api = vi.hoisted(() => ({ launch: vi.fn(), exchange: vi.fn() }));
vi.mock('@/context/CartContext', () => ({ useCart: () => ({ restaurantId: null }) }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string) => (fr as Record<string, string>)[key] ?? key }) }));
vi.mock('@/lib/native', async original => ({ ...await original<object>(), isNative: () => true }));
vi.mock('@capacitor/app', () => ({ App: { getLaunchUrl: api.launch, addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) } }));
vi.mock('@capacitor/network', () => ({ Network: { getStatus: vi.fn().mockResolvedValue({ connected: true }), addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { exchangeCodeForSession: api.exchange, startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn() } } }));
import Index from '@/pages/Index';
import { NativeLifecycle } from '@/components/NativeLifecycle';
const open = () => render(<MemoryRouter><NativeLifecycle><Routes>
  <Route path='/' element={<Index />} />
  <Route path='/espace/client' element={<p>Prompt ville évité</p>} />
  <Route path='/mock-cafe' element={<p>Menu direct</p>} />
  <Route path='/suivi/mock-order' element={<p>Suivi direct</p>} />
  <Route path='/profil' element={<p>Profil confirmé</p>} />
</Routes></NativeLifecycle></MemoryRouter>);
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); localStorage.setItem('commandeici.entry.v1', JSON.stringify({ role: 'client', city: 'Paris' })); api.exchange.mockResolvedValue({ error: null }); });
afterEach(cleanup);
for (const [url, target] of [['https://app.commandeici.com/mock-cafe', 'Menu direct'], ['https://app.commandeici.com/suivi/mock-order', 'Suivi direct'], ['commandeici://auth/profil?code=launch-pkce', 'Profil confirmé']]) {
 it(`prioritizes the initial link ${url} over saved role or city`, async () => {
   let resolve!: (value: unknown) => void;
   api.launch.mockImplementation(() => new Promise(done => { resolve = done; }));
   open();
   expect(screen.queryByText('Prompt ville évité')).not.toBeInTheDocument();
   await act(async () => { resolve({ url }); await Promise.resolve(); });
   expect(screen.getByText(target)).toBeVisible();
   expect(screen.queryByText('Prompt ville évité')).not.toBeInTheDocument();
 });
}
it('returns to the saved role if initial native link lookup fails', async () => {
 api.launch.mockRejectedValue(new Error('Plugin unavailable')); open();
 expect(await screen.findByText('Prompt ville évité')).toBeVisible();
});
