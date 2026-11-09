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

export async function listSpaces(): Promise<ConfluenceSpace[]> {
  const spaces: ConfluenceSpace[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES && spaces.length < 100; page += 1) {
    const response = cursor
      ? await api.asUser().requestConfluence(route`/wiki/api/v2/spaces?limit=50&status=current&cursor=${cursor}`)
      : await api.asUser().requestConfluence(route`/wiki/api/v2/spaces?limit=50&status=current`);
    await assertOk(response, 'Could not list Confluence spaces');
    const parsed = parseSpaces(await response.json());
    spaces.push(...parsed.spaces);
    if (!parsed.nextCursor) break;
    cursor = parsed.nextCursor;
  }
  return spaces.slice(0, 100);
}

export async function createPage(payload: ConfluencePagePayload): Promise<{ id?: string; url?: string; title: string }> {
  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages`, {
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
