export class ItemPage {
  letter: string;
  page: number;
}

export function parseItemCategoriesResponse(data: { alpha: { letter: string; items: number }[] }): ItemPage[] {
  const categories = data.alpha.map(({ letter, items }) => ({
    letter,
    pages: Math.ceil(items / 12),
  }));

  return categories.flatMap(({ letter, pages }) => Array.from({ length: pages }, (_, i) => ({ letter, page: i + 1 })));
}
