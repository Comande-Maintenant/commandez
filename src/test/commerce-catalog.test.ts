import { expect, it } from 'vitest';
import { catalogCategories, emptyCatalogRow, isCatalogDraft } from '@/lib/commerce-catalog';

it('groups fixed-price products and accepts the French decimal separator', () => {
  const rows = [{...emptyCatalogRow('Fleurs'),name:' Bouquet ',price:'25,50'}, {...emptyCatalogRow('Fleurs'),name:'Rose',price:'3'}];
  expect(catalogCategories(rows)).toEqual([{name:'Fleurs',items:[{name:'Bouquet',price:25.5,description:''},{name:'Rose',price:3,description:''}]}]);
});
it('refuses missing, negative, non-finite, excessive and ambiguous prices', () => {
  for (const price of ['', '-2', 'Infinity', '10000', '1e3', '1.234']) expect(catalogCategories([{...emptyCatalogRow('Products'),name:'Product',price}])).toBeNull();
  expect(catalogCategories([{...emptyCatalogRow('Products'),name:'Product',price:'0'}])).not.toBeNull();
  expect(catalogCategories([])).toBeNull();
});
it('does not restore malformed or oversized saved product drafts', () => {
  expect(isCatalogDraft([{id:'1',name:123,price:'2',category:'Products',description:''}])).toBe(false);
  expect(isCatalogDraft(Array.from({length:501},()=>emptyCatalogRow('Products')))).toBe(false);
});
