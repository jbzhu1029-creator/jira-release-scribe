export const RELEASE_GROUPS = ['features', 'improvements', 'bugfixes', 'other'] as const;

export type ReleaseGroup = (typeof RELEASE_GROUPS)[number];

export const GROUP_LABELS: Record<ReleaseGroup, string> = {
  features: 'Features',
  improvements: 'Improvements',
  bugfixes: 'Bug fixes',
  other: 'Other',
};

export type Audience = 'engineering' | 'customer' | 'executive';

export interface ReleaseIssue {
  key: string;
  summary: string;
  issueType: string;
  status?: string;
  priority?: string;
}

export interface GroupedIssues {
  features: ReleaseIssue[];
  improvements: ReleaseIssue[];
  bugfixes: ReleaseIssue[];
  other: ReleaseIssue[];
}

export interface ReleaseNotesInput {
  title: string;
  generatedAt: string;
  issues: ReleaseIssue[];
  truncated?: boolean;
  /** Shown only in the engineering section, so customer copy stays free of query text. */
  sourceDetail?: string;
}

export interface ReleaseNotes {
  title: string;
  generatedAt: string;
  truncated: boolean;
  issueCount: number;
  groups: GroupedIssues;
  counts: Record<ReleaseGroup, number>;
  audiences: Record<Audience, string>;
  markdown: string;
  storage: string;
  sourceDetail?: string;
}

export interface SummaryRewriter {
  rewrite(summary: string, audience: 'customer' | 'executive'): string;
}
