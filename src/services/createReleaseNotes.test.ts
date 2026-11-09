import { describe, expect, it, vi } from 'vitest';
import { createReleaseNotes } from './createReleaseNotes';
import type { IssueSearch } from './createReleaseNotes';

describe('createReleaseNotes', () => {
  it('searches with the given JQL and keeps the truncation flag', async () => {
    const search: IssueSearch = {
      searchByJql: vi.fn(async () => ({
        issues: [{ key: 'PROJ-4', summary: 'Close the dialog', issueType: 'Bug', status: 'Done' }],
        truncated: true,
      })),
    };
    const notes = await createReleaseNotes(search, {
      jql: 'project = PROJ AND fixVersion = "1.2.0"',
      title: 'PROJ 1.2.0',
      generatedAt: '2026-11-09T00:00:00.000Z',
      sourceDetail: 'project PROJ, fix version "1.2.0"',
    });
    expect(search.searchByJql).toHaveBeenCalledWith('project = PROJ AND fixVersion = "1.2.0"');
    expect(notes.truncated).toBe(true);
    expect(notes.counts.bugfixes).toBe(1);
    expect(notes.audiences.engineering).toContain('Source: project PROJ, fix version "1.2.0".');
  });

  it('rejects an empty query before searching', async () => {
    const search: IssueSearch = { searchByJql: vi.fn(async () => ({ issues: [], truncated: false })) };
    await expect(
      createReleaseNotes(search, { jql: '  ', title: 'Empty', generatedAt: '2026-11-09T00:00:00.000Z' }),
    ).rejects.toThrow(/JQL/);
    expect(search.searchByJql).not.toHaveBeenCalled();
  });
});
