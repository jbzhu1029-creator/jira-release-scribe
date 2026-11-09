import { MAX_ISSUES } from './paging';
import { clip, collapseWhitespace, formatUtcDate, stripControlChars } from './text';
import type { ReleaseIssue } from './types';

export interface ConfluencePagePayload {
  spaceId: string;
  status: 'current';
  title: string;
  body: {
    representation: 'storage';
    value: string;
  };
}

const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;

export function assertPageTitle(title: string): string {
  const cleaned = collapseWhitespace(stripControlChars(title));
  if (!cleaned) throw new Error('Page title is required.');
  return clip(cleaned, 255);
}

export function buildPageTitle(releaseTitle: string, generatedAtIso: string): string {
  const date = formatUtcDate(generatedAtIso);
  return assertPageTitle(`Release notes: ${collapseWhitespace(releaseTitle) || 'Release'} (${date})`);
}

export function buildConfluencePage(input: { spaceId: string; title: string; storage: string }): ConfluencePagePayload {
  const spaceId = input.spaceId.trim();
  if (!/^\d+$/.test(spaceId)) throw new Error('Choose a Confluence space.');
  return {
    spaceId,
    status: 'current',
    title: assertPageTitle(input.title),
    body: { representation: 'storage', value: input.storage },
  };
}

function optionalText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = collapseWhitespace(value);
  return cleaned ? clip(cleaned, max) : undefined;
}

/** Keep only well-formed issues. Publish rebuilds notes from this list, so HTML cannot be injected. */
export function sanitizeIssues(value: unknown): ReleaseIssue[] {
  if (!Array.isArray(value)) return [];
  const issues: ReleaseIssue[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    const key = typeof record.key === 'string' ? record.key.trim().toUpperCase() : '';
    if (!ISSUE_KEY.test(key)) continue;
    issues.push({
      key,
      summary: optionalText(record.summary, 500) ?? '(no summary)',
      issueType: optionalText(record.issueType, 80) ?? 'Unknown',
      status: optionalText(record.status, 80),
      priority: optionalText(record.priority, 80),
    });
    if (issues.length >= MAX_ISSUES) break;
  }
  return issues;
}
