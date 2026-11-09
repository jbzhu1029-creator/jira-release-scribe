import type { ReleaseIssue } from './types';

export interface JiraVersion {
  id: string;
  name: string;
  released: boolean;
  archived: boolean;
  releaseDate?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as Record<string, unknown>;
}

function nestedName(value: unknown): string | undefined {
  const record = asRecord(value);
  const name = record?.name;
  return typeof name === 'string' && name.trim() ? name : undefined;
}

export function parseIssue(raw: unknown): ReleaseIssue | undefined {
  const issue = asRecord(raw);
  if (!issue) return undefined;
  const key = typeof issue.key === 'string' ? issue.key.trim() : '';
  if (!key) return undefined;
  const fields = asRecord(issue.fields) ?? {};
  const summary = typeof fields.summary === 'string' && fields.summary.trim() ? fields.summary : '(no summary)';
  return {
    key,
    summary,
    issueType: nestedName(fields.issuetype) ?? 'Unknown',
    status: nestedName(fields.status),
    priority: nestedName(fields.priority),
  };
}

export function parseSearchPage(payload: unknown): {
  issues: ReleaseIssue[];
  nextPageToken?: string;
  isLast: boolean;
} {
  const body = asRecord(payload) ?? {};
  const rawIssues = Array.isArray(body.issues) ? body.issues : [];
  const issues = rawIssues.flatMap((raw) => {
    const issue = parseIssue(raw);
    return issue ? [issue] : [];
  });
  const nextPageToken = typeof body.nextPageToken === 'string' && body.nextPageToken ? body.nextPageToken : undefined;
  const isLast = typeof body.isLast === 'boolean' ? body.isLast : !nextPageToken;
  return { issues, nextPageToken, isLast };
}

export function parseVersions(payload: unknown): JiraVersion[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((raw) => {
    const version = asRecord(raw);
    if (!version || typeof version.name !== 'string' || !version.name) return [];
    return [
      {
        id: version.id != null ? String(version.id) : version.name,
        name: version.name,
        released: version.released === true,
        archived: version.archived === true,
        releaseDate: typeof version.releaseDate === 'string' ? version.releaseDate : undefined,
      },
    ];
  });
}

export function sortVersions(versions: JiraVersion[]): JiraVersion[] {
  return [...versions].sort((left, right) => {
    if (left.archived !== right.archived) return left.archived ? 1 : -1;
    if (left.released !== right.released) return left.released ? 1 : -1;
    const byDate = (right.releaseDate ?? '').localeCompare(left.releaseDate ?? '');
    if (byDate !== 0) return byDate;
    return left.name.localeCompare(right.name, undefined, { numeric: true });
  });
}

export function parseProjects(payload: unknown): { projects: JiraProject[]; isLast: boolean; nextStart?: number } {
  const body = asRecord(payload) ?? {};
  const values = Array.isArray(body.values) ? body.values : [];
  const projects = values.flatMap((raw) => {
    const project = asRecord(raw);
    if (!project || typeof project.key !== 'string' || !project.key) return [];
    return [
      {
        id: project.id != null ? String(project.id) : project.key,
        key: project.key,
        name: typeof project.name === 'string' && project.name ? project.name : project.key,
      },
    ];
  });
  const isLast = body.isLast !== false;
  const startAt = typeof body.startAt === 'number' ? body.startAt : 0;
  const maxResults = typeof body.maxResults === 'number' ? body.maxResults : projects.length;
  return { projects, isLast, nextStart: isLast ? undefined : startAt + maxResults };
}

export function readCursor(nextLink: string | undefined): string | undefined {
  if (!nextLink) return undefined;
  try {
    const cursor = new URL(nextLink, 'https://example.atlassian.net').searchParams.get('cursor');
    return cursor || undefined;
  } catch {
    return undefined;
  }
}

export function parseSpaces(payload: unknown): { spaces: ConfluenceSpace[]; nextCursor?: string } {
  const body = asRecord(payload) ?? {};
  const results = Array.isArray(body.results) ? body.results : [];
  const spaces = results.flatMap((raw) => {
    const space = asRecord(raw);
    if (!space || space.id == null) return [];
    const key = typeof space.key === 'string' ? space.key : '';
    const name = typeof space.name === 'string' && space.name ? space.name : key || String(space.id);
    return [{ id: String(space.id), key, name }];
  });
  const links = asRecord(body._links);
  const next = typeof links?.next === 'string' ? links.next : undefined;
  return { spaces, nextCursor: readCursor(next) };
}

export function confluencePageUrl(payload: unknown): string | undefined {
  const body = asRecord(payload);
  const links = asRecord(body?._links);
  const base = typeof links?.base === 'string' ? links.base : undefined;
  const webui = typeof links?.webui === 'string' ? links.webui : undefined;
  if (!base || !webui) return undefined;
  if (!/^https?:\/\//i.test(base)) return undefined;
  if (/^https?:\/\//i.test(webui)) return webui;
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = webui.startsWith('/') ? webui : `/${webui}`;
  return `${normalizedBase}${normalizedPath}`;
}
