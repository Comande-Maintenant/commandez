function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}
export function matchesMenuSearch(query: string, item: {name:string;description?:string|null;category?:string|null}): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const text = normalize([item.name, item.description, item.category].filter(Boolean).join(' '));
  return words.every(word => text.includes(word));
}
