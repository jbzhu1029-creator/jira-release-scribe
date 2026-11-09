import { describe, expect, it } from 'vitest';
import { buildConfluencePage, buildPageTitle, sanitizeIssues } from './publish';

describe('Confluence page payload', () => {
  it('builds a storage-format page for a numeric space id', () => {
    expect(buildConfluencePage({ spaceId: ' 99 ', title: 'Notes', storage: '<p>Hi</p>' })).toEqual({
      spaceId: '99',
      status: 'current',
      title: 'Notes',
      body: { representation: 'storage', value: '<p>Hi</p>' },
    });
  });

  it('rejects a space id that is not numeric', () => {
    expect(() => buildConfluencePage({ spaceId: 'REL', title: 'Notes', storage: '<p>Hi</p>' })).toThrow(/space/);
  });

  it('strips control characters and caps the title at 255 characters', () => {
    expect(buildPageTitle('PROJ\n1.2.0', '2026-11-09T00:00:00.000Z')).toBe('Release notes: PROJ 1.2.0 (2026-11-09)');
    const title = buildPageTitle('A'.repeat(300), '2026-11-09T00:00:00.000Z');
    expect(title.length).toBeLessThanOrEqual(255);
    expect(title.endsWith('...')).toBe(true);
  });

  it('drops malformed issues and keeps at most 200', () => {
    const issues = sanitizeIssues([
      { key: 'proj-1', summary: '  Kept  ', issueType: 'Story', status: 'Done' },
      { key: 'not a key', summary: 'Dropped' },
      { key: 'PROJ-2', summary: `<script>${'x'.repeat(600)}`, issueType: 'Bug' },
      ...Array.from({ length: 250 }, (_, index) => ({
        key: `PROJ-${index + 10}`,
        summary: `Item ${index}`,
        issueType: 'Task',
      })),
    ]);
    expect(issues[0]).toEqual({ key: 'PROJ-1', summary: 'Kept', issueType: 'Story', status: 'Done' });
    expect(issues[1]?.summary.startsWith('<script>')).toBe(true);
    expect(issues[1]?.summary.length).toBeLessThanOrEqual(500);
    expect(issues).toHaveLength(200);
    expect(issues.some((issue) => issue.key === 'NOT A KEY')).toBe(false);
  });
});
