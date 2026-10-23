import {describe,expect,it} from 'vitest';
import {matchesMenuSearch} from '@/lib/menu-search';
describe('searching a restaurant menu',()=>{
 it('matches all words across the translated name, description and category without accents',()=>{
  expect(matchesMenuSearch('  creme CAFE ',{name:'Crème brûlée',description:'Au café',category:'Desserts'})).toBe(true);
  expect(matchesMenuSearch('cafe poulet',{name:'Crème brûlée',description:'Au café',category:'Desserts'})).toBe(false);
 });
 it('keeps all products for an empty query and finds a category',()=>{
  expect(matchesMenuSearch('   ',{name:'Eau'})).toBe(true);
  expect(matchesMenuSearch('boisson',{name:'Eau',category:'Boissons'})).toBe(true);
 });
 it('preserves non-Latin searches and treats punctuation as text',()=>{
  expect(matchesMenuSearch('鸡肉',{name:'鸡肉汉堡'})).toBe(true);
  expect(matchesMenuSearch('[',{name:'Kebab'})).toBe(false);
 });
});
