import api, { route } from '@forge/api';
import { formatApiError } from '../core/errors';
import { MAX_LIST_PAGES } from '../core/paging';
import { confluencePageUrl, parseSpaces, type ConfluenceSpace } from '../core/parse';
import type { ConfluencePagePayload } from '../core/publish';

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

export async function createPage(payload: ConfluencePagePayload): Promise<{ id?: string; url?: string; title: string }> {
  const response = await confluence().requestConfluence(route`/wiki/api/v2/pages`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  await assertOk(response, 'Could not create the Confluence page');
  const created = (await response.json()) as { id?: unknown };
  return {
    id: typeof created.id === 'string' ? created.id : created.id != null ? String(created.id) : undefined,
    url: confluencePageUrl(created),
    title: payload.title,
  };
}
