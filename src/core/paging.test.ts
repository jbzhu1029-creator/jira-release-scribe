import { describe, expect, it } from 'vitest';
import { collectUntil } from './paging';

describe('collectUntil', () => {
  it('follows cursors until the last page', async () => {
    const result = await collectUntil(async (cursor) => {
      if (!cursor) return { items: [1, 2], nextCursor: 'next' };
      return { items: [3] };
    }, 10, 5);
    expect(result).toEqual({ items: [1, 2, 3], truncated: false });
  });

  it('stops in the middle of a page at the item cap', async () => {
    const result = await collectUntil(async () => ({ items: ['a', 'b', 'c'], nextCursor: 'more' }), 2, 5);
    expect(result).toEqual({ items: ['a', 'b'], truncated: true });
  });

  it('marks an exact full page with a further cursor as truncated', async () => {
    const result = await collectUntil(async () => ({ items: [1, 2], nextCursor: 'more' }), 2, 5);
    expect(result).toEqual({ items: [1, 2], truncated: true });
  });

  it('stops after the page cap when more pages remain', async () => {
    let calls = 0;
    const result = await collectUntil(async () => {
      calls += 1;
      return { items: [calls], nextCursor: `page-${calls}` };
    }, 10, 2);
    expect(result.items).toEqual([1, 2]);
    expect(result.truncated).toBe(true);
    expect(calls).toBe(2);
  });
});
