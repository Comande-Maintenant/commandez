export type MenuMedia = { src: string; kind: 'restaurant' | 'brand' | 'illustration'; label: string };
type Item = { name: string; image?: string | null; category?: string; product_type?: string | null };
export const normalizeMenuName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Exact brand families first, then dish names. Never use a category alone to
// invent an image for an unknown special, sauce or supplement.
export function menuMediaCandidates(item: Item): MenuMedia[] {
  const result: MenuMedia[] = item.image?.trim() ? [{ src: item.image.trim(), kind: 'restaurant', label: item.name }] : [];
  const name = normalizeMenuName(item.name);
  const add = (src: string, kind: MenuMedia['kind'], label: string) => result.push({src,kind,label});
  if (/\b(coca cola|coca)\b/.test(name)) {
    if (/\b(zero|sans sucres?|sans sucre)\b/.test(name) && !/\b(cherry|cerise|vanille|vanilla|lemon|citron|cafeine)\b/.test(name)) add('/images/brands/coca-cola-zero.png','brand','Coca-Cola zéro sucres');
    else if (!/\b(cherry|cerise|vanille|vanilla|lemon|citron|cafeine|light)\b/.test(name)) add('/images/brands/coca-cola.svg','brand','Coca-Cola');
  } else if (/\bfanta\b/.test(name) && !/\b(citron|exotic|exotique|raisin|mangue)\b/.test(name)) add('/images/brands/fanta.png','brand','Fanta');
  else if (/\bsprite\b/.test(name)) add('/images/brands/sprite.png','brand','Sprite');
  else if (/\bred ?bull\b/.test(name)) add('/images/brands/red-bull.svg','brand','Red Bull');
  else if (/\boasis\b/.test(name)) add('/images/brands/oasis.png','brand','Oasis');
  else if (/\borangina\b/.test(name)) add('/images/brands/orangina.webp','brand','Orangina');
  else if (/\bschweppes\b/.test(name)) add('/images/brands/schweppes.png','brand','Schweppes');
  else if (/\bevian\b/.test(name)) add('/images/brands/evian.png','brand','evian');
  else {
    let dish: string | undefined;
    if (/\b(assiette|plate)\b/.test(name)) dish='plate';
    else if (/\b(viande)\b/.test(name) && /\bfrites\b/.test(name)) dish='plate';
    else if (/\b(frites|fries)\b/.test(name)) dish='fries';
    else if (/\b(tacos)\b/.test(name)) dish='tacos';
    else if (/\b(galette|wrap)\b/.test(name)) dish='wrap';
    else if (/\b(hamburger|burger)\b/.test(name)) dish='burger';
    else if (/\b(panini)\b/.test(name)) dish=/\b(nutella|speculos|chocolat)\b/.test(name)?'sweet-panini':'panini';
    else if (/\b(kebab|doner|sandwich)\b/.test(name)) dish='kebab';
    else if (/\b(pizza)\b/.test(name)) dish='pizza';
    else if (/\b(nuggets)\b/.test(name)) dish='nuggets';
    else if (/\b(salade|salad)\b/.test(name)) dish='salad';
    else if (/\b(tiramisu)\b/.test(name)) dish='tiramisu';
    else if (/\b(baklava)\b/.test(name)) dish='baklava';
    else if (/\b(cafe|coffee|espresso)\b/.test(name)) dish='coffee';
    else if (/\b(ayran)\b/.test(name)) dish='ayran';
    else if (/\b(eau|water)\b/.test(name)) dish='water';
    else if (/\b(barquette viande)\b/.test(name)) dish='meat';
    if (dish) add(`/images/menu/${dish}.webp`,'illustration',`${item.name} (photo d’illustration)`);
  }
  return result;
}
