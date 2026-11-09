import api, { route } from '@forge/api';
import { formatApiError } from '../core/errors';
import { MAX_ISSUES, MAX_LIST_PAGES, MAX_SEARCH_PAGES, SEARCH_PAGE_SIZE, collectUntil } from '../core/paging';
import { parseProjects, parseSearchPage, parseVersions, sortVersions, type JiraProject, type JiraVersion } from '../core/parse';
import type { ReleaseIssue } from '../core/types';

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function assertOk(response: { ok: boolean; status: number; text: () => Promise<string> }, fallback: string): Promise<void> {
  if (response.ok) return;
  throw new Error(formatApiError(response.status, await response.text(), fallback));
}

export async function searchIssues(jql: string): Promise<{ issues: ReleaseIssue[]; truncated: boolean }> {
  const collected = await collectUntil(
    async (cursor) => {
      const body: Record<string, unknown> = {
        jql,
        maxResults: SEARCH_PAGE_SIZE,
        fields: ['summary', 'issuetype', 'status', 'priority'],
      };
      if (cursor) body.nextPageToken = cursor;
      const response = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      });
      await assertOk(response, 'Jira search failed');
      const page = parseSearchPage(await response.json());
      return {
        items: page.issues,
        nextCursor: page.isLast ? undefined : page.nextPageToken,
      };
    },
    MAX_ISSUES,
    MAX_SEARCH_PAGES,
  );
  return { issues: collected.items, truncated: collected.truncated };
}

export async function listProjects(): Promise<JiraProject[]> {
  const projects: JiraProject[] = [];
  let startAt = 0;
  for (let page = 0; page < MAX_LIST_PAGES && projects.length < 100; page += 1) {
    const response = await api.asUser().requestJira(
      route`/rest/api/3/project/search?maxResults=50&startAt=${startAt}&orderBy=key`,
    );
    await assertOk(response, 'Could not list Jira projects');
    const parsed = parseProjects(await response.json());
    projects.push(...parsed.projects);
    if (parsed.isLast || parsed.nextStart == null) break;
    startAt = parsed.nextStart;
  }
  return projects.slice(0, 100);
}

export async function listVersions(projectKey: string): Promise<JiraVersion[]> {
  const response = await api.asUser().requestJira(route`/rest/api/3/project/${projectKey}/versions`);
  await assertOk(response, 'Could not list fix versions');
  return sortVersions(parseVersions(await response.json()));
}
