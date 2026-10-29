import { describe, expect, it } from 'vitest';
import { allowedPaymentMethod, orderPaymentOptions } from '@/lib/payment-options';

describe('orderPaymentOptions', () => {
  it('offers only the methods the commerce accepts', () => {
    expect(orderPaymentOptions(['cash'])).toEqual(['cash']);
    expect(orderPaymentOptions(['card'])).toEqual(['card']);
  });

  it('keeps a stable card then cash order', () => {
    expect(orderPaymentOptions(['cash', 'card'])).toEqual(['card', 'cash']);
  });

  it('falls back to card and cash when nothing usable is configured', () => {
    expect(orderPaymentOptions(null)).toEqual(['card', 'cash']);
    expect(orderPaymentOptions(undefined)).toEqual(['card', 'cash']);
    expect(orderPaymentOptions([])).toEqual(['card', 'cash']);
    expect(orderPaymentOptions(['ticket_restaurant'])).toEqual(['card', 'cash']);
  });

  it('ignores meal vouchers alongside a supported method', () => {
    expect(orderPaymentOptions(['cash', 'ticket_restaurant'])).toEqual(['cash']);
  });

  it('understands legacy and wallet spellings', () => {
    expect(orderPaymentOptions(['CB', 'cash'])).toEqual(['card', 'cash']);
    expect(orderPaymentOptions(['Carte bancaire'])).toEqual(['card']);
    expect(orderPaymentOptions(['Especes', 'card'])).toEqual(['card', 'cash']);
    expect(orderPaymentOptions(['Espèces'])).toEqual(['cash']);
    expect(orderPaymentOptions(['apple_google_pay'])).toEqual(['card']);
  });

  it('keeps an allowed choice and replaces a refused one', () => {
    expect(allowedPaymentMethod('cash', ['card', 'cash'])).toBe('cash');
    expect(allowedPaymentMethod('card', ['cash'])).toBe('cash');
  });
});
