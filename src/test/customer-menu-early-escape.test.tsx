import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CustomerAvatar } from '@/components/CustomerAvatar';

const state = vi.hoisted(() => ({ isLoggedIn: true, language: 'fr' }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/context/CustomerAuthContext', () => ({ useCustomerAuth: () => ({ isLoggedIn: state.isLoggedIn, profile: state.isLoggedIn ? { name: 'Alice' } : null, signOut: vi.fn() }) }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ language: state.language, t: (key: string) => key }) }));
vi.mock('@/components/CustomerAuthModal', () => ({ CustomerAuthModal: () => null }));
afterEach(cleanup);

it.each([{isLoggedIn: true, language: 'fr'}, {isLoggedIn: false, language: 'fr'}, {isLoggedIn: true, language: 'ar'}, {isLoggedIn: false, language: 'ar'}])('closes and restores the trigger when Escape arrives at first focus ($language, signed in: $isLoggedIn)', async (scenario) => {
  Object.assign(state, scenario);
  render(<CustomerAvatar />);
  const trigger = screen.getByRole('button', { name: 'client.title' });
  let escaped = false;
  const immediatelyEscape = (event: FocusEvent) => {
    const target = event.target as HTMLElement;
    if (!escaped && target.closest('[role="menu"]')) {
      escaped = true;
      // A real key event on the focused menu, before passive effects run.
      fireEvent.keyDown(target, { key: 'Escape', code: 'Escape' });
    }
  };
  document.addEventListener('focusin', immediatelyEscape);
  try {
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(escaped).toBe(true));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  } finally { document.removeEventListener('focusin', immediatelyEscape); }
});

it('keeps keyboard selection available and restores focus after a normal Escape', async () => {
  Object.assign(state, { isLoggedIn: true, language: 'fr' });
  render(<CustomerAvatar />);
  const trigger = screen.getByRole('button', { name: 'client.title' });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
  const menu = await screen.findByRole('menu');
  await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});
