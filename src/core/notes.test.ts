import { describe, expect, it } from 'vitest';
import { groupForIssueType, groupIssues } from './group';
import { generateReleaseNotes, parseAudience, ruleBasedRewriter, toActionResult } from './notes';
import type { ReleaseIssue, SummaryRewriter } from './types';

function issue(partial: Partial<ReleaseIssue> & Pick<ReleaseIssue, 'key' | 'summary' | 'issueType'>): ReleaseIssue {
  return { ...partial };
}

const generatedAt = '2026-11-09T15:04:05.000Z';

describe('groupForIssueType', () => {
  it('maps stories, features, and epics to features', () => {
    expect(groupForIssueType('Story')).toBe('features');
    expect(groupForIssueType('new feature')).toBe('features');
    expect(groupForIssueType('Epic')).toBe('features');
  });

  it('maps bugs, defects, and regressions before feature-like names', () => {
    expect(groupForIssueType('Bug')).toBe('bugfixes');
    expect(groupForIssueType('BUG')).toBe('bugfixes');
    expect(groupForIssueType('Production defect')).toBe('bugfixes');
    expect(groupForIssueType('Regression')).toBe('bugfixes');
    expect(groupForIssueType('Bug Story')).toBe('bugfixes');
  });

  it('maps improvements and leaves tasks in other', () => {
    expect(groupForIssueType('Improvement')).toBe('improvements');
    expect(groupForIssueType('Enhancement')).toBe('improvements');
    expect(groupForIssueType('Task')).toBe('other');
    expect(groupForIssueType('Sub-task')).toBe('other');
    expect(groupForIssueType('Spike')).toBe('other');
  });

  it('keeps input order inside each group', () => {
    const groups = groupIssues([
      issue({ key: 'PROJ-2', summary: 'Second', issueType: 'Story' }),
      issue({ key: 'PROJ-1', summary: 'First', issueType: 'Story' }),
      issue({ key: 'PROJ-9', summary: 'Chore', issueType: 'Task' }),
    ]);
    expect(groups.features.map((item) => item.key)).toEqual(['PROJ-2', 'PROJ-1']);
    expect(groups.other.map((item) => item.key)).toEqual(['PROJ-9']);
  });
});

describe('generateReleaseNotes', () => {
  const notes = generateReleaseNotes({
    title: 'PROJ 1.2.0',
    generatedAt,
    sourceDetail: 'project PROJ, fix version "1.2.0"',
    issues: [
      issue({
        key: 'PROJ-1',
        summary: '[INTERNAL] feat: Export notes to Confluence',
        issueType: 'Story',
        status: 'Done',
        priority: 'High',
      }),
      issue({
        key: 'PROJ-2',
        summary: 'Faster board load',
        issueType: 'Improvement',
        status: 'Done',
      }),
      issue({
        key: 'PROJ-3',
        summary: 'Fix *login* crash <script>',
        issueType: 'Bug',
        status: 'Done',
        priority: 'Highest',
      }),
      issue({ key: 'PROJ-4', summary: 'Update CI runners', issueType: 'Task' }),
    ],
  });

  it('counts every section', () => {
    expect(notes.counts).toEqual({ features: 1, improvements: 1, bugfixes: 1, other: 1 });
    expect(notes.issueCount).toBe(4);
  });

  it('keeps keys, status, and the raw summary for engineering', () => {
    expect(notes.audiences.engineering).toContain('**PROJ-1**');
    expect(notes.audiences.engineering).toContain('[INTERNAL] feat: Export notes to Confluence');
    expect(notes.audiences.engineering).toContain('(Done, High)');
    expect(notes.audiences.engineering).toContain('Source: project PROJ, fix version "1.2.0".');
    expect(notes.audiences.engineering).toContain('\\*login\\*');
  });

  it('omits keys, tags, and the query from customer copy', () => {
    expect(notes.audiences.customer).not.toContain('PROJ-');
    expect(notes.audiences.customer).not.toContain('[INTERNAL]');
    expect(notes.audiences.customer).not.toContain('feat:');
    expect(notes.audiences.customer).not.toContain('fix version');
    expect(notes.audiences.customer).toContain('Export notes to Confluence');
    expect(notes.audiences.customer).toContain('### Other');
    expect(notes.audiences.customer).toContain('Update CI runners');
  });

  it('writes a single executive paragraph with counts and feature highlights', () => {
    expect(notes.audiences.executive).not.toContain('\n');
    expect(notes.audiences.executive).toContain('1 feature, 1 improvement, 1 bug fix, and 1 other change');
    expect(notes.audiences.executive).toContain(
      'Highlights include Export notes to Confluence, Faster board load, and Fix \\*login\\* crash <script>.',
    );
    expect(notes.audiences.executive).not.toContain('PROJ-');
  });

  it('renders the combined markdown document', () => {
    expect(notes.markdown.startsWith('# Release notes: PROJ 1.2.0')).toBe(true);
    expect(notes.markdown).toContain('_Generated 2026-11-09 (UTC) by Release Scribe. 4 issues._');
    expect(notes.markdown).toContain('## Internal engineering');
    expect(notes.markdown).toContain('## Customer-facing');
    expect(notes.markdown).toContain('## Executive summary');
  });

  it('escapes storage markup from issue text', () => {
    expect(notes.storage).toContain('<h2>Internal engineering</h2>');
    expect(notes.storage).toContain('<strong>PROJ-3</strong>');
    expect(notes.storage).toContain('&lt;script&gt;');
    expect(notes.storage).not.toContain('<script>');
  });

  it('says when a section is empty for engineering and hides it from customers', () => {
    const emptyFeatures = generateReleaseNotes({
      title: 'Patch',
      generatedAt,
      issues: [issue({ key: 'PROJ-8', summary: 'Null pointer on save', issueType: 'Bug' })],
    });
    expect(emptyFeatures.audiences.engineering).toContain('### Features');
    expect(emptyFeatures.audiences.engineering).toContain('_None._');
    expect(emptyFeatures.audiences.customer).not.toContain('### Features');
    expect(emptyFeatures.audiences.executive).toBe('Patch includes 1 bug fix. Highlights include Null pointer on save.');
  });

  it('describes an empty release without inventing highlights', () => {
    const empty = generateReleaseNotes({ title: 'PROJ 9.0.0', generatedAt, issues: [] });
    expect(empty.audiences.executive).toBe('PROJ 9.0.0 has no issues in scope.');
    expect(empty.markdown).toContain('0 issues.');
  });

  it('adds a truncation sentence', () => {
    const truncated = generateReleaseNotes({
      title: 'Big',
      generatedAt,
      truncated: true,
      issues: [issue({ key: 'PROJ-1', summary: 'One change', issueType: 'Story' })],
    });
    expect(truncated.audiences.executive).toContain('This draft includes only the first 200 matching issues.');
    expect(truncated.markdown).toContain('Results were truncated at 200 issues.');
  });

  it('uses an optional rewriter for customer and executive text only', () => {
    const rewriter: SummaryRewriter = {
      rewrite(summary, audience) {
        return `${audience}:${summary}`;
      },
    };
    const rewritten = generateReleaseNotes(
      {
        title: 'Rewritten',
        generatedAt,
        issues: [issue({ key: 'PROJ-1', summary: 'Ship filters', issueType: 'Story', status: 'Done' })],
      },
      rewriter,
    );
    expect(rewritten.audiences.customer).toContain('customer:Ship filters');
    expect(rewritten.audiences.executive).toContain('executive:Ship filters');
    expect(rewritten.audiences.engineering).toContain('Ship filters');
    expect(rewritten.audiences.engineering).not.toContain('customer:');
    expect(rewritten.audiences.engineering).not.toContain('executive:');
  });

  it('falls back when a rewriter throws', () => {
    const rewriter: SummaryRewriter = {
      rewrite() {
        throw new Error('model offline');
      },
    };
    const rewritten = generateReleaseNotes(
      {
        title: 'Fallback',
        generatedAt,
        issues: [issue({ key: 'PROJ-1', summary: 'feat: Ship filters', issueType: 'Story' })],
      },
      rewriter,
    );
    expect(rewritten.audiences.customer).toContain('Ship filters');
    expect(rewritten.audiences.customer).not.toContain('feat:');
  });

  it('keeps the default rewriter rule-based', () => {
    expect(ruleBasedRewriter.rewrite('[WIP] chore: tidy logs', 'customer')).toBe('tidy logs');
  });
});

describe('audiences', () => {
  const notes = generateReleaseNotes({
    title: 'PROJ 1.0.0',
    generatedAt,
    issues: [issue({ key: 'PROJ-1', summary: 'Add export', issueType: 'Story' })],
  });

  it('parses audience aliases', () => {
    expect(parseAudience(undefined)).toBe('all');
    expect(parseAudience(' internal ')).toBe('engineering');
    expect(parseAudience('customers')).toBe('customer');
    expect(parseAudience('exec')).toBe('executive');
    expect(() => parseAudience('legal')).toThrow(/Audience/);
  });

  it('returns one audience to a Rovo action', () => {
    const result = toActionResult(notes, 'executive');
    expect(result.markdown).toBe(notes.audiences.executive);
    expect(result.audiences).toEqual({ executive: notes.audiences.executive });
    expect(result).not.toHaveProperty('storage');
  });
});
