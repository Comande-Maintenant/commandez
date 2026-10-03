import { describe, expect, it } from 'vitest';
import { buildOrderItems } from '@/lib/posHelpers';

describe('POS menu item identity', () => {
  it('includes the server menu UUID for drinks and desserts', () => {
    const items = buildOrderItems([], [{ menuItemId: 'drink-id', name: 'Cola', price: 2, quantity: 1 }], [{ menuItemId: 'dessert-id', name: 'Tiramisu', price: 4, quantity: 1 }]);
    expect(items.map(item => item.menu_item_id)).toEqual(['drink-id', 'dessert-id']);
  });

  it('sends option IDs and quantities so custom POS prices can be checked against the restaurant configuration', () => {
    const items = buildOrderItems([{ personIndex: 0, label: 'Personne 1', itemPrice: 12, customization: {
      baseId: 'galette', baseName: 'Galette', viandeIds: ['poulet'], viandeNames: ['Poulet'], garnitures: [{ optionId: 'tomate', name: 'Tomate', level: 'x2' }], sauceIds: ['blanche'], sauceNames: ['Blanche'], accompagnement: { optionId: 'frites', name: 'Frites', portion: 'double', portionPriceMod: 2 }, supplements: [{ optionId: 'cheddar', name: 'Cheddar', quantity: 2, unitPrice: 1 }],
    } }], [], []);
    expect(items[0].customization_selection).toEqual({
      base_id: 'galette', viande_ids: ['poulet'], garnitures: [{ option_id: 'tomate', level: 'x2' }], sauce_ids: ['blanche'], accompagnement: { option_id: 'frites', portion: 'double', sub_sauce_id: null }, supplements: [{ option_id: 'cheddar', quantity: 2 }],
    });
    expect(items[0].customization.base).toBe('Galette');
  });
});
