import { GROUP_LABELS, RELEASE_GROUPS, type GroupedIssues, type ReleaseGroup, type ReleaseIssue } from './types';

const FEATURE_TYPES = new Set(['story', 'feature', 'new feature', 'epic']);
const IMPROVEMENT_TYPES = new Set(['improvement', 'enhancement', 'change']);

/**
 * Map a Jira issue type name onto a release-note section.
 * Bug-like names win over feature-like names so "Bug Story" is not announced as a feature.
 */
export function groupForIssueType(issueType: string): ReleaseGroup {
  const name = issueType.trim().toLowerCase();
  if (name.includes('bug') || name.includes('defect') || name.includes('regress')) return 'bugfixes';
  if (FEATURE_TYPES.has(name) || name.includes('feature')) return 'features';
  if (IMPROVEMENT_TYPES.has(name) || name.includes('improve') || name.includes('enhance')) {
    return 'improvements';
  }
  return 'other';
}

export function emptyGroups(): GroupedIssues {
  return { features: [], improvements: [], bugfixes: [], other: [] };
}

export function groupIssues(issues: ReleaseIssue[]): GroupedIssues {
  const groups = emptyGroups();
  for (const issue of issues) {
    groups[groupForIssueType(issue.issueType)].push(issue);
  }
  return groups;
}

export function countGroups(groups: GroupedIssues): Record<ReleaseGroup, number> {
  return {
    features: groups.features.length,
    improvements: groups.improvements.length,
    bugfixes: groups.bugfixes.length,
    other: groups.other.length,
  };
}

export { GROUP_LABELS, RELEASE_GROUPS };
