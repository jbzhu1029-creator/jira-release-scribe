import { errorMessage } from '../core/errors';
import { assertProjectKey, assertVersionName, jqlForFixVersion, jqlSinceVersion } from '../core/jql';
import { parseAudience, toActionResult } from '../core/notes';
import { searchIssues } from '../jira/client';
import { createReleaseNotes } from '../services/createReleaseNotes';

const forgeSearch = { searchByJql: searchIssues };

interface ActionPayload {
  projectKey?: unknown;
  versionName?: unknown;
  audience?: unknown;
  context?: {
    jira?: {
      projectKey?: unknown;
    };
  };
}

function resolveProjectKey(payload: ActionPayload): string {
  const fromInput = typeof payload.projectKey === 'string' ? payload.projectKey : '';
  const contextKey = payload.context?.jira?.projectKey;
  const raw = fromInput.trim() || (typeof contextKey === 'string' ? contextKey : '');
  if (!raw.trim()) throw new Error('Tell me the Jira project key, for example PROJ.');
  return assertProjectKey(raw);
}

function resolveVersionName(payload: ActionPayload): string {
  if (typeof payload.versionName !== 'string') throw new Error('Tell me the fix version name, for example 1.4.0.');
  return assertVersionName(payload.versionName);
}

export async function draftReleaseNotes(payload: ActionPayload = {}) {
  try {
    const projectKey = resolveProjectKey(payload);
    const versionName = resolveVersionName(payload);
    const audience = parseAudience(payload.audience);
    console.log(`Release Scribe draftReleaseNotes project=${projectKey}`);
    const notes = await createReleaseNotes(forgeSearch, {
      jql: jqlForFixVersion(projectKey, versionName),
      title: `${projectKey} ${versionName}`,
      generatedAt: new Date().toISOString(),
      sourceDetail: `project ${projectKey}, fix version "${versionName}"`,
    });
    return toActionResult(notes, audience);
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function changesSinceVersion(payload: ActionPayload = {}) {
  try {
    const projectKey = resolveProjectKey(payload);
    const versionName = resolveVersionName(payload);
    const audience = parseAudience(payload.audience);
    console.log(`Release Scribe changesSinceVersion project=${projectKey}`);
    const notes = await createReleaseNotes(forgeSearch, {
      jql: jqlSinceVersion(projectKey, versionName),
      title: `${projectKey} since ${versionName}`,
      generatedAt: new Date().toISOString(),
      sourceDetail: `project ${projectKey}, issues with a fix version after "${versionName}"`,
    });
    return toActionResult(notes, audience);
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
