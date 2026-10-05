import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import fr from '@/i18n/fr.json';

const backend = vi.hoisted(() => ({ user: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: backend.user }, from: backend.from } }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => (fr as Record<string, string>)[key] ?? key }) }));
import Index from '@/pages/Index';

function openHome() {
  return render(<MemoryRouter><Routes>
    <Route path="/" element={<Index />} />
    <Route path="/espace/client" element={<p>Choisir ma ville</p>} />
    <Route path="/espace/commercant" element={<p>Entrée commerçant</p>} />
    <Route path="/admin/real-merchant" element={<p>Gestion de mon commerce</p>} />
  </Routes></MemoryRouter>);
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  backend.user.mockResolvedValue({ data: { user: null } });
});

it('makes both customer and merchant choices immediately reachable before account lookup', () => {
  backend.user.mockImplementation(() => new Promise(() => {}));
  openHome();
  expect(screen.getByRole('button', { name: 'Trouver un commerce et commander' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Je suis commerçant' })).toBeVisible();
});

it('lets an authenticated merchant explicitly choose the customer path without owner lookup redirecting them', async () => {
  backend.user.mockResolvedValue({ data: { user: { id: 'owner' } } });
  const query = { select: () => query, eq: () => query, limit: vi.fn().mockResolvedValue({ data: [{ slug: 'real-merchant' }] }) };
  backend.from.mockReturnValue(query);
  openHome();
  fireEvent.click(screen.getByRole('button', { name: 'Trouver un commerce et commander' }));
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByText('Choisir ma ville')).toBeVisible();
  expect(screen.queryByText('Gestion de mon commerce')).not.toBeInTheDocument();
  expect(backend.from).not.toHaveBeenCalled();
});

it('remembers a merchant choice without changing authentication', () => {
  openHome();
  fireEvent.click(screen.getByRole('button', { name: 'Je suis commerçant' }));
  expect(screen.getByText('Entrée commerçant')).toBeVisible();
  expect(JSON.parse(localStorage.getItem('commandeici.entry.v1')!)).toMatchObject({ role: 'merchant' });
});

it('reopens the saved customer path rather than the merchant dashboard', async () => {
  localStorage.setItem('commandeici.entry.v1', JSON.stringify({ role: 'client', city: 'Auxerre' }));
  openHome();
  expect(await screen.findByText('Choisir ma ville')).toBeVisible();
  expect(backend.user).not.toHaveBeenCalled();
});

it('keeps both choices available when preference storage is inaccessible', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Unavailable', 'SecurityError'); });
  openHome();
  expect(screen.getByRole('button', { name: 'Trouver un commerce et commander' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Je suis commerçant' })).toBeVisible();
});
