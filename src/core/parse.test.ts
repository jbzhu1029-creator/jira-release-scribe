import { describe, expect, it } from 'vitest';
import { confluencePageUrl, parseIssue, parseProjects, parseSearchPage, parseSpaces, parseVersions, readCursor, sortVersions } from './parse';

describe('Jira parsers', () => {
  it('reads an issue and skips a payload with no key', () => {
    expect(
      parseIssue({
        key: 'PROJ-7',
        fields: { summary: 'Ship it', issuetype: { name: 'Story' }, status: { name: 'Done' }, priority: { name: 'Low' } },
      }),
    ).toEqual({
      key: 'PROJ-7',
      summary: 'Ship it',
      issueType: 'Story',
      status: 'Done',
      priority: 'Low',
    });
    expect(parseIssue({ fields: { summary: 'Missing key' } })).toBeUndefined();
    expect(parseIssue({ key: 'PROJ-8', fields: {} })?.summary).toBe('(no summary)');
  });

  it('reads a search page and defaults isLast when the token is absent', () => {
    const page = parseSearchPage({
      issues: [{ key: 'PROJ-1', fields: { summary: 'One', issuetype: { name: 'Bug' } } }, { id: 'no-key' }],
      nextPageToken: 'token-2',
      isLast: false,
    });
    expect(page.issues).toHaveLength(1);
    expect(page.nextPageToken).toBe('token-2');
    expect(page.isLast).toBe(false);
    expect(parseSearchPage({ issues: [] }).isLast).toBe(true);
  });

  it('sorts unreleased versions ahead of released and archived ones', () => {
    const sorted = sortVersions(
      parseVersions([
        { id: '1', name: '1.0', released: true, archived: false, releaseDate: '2026-01-01' },
        { id: '2', name: '1.10', released: false, archived: false },
        { id: '3', name: '0.9', released: true, archived: true, releaseDate: '2025-01-01' },
        { id: '4', name: '1.2', released: true, archived: false, releaseDate: '2026-06-01' },
        { id: '5', name: '1.2', released: false, archived: false },
      ]),
    );
    expect(sorted.map((version) => version.name)).toEqual(['1.2', '1.10', '1.2', '1.0', '0.9']);
    expect(sorted[0]?.released).toBe(false);
    expect(sorted[4]?.archived).toBe(true);
  });

  it('reads project search pagination', () => {
    const page = parseProjects({
      startAt: 0,
      maxResults: 50,
      isLast: false,
      values: [{ id: '100', key: 'PROJ', name: 'Project' }, { key: '' }],
    });
    expect(page.projects).toEqual([{ id: '100', key: 'PROJ', name: 'Project' }]);
    expect(page.nextStart).toBe(50);
    expect(parseProjects({ isLast: true, values: [] }).nextStart).toBeUndefined();
  });
});

describe('Confluence parsers', () => {
  it('reads a cursor from a relative or absolute next link', () => {
    expect(readCursor('/wiki/api/v2/spaces?cursor=abc%20def')).toBe('abc def');
    expect(readCursor('https://site.atlassian.net/wiki/api/v2/spaces?cursor=next')).toBe('next');
    expect(readCursor('/wiki/api/v2/spaces')).toBeUndefined();
    expect(readCursor(undefined)).toBeUndefined();
  });

  it('reads spaces and the cursor', () => {
    const page = parseSpaces({
      results: [{ id: 42, key: 'REL', name: 'Releases' }],
      _links: { next: '/wiki/api/v2/spaces?cursor=page-2' },
    });
    expect(page.spaces).toEqual([{ id: '42', key: 'REL', name: 'Releases' }]);
    expect(page.nextCursor).toBe('page-2');
  });

  it('joins a page base URL and webui path', () => {
    expect(
      confluencePageUrl({
        _links: { base: 'https://site.atlassian.net/wiki', webui: '/spaces/REL/pages/10/Notes' },
      }),
    ).toBe('https://site.atlassian.net/wiki/spaces/REL/pages/10/Notes');
    expect(confluencePageUrl({})).toBeUndefined();
  });
});
