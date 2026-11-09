export const MAX_ISSUES = 200;
export const SEARCH_PAGE_SIZE = 100;
export const MAX_SEARCH_PAGES = 5;
export const MAX_LIST_PAGES = 2;

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

export async function collectUntil<T>(
  fetchPage: (cursor: string | undefined) => Promise<Page<T>>,
  maxItems: number,
  maxPages: number,
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  let cursor: string | undefined;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await fetchPage(cursor);
    for (const item of page.items) {
      if (items.length >= maxItems) return { items, truncated: true };
      items.push(item);
    }
    const more = Boolean(page.nextCursor) && page.items.length > 0;
    if (!more) return { items, truncated: false };
    if (items.length >= maxItems) return { items, truncated: true };
    cursor = page.nextCursor;
  }

  return { items, truncated: true };
}
