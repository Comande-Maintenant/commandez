import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import { MenuReviewEditor } from '@/components/onboarding/MenuReviewEditor';
describe('Menu review before publication', () => {
  it('prevents saving a negative edited price', () => {
    render(<MenuReviewEditor menu={[{ name: 'Pizza', items: [{ name: 'Margherita', price: 9, description: '' }] }]} onConfirm={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-9' } });
    expect(screen.getByText('Valider ma carte')).toBeDisabled();
    cleanup();
  });
  it('prevents saving a blank item name', () => {
    render(<MenuReviewEditor menu={[{ name: 'Pizza', items: [{ name: '', price: 9, description: '' }] }]} onConfirm={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('Valider ma carte')).toBeDisabled();
    cleanup();
  });
});
