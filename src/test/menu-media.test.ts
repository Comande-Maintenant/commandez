import { describe, expect, it } from 'vitest';
import { menuMediaCandidates } from '@/lib/menu-media';
const item = (name: string, image: string | null = null, category = '') => ({ name, image, category });
describe('menu illustrations', () => {
  it('keeps the restaurant photo first and has a bundled fallback', () => {
    const candidates=menuMediaCandidates(item('Kebab','https://restaurant.example/kebab.jpg'));
    expect(candidates[0]).toMatchObject({src:'https://restaurant.example/kebab.jpg',kind:'restaurant'});
    expect(candidates[1]).toMatchObject({src:'/images/menu/kebab.webp',kind:'illustration'});
  });
  it('recognizes accents and avoids showing a kebab for a plate', () => {
    expect(menuMediaCandidates(item('Assiette Kébab'))[0].src).toBe('/images/menu/plate.webp');
    expect(menuMediaCandidates(item('Barquette frites'))[0].src).toBe('/images/menu/fries.webp');
  });
  it('recognizes Coca Cola spelling and refuses an incorrect brand variant', () => {
    expect(menuMediaCandidates(item('Coca Cola 33 cl'))[0].src).toBe('/images/brands/coca-cola.svg');
    expect(menuMediaCandidates(item('Coca-Cola zéro 33cl'))[0].src).toBe('/images/brands/coca-cola-zero.png');
    expect(menuMediaCandidates(item('Coca cherry'))[0]?.src).not.toBe('/images/brands/coca-cola.svg');
  });
  it('does not guess a dish for an unknown product', () => {
    expect(menuMediaCandidates(item('Spécial du chef'))).toEqual([]);
  });
});

import { existsSync } from 'node:fs';
import { join } from 'node:path';
it('every recognized demo dish and beverage has an actual bundled asset',()=>{
 for(const name of ['Kebab','Hamburger','Galette','Tacos','Assiette','Panini fromage','Panini Nutella','Barquette frites','Barquette viande','Pizza','Nuggets','Salade','Tiramisu','Baklava','Café','Eau','Ayran','Coca Cola','Coca zero','Fanta','Sprite','Redbull','Oasis','Orangina','Schweppes','Evian']) {
  const media=menuMediaCandidates(item(name))[0];expect(media, name).toBeDefined();expect(existsSync(join(process.cwd(),'public',media.src)),name).toBe(true);
 }
});
