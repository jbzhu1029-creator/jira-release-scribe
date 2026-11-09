import { hasDisallowedControls } from './text';

const PROJECT_KEY = /^[A-Z][A-Z0-9]{1,9}$/;

export function assertProjectKey(projectKey: string): string {
  const key = projectKey.trim().toUpperCase();
  if (!PROJECT_KEY.test(key)) {
    throw new Error('Project key must be 2–10 letters or digits and start with a letter.');
  }
  return key;
}

export function assertVersionName(versionName: string): string {
  const name = versionName.trim();
  if (!name || name.length > 255) {
    throw new Error('Version name must be 1–255 characters.');
  }
  if (hasDisallowedControls(name)) {
    throw new Error('Version name contains unsupported control characters.');
  }
  return name;
}

export function escapeJqlString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export function jqlForFixVersion(projectKey: string, versionName: string): string {
  const key = assertProjectKey(projectKey);
  const version = assertVersionName(versionName);
  return `project = ${key} AND fixVersion = "${escapeJqlString(version)}" ORDER BY issuetype ASC, key ASC`;
}

/** Issues whose fix version is ordered after the named version (Jira's `fixVersion >` operator). */
export function jqlSinceVersion(projectKey: string, versionName: string): string {
  const key = assertProjectKey(projectKey);
  const version = assertVersionName(versionName);
  return `project = ${key} AND fixVersion > "${escapeJqlString(version)}" ORDER BY fixVersion ASC, key ASC`;
}

export function assertCustomJql(jql: string): string {
  const trimmed = jql.trim();
  if (!trimmed) throw new Error('Enter a JQL query.');
  if (trimmed.length > 2000) throw new Error('JQL query must be 2000 characters or fewer.');
  if (hasDisallowedControls(trimmed, true)) {
    throw new Error('JQL query contains unsupported control characters.');
  }
  return trimmed;
}
