import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ searchPlaces: vi.fn(), analyzeMenuImages: vi.fn(), convertFilesForAnalysis: vi.fn(), fetchAllMenuItems: vi.fn(), insertMenuItem: vi.fn(), updateRestaurantCategories: vi.fn() }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock('@/services/google-places', () => ({ searchPlaces: mocks.searchPlaces }));
vi.mock('@/services/menu-analysis', () => ({ analyzeMenuImages: mocks.analyzeMenuImages }));
vi.mock('@/utils/file-converter', () => ({ convertFilesForAnalysis: mocks.convertFilesForAnalysis }));
vi.mock('@/lib/api', () => ({ fetchAllMenuItems: mocks.fetchAllMenuItems, insertMenuItem: mocks.insertMenuItem, updateRestaurantCategories: mocks.updateRestaurantCategories }));
vi.mock('@/components/onboarding/MenuReviewEditor', () => ({ MenuReviewEditor: ({ menu, onConfirm }: any) => <button onClick={() => onConfirm(menu)}>Review and save</button> }));
import { GooglePlaceSearch } from '@/components/onboarding/GooglePlaceSearch';
import { PlaceConfirmation } from '@/components/onboarding/PlaceConfirmation';
import { MenuImportModal } from '@/components/dashboard/MenuImportModal';
import type { DbRestaurant } from '@/types/database';
beforeEach(() => { vi.clearAllMocks(); cleanup(); });
describe('Google onboarding', () => {
  it('shows a visible retryable error when Google search fails', async () => {
    mocks.searchPlaces.mockRejectedValue(new Error('quota'));
    render(<GooglePlaceSearch onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pizza Auxerre' } });
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toBeVisible();
  });
  it('uses Google structured city and prevents blank publication details', () => {
    render(<PlaceConfirmation place={{ place_id: 'place-1', name: 'Pizza', city: 'Auxerre', formatted_address: '12 rue, 89000 Auxerre, Bourgogne, France' }} onConfirm={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByDisplayValue('Auxerre')).toBeVisible();
    fireEvent.change(screen.getByDisplayValue('Pizza'), { target: { value: ' ' } });
    expect(screen.getByText('onboarding.place.confirm')).toBeDisabled();
  });
});
describe('Dashboard menu import', () => {
  it('lets the user leave while conversion is pending without starting a second operation', async () => {
    mocks.convertFilesForAnalysis.mockReturnValue(new Promise(() => {}));
    const onOpenChange=vi.fn();
    render(<MenuImportModal open onOpenChange={onOpenChange} restaurant={{id:'owner-restaurant',categories:[]} as unknown as DbRestaurant} existingItems={[]} onImportComplete={vi.fn()}/>);
    fireEvent.change(document.querySelector('input[multiple]')!,{target:{files:[new File(['image'],'menu.jpg',{type:'image/jpeg'})]}});
    await screen.findByText('dashboard.import.analyzing');
    fireEvent.click(screen.getByRole('button',{name:'common.close'}));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.convertFilesForAnalysis).toHaveBeenCalledTimes(1);
    expect(mocks.insertMenuItem).not.toHaveBeenCalled();
  });
  it('preserves variants and rereads saved items on a retry after partial failure', async () => {
    const menu = [{ name: 'Pizza', items: [{ name: 'Margherita', price: 9, variants: [{ name: 'Grande', price: 12 }] }, { name: 'Calzone', price: 10 }] }];
    mocks.convertFilesForAnalysis.mockResolvedValue({ converted: [new File(['image'], 'menu.jpg', { type: 'image/jpeg' })], errors: [] });
    mocks.analyzeMenuImages.mockResolvedValue({ categories: menu });
    mocks.fetchAllMenuItems.mockResolvedValueOnce([]).mockResolvedValue([{ name: 'Margherita', category: 'Pizza', sort_order: 1 }]);
    mocks.insertMenuItem.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined);
    const onComplete = vi.fn();
    render(<MenuImportModal open onOpenChange={vi.fn()} restaurant={{ id: 'owner-restaurant', categories: [] } as unknown as DbRestaurant} existingItems={[]} onImportComplete={onComplete} />);
    const input = document.querySelector('input[multiple]')!;
    fireEvent.change(input, { target: { files: [new File(['image'], 'menu.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(await screen.findByText('Review and save'));
    await waitFor(() => expect(mocks.insertMenuItem).toHaveBeenCalledTimes(2));
    expect(mocks.insertMenuItem.mock.calls[0][0].variants).toEqual([{ name: 'Grande', price: 12 }]);
    fireEvent.click(await screen.findByText('Review and save'));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(mocks.fetchAllMenuItems).toHaveBeenCalledTimes(2);
    expect(mocks.insertMenuItem.mock.calls.map((call) => call[0].name)).toEqual(['Margherita', 'Calzone', 'Calzone']);
  });
});
