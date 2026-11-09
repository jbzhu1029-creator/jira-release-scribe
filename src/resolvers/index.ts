import Resolver from '@forge/resolver';
import { listSpaces, createPage } from '../confluence/client';
import { errorMessage } from '../core/errors';
import { assertCustomJql, assertProjectKey, assertVersionName, jqlForFixVersion } from '../core/jql';
import { generateReleaseNotes } from '../core/notes';
import { clip, collapseWhitespace } from '../core/text';
import { buildConfluencePage, buildPageTitle, sanitizeIssues } from '../core/publish';
import { listProjects, listVersions, searchIssues } from '../jira/client';
import { createReleaseNotes } from '../services/createReleaseNotes';

const resolver = new Resolver();
const forgeSearch = { searchByJql: searchIssues };

function ok<T>(data: T) {
  return { ok: true as const, data };
}

function fail(error: unknown) {
  return { ok: false as const, error: errorMessage(error) };
}

resolver.define('listProjects', async () => {
  try {
    return ok(await listProjects());
  } catch (error) {
    return fail(error);
  }
});

resolver.define('listVersions', async ({ payload }: { payload: { projectKey?: unknown } }) => {
  try {
    const projectKey = assertProjectKey(typeof payload?.projectKey === 'string' ? payload.projectKey : '');
    return ok(await listVersions(projectKey));
  } catch (error) {
    return fail(error);
  }
});

resolver.define('listSpaces', async () => {
  try {
    return ok(await listSpaces());
  } catch (error) {
    return fail(error);
  }
});

resolver.define(
  'generateNotes',
  async ({ payload }: { payload: { mode?: unknown; projectKey?: unknown; versionName?: unknown; jql?: unknown } }) => {
    try {
      const generatedAt = new Date().toISOString();
      if (payload?.mode === 'version') {
        const projectKey = assertProjectKey(typeof payload.projectKey === 'string' ? payload.projectKey : '');
        const versionName = assertVersionName(typeof payload.versionName === 'string' ? payload.versionName : '');
        const notes = await createReleaseNotes(forgeSearch, {
          jql: jqlForFixVersion(projectKey, versionName),
          title: `${projectKey} ${versionName}`,
          generatedAt,
          sourceDetail: `project ${projectKey}, fix version "${versionName}"`,
        });
        return ok(notes);
      }
      if (payload?.mode === 'jql') {
        const jql = assertCustomJql(typeof payload.jql === 'string' ? payload.jql : '');
        const notes = await createReleaseNotes(forgeSearch, {
          jql,
          title: 'Custom JQL',
          generatedAt,
          sourceDetail: clip(jql, 180),
        });
        return ok(notes);
      }
      return fail(new Error('Choose a fix version or a JQL query.'));
    } catch (error) {
      return fail(error);
    }
  },
);

resolver.define(
  'publishNotes',
  async ({
    payload,
  }: {
    payload: {
      spaceId?: unknown;
      title?: unknown;
      releaseTitle?: unknown;
      generatedAt?: unknown;
      truncated?: unknown;
      sourceDetail?: unknown;
      issues?: unknown;
    };
  }) => {
    try {
      const generatedAt =
        typeof payload?.generatedAt === 'string' && !Number.isNaN(Date.parse(payload.generatedAt))
          ? new Date(payload.generatedAt).toISOString()
          : new Date().toISOString();
      const releaseTitle =
        clip(collapseWhitespace(typeof payload?.releaseTitle === 'string' ? payload.releaseTitle : '') || 'Release', 120);
      const notes = generateReleaseNotes({
        title: releaseTitle,
        generatedAt,
        issues: sanitizeIssues(payload?.issues),
        truncated: payload?.truncated === true,
        sourceDetail: typeof payload?.sourceDetail === 'string' ? clip(payload.sourceDetail, 180) : undefined,
      });
      const title =
        typeof payload?.title === 'string' && payload.title.trim()
          ? payload.title
          : buildPageTitle(notes.title, notes.generatedAt);
      const page = buildConfluencePage({
        spaceId: typeof payload?.spaceId === 'string' ? payload.spaceId : '',
        title,
        storage: notes.storage,
      });
      return ok(await createPage(page));
    } catch (error) {
      return fail(error);
    }
  },
);

export const handler = resolver.getDefinitions();
