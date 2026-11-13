import { countGroups, groupIssues } from './group';
import { clip, collapseWhitespace, escapeMarkdown, escapeXml, formatUtcDate, joinAnd, plural, tidyCustomerSummary } from './text';
import {
  GROUP_LABELS,
  RELEASE_GROUPS,
  type Audience,
  type GroupedIssues,
  type ReleaseGroup,
  type ReleaseIssue,
  type ReleaseNotes,
  type ReleaseNotesInput,
  type SummaryRewriter,
} from './types';

export const EMPTY_RELEASE_NEXT_STEP =
  'Confirm the version name, or use a JQL query if the work is not on a fix version.';

export const EMPTY_RELEASE_GUIDANCE = `No issues matched. ${EMPTY_RELEASE_NEXT_STEP}`;

export const TRUNCATION_NOTICE =
  'This draft includes only the first 200 matching issues. Narrow the version or the query before you publish or share it.';

export interface DraftNotice {
  appearance: 'information' | 'warning';
  title: string;
  body: string;
}

export function draftNotices(notes: { issueCount: number; truncated: boolean }): DraftNotice[] {
  const notices: DraftNotice[] = [];
  if (notes.issueCount === 0) {
    notices.push({ appearance: 'information', title: 'No issues matched', body: EMPTY_RELEASE_GUIDANCE });
  }
  if (notes.truncated) {
    notices.push({ appearance: 'warning', title: 'Showing the first 200 issues', body: TRUNCATION_NOTICE });
  }
  return notices;
}

export const ruleBasedRewriter: SummaryRewriter = {
  rewrite(summary) {
    return tidyCustomerSummary(summary);
  },
};

type Part = { style: 'text' | 'strong' | 'em'; text: string };

interface Bullet {
  parts: Part[];
}

interface Block {
  heading: string;
  level: 2 | 3;
  intro?: string;
  bullets?: Bullet[];
  emptyText?: string;
  paragraph?: string;
}

function rewriteSummary(rewriter: SummaryRewriter, summary: string, audience: 'customer' | 'executive'): string {
  try {
    const rewritten = collapseWhitespace(rewriter.rewrite(summary, audience) ?? '');
    return rewritten || tidyCustomerSummary(summary);
  } catch {
    return tidyCustomerSummary(summary);
  }
}

function engineeringBullet(issue: ReleaseIssue): Bullet {
  const parts: Part[] = [
    { style: 'strong', text: issue.key },
    { style: 'text', text: ` — ${collapseWhitespace(issue.summary)}` },
  ];
  const meta = [issue.status, issue.priority].filter((value): value is string => Boolean(value)).join(', ');
  if (meta) {
    parts.push({ style: 'text', text: ' ' });
    parts.push({ style: 'em', text: `(${meta})` });
  }
  return { parts };
}

function customerBullet(issue: ReleaseIssue, rewriter: SummaryRewriter): Bullet {
  return { parts: [{ style: 'text', text: rewriteSummary(rewriter, issue.summary, 'customer') }] };
}

function renderPartsMarkdown(parts: Part[]): string {
  return parts
    .map((part) => {
      const text = escapeMarkdown(part.text);
      if (part.style === 'strong') return `**${text}**`;
      if (part.style === 'em') return `_${text}_`;
      return text;
    })
    .join('');
}

function renderPartsXml(parts: Part[]): string {
  return parts
    .map((part) => {
      const text = escapeXml(part.text);
      if (part.style === 'strong') return `<strong>${text}</strong>`;
      if (part.style === 'em') return `<em>${text}</em>`;
      return text;
    })
    .join('');
}

function renderBlockMarkdown(block: Block): string {
  const lines = [`${'#'.repeat(block.level)} ${block.heading}`];
  if (block.intro) lines.push('', escapeMarkdown(block.intro));
  if (block.paragraph) lines.push('', escapeMarkdown(block.paragraph));
  if (block.bullets) {
    lines.push('');
    if (block.bullets.length === 0) lines.push(block.emptyText ?? '_None._');
    else for (const bullet of block.bullets) lines.push(`- ${renderPartsMarkdown(bullet.parts)}`);
  }
  return lines.join('\n');
}

function renderBlockXml(block: Block): string {
  const tag = block.level === 2 ? 'h2' : 'h3';
  const chunks = [`<${tag}>${escapeXml(block.heading)}</${tag}>`];
  if (block.intro) chunks.push(`<p>${escapeXml(block.intro)}</p>`);
  if (block.paragraph) chunks.push(`<p>${escapeXml(block.paragraph)}</p>`);
  if (block.bullets) {
    if (block.bullets.length === 0) chunks.push(`<p>${escapeXml(block.emptyText ?? 'None.')}</p>`);
    else chunks.push(`<ul>${block.bullets.map((bullet) => `<li>${renderPartsXml(bullet.parts)}</li>`).join('')}</ul>`);
  }
  return chunks.join('');
}

function countSentence(title: string, counts: Record<ReleaseGroup, number>): string {
  const parts: string[] = [];
  if (counts.features) parts.push(plural(counts.features, 'feature', 'features'));
  if (counts.improvements) parts.push(plural(counts.improvements, 'improvement', 'improvements'));
  if (counts.bugfixes) parts.push(plural(counts.bugfixes, 'bug fix', 'bug fixes'));
  if (counts.other) parts.push(plural(counts.other, 'other change', 'other changes'));
  if (parts.length === 0) return `${title} has no issues in scope. ${EMPTY_RELEASE_NEXT_STEP}`;
  return `${title} includes ${joinAnd(parts)}.`;
}

function highlightSentence(groups: GroupedIssues, rewriter: SummaryRewriter): string {
  const pool = [...groups.features, ...groups.improvements, ...groups.bugfixes, ...groups.other];
  const highlights = pool
    .slice(0, 3)
    .map((issue) => clip(rewriteSummary(rewriter, issue.summary, 'executive'), 120))
    .filter((highlight) => highlight.length > 0);
  if (highlights.length === 0) return '';
  return ` Highlights include ${joinAnd(highlights)}.`;
}

function executiveParagraph(
  title: string,
  counts: Record<ReleaseGroup, number>,
  groups: GroupedIssues,
  truncated: boolean,
  rewriter: SummaryRewriter,
): string {
  const truncation = truncated ? ` ${TRUNCATION_NOTICE}` : '';
  return `${countSentence(title, counts)}${highlightSentence(groups, rewriter)}${truncation}`;
}

export function generateReleaseNotes(input: ReleaseNotesInput, rewriter: SummaryRewriter = ruleBasedRewriter): ReleaseNotes {
  const title = collapseWhitespace(input.title) || 'Release';
  const groups = groupIssues(input.issues);
  const counts = countGroups(groups);
  const truncated = input.truncated === true;
  const date = formatUtcDate(input.generatedAt);
  const subtitle = truncated
    ? `Generated ${date} (UTC) by Release Scribe. ${input.issues.length} issues shown. Results were truncated at 200 issues.`
    : `Generated ${date} (UTC) by Release Scribe. ${plural(input.issues.length, 'issue', 'issues')}.`;

  const engineeringIntro = [
    input.sourceDetail
      ? `Written for the team that shipped the work. Each line keeps the issue key, status, and priority. Source: ${collapseWhitespace(input.sourceDetail)}.`
      : 'Written for the team that shipped the work. Each line keeps the issue key, status, and priority.',
    input.issues.length === 0 ? EMPTY_RELEASE_GUIDANCE : '',
    truncated ? TRUNCATION_NOTICE : '',
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  const customerIntro = [
    'Written for people who use the product. Issue keys and internal status are omitted.',
    truncated ? TRUNCATION_NOTICE : '',
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  const engineeringBlocks: Block[] = RELEASE_GROUPS.map((group) => ({
    heading: GROUP_LABELS[group],
    level: 3,
    bullets: groups[group].map(engineeringBullet),
    emptyText: '_None._',
  }));

  const customerBlocks: Block[] = RELEASE_GROUPS.filter((group) => groups[group].length > 0).map((group) => ({
    heading: GROUP_LABELS[group],
    level: 3,
    bullets: groups[group].map((issue) => customerBullet(issue, rewriter)),
  }));

  const executive = executiveParagraph(title, counts, groups, truncated, rewriter);
  const executiveMarkdown = escapeMarkdown(executive);

  const engineeringSection: Block[] = [
    { heading: 'Internal engineering', level: 2, intro: engineeringIntro },
    ...engineeringBlocks,
  ];
  const customerSection: Block[] = [
    {
      heading: 'Customer-facing',
      level: 2,
      intro: customerIntro,
      paragraph: input.issues.length === 0 ? EMPTY_RELEASE_GUIDANCE : undefined,
    },
    ...customerBlocks,
  ];
  const executiveSection: Block[] = [{ heading: 'Executive summary', level: 2, paragraph: executive }];

  const audiences: Record<Audience, string> = {
    engineering: engineeringSection.map(renderBlockMarkdown).join('\n\n'),
    customer: customerSection.map(renderBlockMarkdown).join('\n\n'),
    executive: executiveMarkdown,
  };

  const markdown = [
    `# Release notes: ${escapeMarkdown(title)}`,
    '',
    `_${escapeMarkdown(subtitle)}_`,
    '',
    audiences.engineering,
    '',
    audiences.customer,
    '',
    executiveSection.map(renderBlockMarkdown).join('\n\n'),
    '',
  ].join('\n');

  const storage = [
    `<h1>Release notes: ${escapeXml(title)}</h1>`,
    `<p><em>${escapeXml(subtitle)}</em></p>`,
    ...engineeringSection.map(renderBlockXml),
    ...customerSection.map(renderBlockXml),
    ...executiveSection.map(renderBlockXml),
  ].join('');

  return {
    title,
    generatedAt: input.generatedAt,
    truncated,
    issueCount: input.issues.length,
    groups,
    counts,
    audiences,
    markdown,
    storage,
    sourceDetail: input.sourceDetail ? collapseWhitespace(input.sourceDetail) : undefined,
  };
}

export function parseAudience(value: unknown): Audience | 'all' {
  if (value == null || value === '' || value === 'all') return 'all';
  const normalised = String(value).trim().toLowerCase();
  if (normalised === 'engineering' || normalised === 'internal' || normalised === 'internal engineering') {
    return 'engineering';
  }
  if (normalised === 'customer' || normalised === 'customer-facing' || normalised === 'customers') return 'customer';
  if (normalised === 'executive' || normalised === 'exec' || normalised === 'summary') return 'executive';
  throw new Error('Audience must be engineering, customer, executive, or all.');
}

export function toActionResult(notes: ReleaseNotes, audience: Audience | 'all') {
  return {
    title: notes.title,
    generatedAt: notes.generatedAt,
    issueCount: notes.issueCount,
    truncated: notes.truncated,
    counts: notes.counts,
    markdown: audience === 'all' ? notes.markdown : notes.audiences[audience],
    audiences: audience === 'all' ? notes.audiences : { [audience]: notes.audiences[audience] },
  };
}
