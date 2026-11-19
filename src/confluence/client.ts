import api, { route } from '@forge/api';
import { formatApiError, isDuplicateConfluenceTitle } from '../core/errors';
import { MAX_LIST_PAGES } from '../core/paging';
import {
  pageFromResponse,
  parseConfluencePages,
  parseSpaces,
  type ConfluenceSpace,
} from '../core/parse';
import type { ConfluencePagePayload } from '../core/publish';

export interface PublishedPage {
  id?: string;
  url?: string;
  title: string;
  version?: number;
  updated: boolean;
}

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function assertOk(response: { ok: boolean; status: number; text: () => Promise<string> }, fallback: string): Promise<void> {
  if (response.ok) return;
  throw new Error(formatApiError(response.status, await response.text(), fallback));
}

/**
 * Confluence calls from the Jira project page use asApp(), not asUser().
 *
 * asUser().requestConfluence() from a Jira module has no user Confluence token until
 * the person grants 3LO consent. Forge only shows that prompt if the thrown
 * "Authentication Required" error is left uncaught. The resolver (and the
 * frontend invoke wrapper) catch errors, so the Space dropdown used to show
 * that message and "No options" with no consent screen.
 *
 * asApp() uses the app user after install, so listing spaces and creating
 * pages does not need a second product-auth prompt. This stays on Atlassian
 * (no egress) and remains eligible for Runs on Atlassian. Jira issue reads
 * stay asUser() so the draft only includes work the person can already browse.
 */
function confluence() {
  return api.asApp();
}

export async function listSpaces(): Promise<ConfluenceSpace[]> {
  const spaces: ConfluenceSpace[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES && spaces.length < 100; page += 1) {
    const response = cursor
      ? await confluence().requestConfluence(route`/wiki/api/v2/spaces?limit=50&status=current&cursor=${cursor}`)
      : await confluence().requestConfluence(route`/wiki/api/v2/spaces?limit=50&status=current`);
    await assertOk(response, 'Could not list Confluence spaces');
    const parsed = parseSpaces(await response.json());
    spaces.push(...parsed.spaces);
    if (!parsed.nextCursor) break;
    cursor = parsed.nextCursor;
  }
  return spaces.slice(0, 100);
}

async function findPageByTitle(spaceId: string, title: string) {
  const response = await confluence().requestConfluence(
    route`/wiki/api/v2/pages?space-id=${spaceId}&title=${title}&limit=25&status=current`,
  );
  await assertOk(response, 'Could not look up the Confluence page');
  const pages = parseConfluencePages(await response.json());
  return pages.find((page) => page.title === title) ?? pages[0];
}

async function updatePage(
  id: string,
  currentVersion: number,
  payload: ConfluencePagePayload,
): Promise<PublishedPage> {
  const nextVersion = currentVersion + 1;
  const response = await confluence().requestConfluence(route`/wiki/api/v2/pages/${id}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      id,
      status: 'current',
      title: payload.title,
      body: payload.body,
      version: { number: nextVersion, message: 'Updated by Release Scribe' },
    }),
  });
  await assertOk(response, 'Could not update the Confluence page');
  return pageFromResponse(await response.json(), payload.title, true);
}

export async function createPage(payload: ConfluencePagePayload): Promise<PublishedPage> {
  const existing = await findPageByTitle(payload.spaceId, payload.title);
  if (existing) {
    return updatePage(existing.id, existing.version, payload);
  }

  const response = await confluence().requestConfluence(route`/wiki/api/v2/pages`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (!response.ok && isDuplicateConfluenceTitle(response.status, body)) {
    const conflict = await findPageByTitle(payload.spaceId, payload.title);
    if (conflict) return updatePage(conflict.id, conflict.version, payload);
  }
  if (!response.ok) {
    throw new Error(formatApiError(response.status, body, 'Could not create the Confluence page'));
  }
  return pageFromResponse(JSON.parse(body) as unknown, payload.title, false);
}
