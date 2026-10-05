import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import fr from '@/i18n/fr.json';
const api = vi.hoisted(() => ({ find: vi.fn(), share: vi.fn() }));
vi.mock('@/services/public-commerces', async original => ({ ...await original<object>(), findPublicCommerces: api.find }));
vi.mock('@/services/app-discovery-share', () => ({ discoveryUrl: 'https://commandeici.com', shareAppDiscovery: api.share }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ language: 'fr', isRTL: false, t: (key: string) => (fr as Record<string, string>)[key] ?? key }) }));
import ClientDiscoveryPage from '@/pages/ClientDiscoveryPage';
const open = () => render(<MemoryRouter initialEntries={['/espace/client']}><Routes>
  <Route path='/espace/client' element={<ClientDiscoveryPage />} />
  <Route path='/' element={<p>Choix du parcours</p>} />
  <Route path='/espace/commercant' element={<p>Parcours commerçant</p>} />
  <Route path='/mock-shop' element={<p>Vraie route commerce de la fixture</p>} />
</Routes></MemoryRouter>);
const search = (city = 'Auxerre') => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Ville' }), { target: { value: city } });
  fireEvent.click(screen.getByRole('button', { name: 'Voir les commerces' }));
};
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); api.find.mockResolvedValue({ items: [], has_more: false }); api.share.mockResolvedValue('copied'); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('requires a valid city without login, GPS or an unbounded request', () => {
  open();
  expect(screen.getByRole('heading', { name: 'Dans quelle ville souhaitez-vous commander ?' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Voir les commerces' }));
  expect(api.find).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'Ville' })).toHaveAttribute('aria-invalid', 'true');
});
it('renders the useful empty state only after successful search and shares only on a click', async () => {
  open(); search();
  expect(await screen.findByText('Oups, pas encore de commerce à Auxerre.')).toBeVisible();
  expect(api.share).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Faire découvrir CommandeIci' }));
  expect(await screen.findByText('Lien copié')).toBeVisible();
  expect(JSON.parse(localStorage.getItem('commandeici.entry.v1')!)).toMatchObject({ city: 'Auxerre' });
});
it('distinguishes failed searches from a city with no commerce and allows manual retry', async () => {
  api.find.mockRejectedValueOnce(new Error('offline')); open(); search();
  expect(await screen.findByText('Impossible de charger les commerces. Réessayez.')).toBeVisible();
  expect(screen.queryByText(/Oups, pas encore/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
  expect(await screen.findByText('Oups, pas encore de commerce à Auxerre.')).toBeVisible();
  expect(api.find).toHaveBeenCalledTimes(2);
});
it('offers a real commerce link and pickup without claiming its opening status', async () => {
  api.find.mockResolvedValue({ items: [{ slug: 'mock-shop', name: 'Mock shop', city: 'Auxerre', image: null, cover_image: null, cuisine: null, cuisine_type: null, business_type: null }], has_more: false });
  open(); search();
  fireEvent.click(await screen.findByRole('link', { name: /Mock shop/ }));
  expect(screen.getByText('Vraie route commerce de la fixture')).toBeVisible();
  expect(screen.queryByText(/Ouvert/)).not.toBeInTheDocument();
});
it('ignores a late result from the previous city after changing city', async () => {
  let resolve!: (value: unknown) => void;
  api.find.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  open(); search('Paris');
  fireEvent.click(screen.getByRole('button', { name: 'Changer de ville' }));
  search('Auxerre');
  expect(await screen.findByText('Oups, pas encore de commerce à Auxerre.')).toBeVisible();
  await act(async () => { resolve({ items: [], has_more: false }); });
  expect(screen.queryByText(/commerce à Paris/)).not.toBeInTheDocument();
});
it('has a path back and a merchant switch even while a request never finishes', () => {
  api.find.mockImplementation(() => new Promise(() => {})); open(); search();
  fireEvent.click(screen.getByRole('button', { name: 'Espace commerçant' }));
  expect(screen.getByText('Parcours commerçant')).toBeVisible();
});
it('does not stay in indefinite loading after the request deadline', async () => {
  vi.useFakeTimers(); api.find.mockImplementation(() => new Promise(() => {})); open(); search();
  await act(async () => { vi.advanceTimersByTime(12000); });
  expect(screen.getByText('Impossible de charger les commerces. Réessayez.')).toBeVisible();
  expect(api.find).toHaveBeenCalledTimes(1);
});
