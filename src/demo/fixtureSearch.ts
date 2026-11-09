import { collectUntil, MAX_ISSUES, MAX_SEARCH_PAGES } from '../core/paging';
import { parseSearchPage } from '../core/parse';
import type { IssueSearch } from '../services/createReleaseNotes';

/**
 * Issue search over Jira `/rest/api/3/search/jql` page payloads.
 * Pages are followed in order when a page sets `nextPageToken` and `isLast: false`.
 */
export function createFixtureSearch(pages: readonly unknown[]): IssueSearch {
  return {
    async searchByJql() {
      const collected = await collectUntil(
        async (cursor) => {
          const index = cursor === undefined ? 0 : Number(cursor);
          if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
            throw new Error('Sample search fixture is missing the next page.');
          }
          const page = parseSearchPage(pages[index]);
          const nextIndex = index + 1;
          const more = !page.isLast && page.nextPageToken !== undefined;
          if (more && nextIndex >= pages.length) {
            throw new Error('Sample search fixture is missing the next page.');
          }
          return { items: page.issues, nextCursor: more ? String(nextIndex) : undefined };
        },
        MAX_ISSUES,
        MAX_SEARCH_PAGES,
      );
      return { issues: collected.items, truncated: collected.truncated };
    },
  };
}
