import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fr from '@/i18n/fr.json';
import type { DbOrder } from '@/types/database';

const api = vi.hoisted(() => ({ orders: vi.fn(), customers: vi.fn(), demoOrders: vi.fn(), demoCustomers: vi.fn() }));
vi.mock('@/lib/api', () => ({ fetchOrders: api.orders, fetchCustomers: api.customers, fetchDemoOrders: api.demoOrders, fetchDemoCustomers: api.demoCustomers }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ language: 'fr', t: (key: string) => (fr as Record<string, string>)[key] ?? key }) }));
import { OrderHistorySheet } from '@/components/dashboard/OrderHistorySheet';

const order = (ageHours = 0): DbOrder => ({ id: 'history-order', order_number: 1, daily_number: 1, created_at: new Date(Date.now() - ageHours * 3600000).toISOString(), status: 'done', order_type: 'collect', customer_phone: '', items: [{ name: 'Kebab historique', price: 6.5, quantity: 2 }], total: 13 } as DbOrder);

function openHistory(isDemo = false, focusTrigger = true) {
  const close = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(false);
    return <><button aria-label={fr['dashboard.history.title']} onClick={() => setOpen(true)}>Ouvrir l'historique</button><OrderHistorySheet restaurantId="history-restaurant" isDemo={isDemo} open={open} onClose={() => { close(); setOpen(false); }} /></>;
  }
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: fr['dashboard.history.title'] });
  if (focusTrigger) trigger.focus();
  fireEvent.click(trigger);
  return { trigger, close };
}

beforeEach(() => {
  vi.resetAllMocks();
  api.orders.mockResolvedValue([]); api.customers.mockResolvedValue([]);
  api.demoOrders.mockResolvedValue([]); api.demoCustomers.mockResolvedValue([]);
});
afterEach(cleanup);

it('keeps both exits usable while the orders request is still pending', async () => {
  api.orders.mockReturnValue(new Promise(() => {}));
  const { close } = openHistory();
  expect(screen.getByRole('button', { name: 'Retour' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Fermer' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(close).toHaveBeenCalledOnce();
});

it('shows the last-24-hours empty state with a visible back action', async () => {
  api.orders.mockResolvedValue([order(25)]);
  const { close } = openHistory();
  await screen.findByText(fr['dashboard.history.empty']);
  expect(screen.queryByText('Kebab historique')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
  expect(close).toHaveBeenCalledOnce();
});

it('distinguishes a failed history request from an empty history and can retry', async () => {
  api.orders.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([order()]);
  openHistory();
  expect(await screen.findByRole('alert')).toHaveTextContent(fr['common.error']);
  expect(screen.queryByText(fr['dashboard.history.empty'])).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retour' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
  await screen.findByText('2x Kebab historique');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(api.orders).toHaveBeenCalledTimes(2);
});

it('can close an unavailable history without waiting for a successful retry', async () => {
  api.orders.mockRejectedValue(new Error('offline'));
  const { close } = openHistory();
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
  expect(close).toHaveBeenCalledOnce();
});

it('keeps the back action when a historical order detail is expanded', async () => {
  api.orders.mockResolvedValue([order()]);
  const { close } = openHistory();
  const summary = await screen.findByText('2x Kebab historique');
  fireEvent.click(summary);
  expect(screen.getByText('Kebab historique')).toBeVisible();
  expect(screen.getAllByText('13.00 €').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
  expect(close).toHaveBeenCalledOnce();
});

it.each(['Retour', 'Fermer', 'Escape'])('restores the opening action focus after %s', async (action) => {
  const { trigger } = openHistory();
  await screen.findByText(fr['dashboard.history.empty']);
  expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  if (action === 'Escape') fireEvent.keyDown(document, { key: 'Escape' });
  else fireEvent.click(screen.getByRole('button', { name: action }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});

it('returns to the history trigger when a pointer open did not focus it', async () => {
  const { trigger } = openHistory(false, false);
  await screen.findByText(fr['dashboard.history.empty']);
  fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});

it('keeps the existing demo read path and tolerates unavailable customer badges', async () => {
  api.demoOrders.mockResolvedValue([order()]); api.demoCustomers.mockRejectedValue(new Error('offline'));
  openHistory(true);
  await screen.findByText('2x Kebab historique');
  expect(api.demoOrders).toHaveBeenCalledWith('history-restaurant');
  expect(api.orders).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Fermer' })).toBeVisible();
});
