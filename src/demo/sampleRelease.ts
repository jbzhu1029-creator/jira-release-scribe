import { jqlForFixVersion, jqlSinceVersion, assertProjectKey } from '../core/jql';
import { toActionResult } from '../core/notes';
import { parseSearchPage, parseVersions, sortVersions, type JiraVersion } from '../core/parse';
import { buildConfluencePage, buildPageTitle } from '../core/publish';
import { tidyCustomerSummary } from '../core/text';
import { GROUP_LABELS, RELEASE_GROUPS, type ReleaseIssue, type ReleaseNotes } from '../core/types';
import { createReleaseNotes } from '../services/createReleaseNotes';
import { createFixtureSearch } from './fixtureSearch';

/** Fixed clock so the recording and the saved Markdown stay the same on every run. */
export const SAMPLE_GENERATED_AT = '2026-11-09T15:04:05.000Z';

/** Numeric space id used only to show the publish payload shape. */
export const SAMPLE_SPACE_ID = '10001';

export interface SampleSearch {
  versionName: string;
  pages: unknown[];
}

export interface SampleFixture {
  project: { id: string; key: string; name: string };
  versions: unknown[];
  release: SampleSearch;
  since: SampleSearch;
}

export interface DemoScene {
  id: string;
  title: string;
  /** How long this scene stays on screen, in milliseconds, at about 150 words per minute. */
  dwellMs: number;
  body: string;
}

export interface DemoFile {
  name: string;
  contents: string;
}

export interface SampleReleaseDemo {
  scenes: DemoScene[];
  files: DemoFile[];
  release: ReleaseNotes;
  since: ReleaseNotes;
  releaseJql: string;
  sinceJql: string;
  pageTitle: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as Record<string, unknown>;
}

function readSearch(value: unknown, label: string): SampleSearch {
  const body = asRecord(value);
  const versionName = typeof body?.versionName === 'string' ? body.versionName.trim() : '';
  const pages = Array.isArray(body?.pages) ? body.pages : undefined;
  if (!versionName || !pages || pages.length === 0) {
    throw new Error(`Sample fixture "${label}" needs a versionName and at least one search page.`);
  }
  return { versionName, pages };
}

export function parseSampleFixture(value: unknown): SampleFixture {
  const body = asRecord(value);
  const project = asRecord(body?.project);
  const key = typeof project?.key === 'string' ? project.key.trim() : '';
  const name = typeof project?.name === 'string' ? project.name.trim() : '';
  if (!key || !name) throw new Error('Sample fixture is missing a project key and name.');
  if (!Array.isArray(body?.versions)) throw new Error('Sample fixture is missing versions.');
  return {
    project: {
      id: project?.id != null ? String(project.id) : key,
      key,
      name,
    },
    versions: body.versions,
    release: readSearch(body?.release, 'release'),
    since: readSearch(body?.since, 'since'),
  };
}

function versionState(version: JiraVersion): string {
  if (version.archived) return 'archived';
  if (version.released) return 'released';
  return 'unreleased';
}

function formatVersion(version: JiraVersion): string {
  const date = version.releaseDate ?? '';
  return `  ${version.name.padEnd(6)}  ${versionState(version).padEnd(11)}  ${date}`.trimEnd();
}

function describePage(page: ReturnType<typeof parseSearchPage>, index: number, total: number): string {
  const tail = page.isLast ? 'last page.' : `next page token "${page.nextPageToken ?? ''}".`;
  return `Search page ${index + 1} of ${total}: ${page.issues.length} issues, ${tail}`;
}

function formatIssue(issue: ReleaseIssue): string {
  const meta = [issue.issueType, issue.status, issue.priority].filter((part): part is string => Boolean(part)).join(', ');
  return `  ${issue.key}  ${meta}\n    ${issue.summary}`;
}

function previewLines(value: string, maxLines: number, fileName: string): string {
  const lines = value.trimEnd().split('\n');
  if (lines.length <= maxLines) return lines.join('\n');
  const hidden = lines.length - maxLines;
  return `${lines.slice(0, maxLines).join('\n')}\n... ${hidden} more lines in demo/output/${fileName}`;
}

function storageExcerpt(storage: string): string {
  const needle = '&lt;script&gt;';
  const at = storage.indexOf(needle);
  if (at < 0) return storage.slice(0, 160);
  const li = storage.lastIndexOf('<li>', at);
  const start = li >= 0 && at - li < 220 ? li : at;
  const close = storage.indexOf('</li>', at);
  const end = close >= 0 ? close + '</li>'.length : at + needle.length;
  return storage.slice(start, end);
}

function customerCallout(issue: ReleaseIssue | undefined): string[] {
  if (!issue) return [];
  return [
    `${issue.key} engineering summary:`,
    `  ${issue.summary}`,
    `${issue.key} customer line:`,
    `  ${tidyCustomerSummary(issue.summary)}`,
    '',
  ];
}

function withTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function requireVersion(versions: JiraVersion[], versionName: string): void {
  if (!versions.some((version) => version.name === versionName)) {
    throw new Error(`Sample fixture has no version named ${versionName}.`);
  }
}

function formatClock(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Start-end clocks for each scene. demo/narration.md uses the same ranges. */
export function sceneClocks(scenes: readonly DemoScene[]): string[] {
  let cursor = 0;
  return scenes.map((scene) => {
    const start = cursor;
    cursor += scene.dwellMs;
    return `${formatClock(start)}-${formatClock(cursor)}`;
  });
}

export function formatScene(scene: DemoScene, index: number, total: number): string {
  const heading = `Scene ${index + 1} of ${total} - ${scene.title}`;
  return [
    'Release Scribe — offline demo',
    'Sample fixtures only. No Atlassian site is contacted.',
    '',
    heading,
    '-'.repeat(heading.length),
    scene.body,
  ].join('\n');
}

export async function buildSampleRelease(
  fixture: SampleFixture,
  generatedAt: string = SAMPLE_GENERATED_AT,
): Promise<SampleReleaseDemo> {
  const projectKey = assertProjectKey(fixture.project.key);
  const versions = sortVersions(parseVersions(fixture.versions));
  requireVersion(versions, fixture.release.versionName);
  requireVersion(versions, fixture.since.versionName);

  const releaseJql = jqlForFixVersion(projectKey, fixture.release.versionName);
  const sinceJql = jqlSinceVersion(projectKey, fixture.since.versionName);
  const release = await createReleaseNotes(createFixtureSearch(fixture.release.pages), {
    jql: releaseJql,
    title: `${projectKey} ${fixture.release.versionName}`,
    generatedAt,
    sourceDetail: `project ${projectKey}, fix version "${fixture.release.versionName}"`,
  });
  const since = await createReleaseNotes(createFixtureSearch(fixture.since.pages), {
    jql: sinceJql,
    title: `${projectKey} since ${fixture.since.versionName}`,
    generatedAt,
    sourceDetail: `project ${projectKey}, issues with a fix version after "${fixture.since.versionName}"`,
  });
  const sinceExecutive = toActionResult(since, 'executive');
  const pageTitle = buildPageTitle(release.title, release.generatedAt);
  const page = buildConfluencePage({ spaceId: SAMPLE_SPACE_ID, title: pageTitle, storage: release.storage });
  const releaseFile = `${projectKey}-${fixture.release.versionName}.md`;
  const sinceFile = `${projectKey}-since-${fixture.since.versionName}-executive.md`;
  const spotlight =
    RELEASE_GROUPS.flatMap((group) => release.groups[group]).find((issue) => issue.summary.includes('[INTERNAL]')) ??
    release.groups.features[0];

  const releasePages = fixture.release.pages.map((pagePayload) => parseSearchPage(pagePayload));
  const grouped = RELEASE_GROUPS.map((group) => {
    const issues = release.groups[group];
    const lines = issues.map(formatIssue);
    return [`${GROUP_LABELS[group]}  ${issues.length}`, ...lines].join('\n');
  }).join('\n\n');

  const scenes: DemoScene[] = [
    {
      id: 'sample-project',
      title: 'Sample project',
      dwellMs: 20_000,
      body: [
        `${fixture.project.name} (${projectKey})`,
        'Fix versions, unreleased first:',
        ...versions.map(formatVersion),
        '',
        `Drafting ${fixture.release.versionName}.`,
      ].join('\n'),
    },
    {
      id: 'fix-version-query',
      title: 'Fix version query',
      dwellMs: 19_000,
      body: ['JQL the project page and the draft-release-notes action both build:', '', releaseJql].join('\n'),
    },
    {
      id: 'grouped-issues',
      title: 'Issues from the sample search',
      dwellMs: 19_000,
      body: [
        ...releasePages.map((pagePayload, index) => describePage(pagePayload, index, releasePages.length)),
        '',
        `${release.issueCount} issues after parsing.`,
        '',
        grouped,
      ].join('\n'),
    },
    {
      id: 'engineering',
      title: 'Internal engineering',
      dwellMs: 18_000,
      body: release.audiences.engineering,
    },
    {
      id: 'customer',
      title: 'Customer-facing',
      dwellMs: 18_000,
      body: [...customerCallout(spotlight), release.audiences.customer].join('\n'),
    },
    {
      id: 'executive',
      title: 'Executive summary',
      dwellMs: 19_000,
      body: ['Audience: executive', '', release.audiences.executive].join('\n'),
    },
    {
      id: 'markdown-file',
      title: 'Markdown file',
      dwellMs: 18_000,
      body: [`Wrote demo/output/${releaseFile}`, '', previewLines(release.markdown, 16, releaseFile)].join('\n'),
    },
    {
      id: 'since-version',
      title: 'Changes since a version',
      dwellMs: 19_000,
      body: [
        'Action: changes-since-version',
        'Audience: executive',
        `JQL: ${sinceJql}`,
        '',
        `${since.issueCount} issues. Counts: ${RELEASE_GROUPS.map((group) => `${GROUP_LABELS[group]} ${since.counts[group]}`).join(', ')}.`,
        '',
        'Returned markdown:',
        sinceExecutive.markdown,
        '',
        `Wrote demo/output/${sinceFile}`,
      ].join('\n'),
    },
    {
      id: 'confluence-payload',
      title: 'Confluence page payload',
      dwellMs: 21_000,
      body: [
        `Space id: ${page.spaceId}`,
        'This id is sample data for the payload shape.',
        `Title: ${page.title}`,
        'Method: POST /wiki/api/v2/pages',
        `Body representation: ${page.body.representation}`,
        '',
        'Excerpt around the escaped script tag:',
        storageExcerpt(page.body.value),
        '',
        'This demo builds the payload and stops.',
        'Release Scribe has not been installed on an Atlassian site.',
      ].join('\n'),
    },
  ];

  return {
    scenes,
    files: [
      { name: releaseFile, contents: withTrailingNewline(release.markdown) },
      { name: sinceFile, contents: withTrailingNewline(sinceExecutive.markdown) },
    ],
    release,
    since,
    releaseJql,
    sinceJql,
    pageTitle,
  };
}
