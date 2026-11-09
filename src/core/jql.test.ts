import { describe, expect, it } from 'vitest';
import { assertCustomJql, assertProjectKey, jqlForFixVersion, jqlSinceVersion } from './jql';

describe('JQL builders', () => {
  it('quotes version names and normalises the project key', () => {
    expect(jqlForFixVersion('proj', '1.2.0')).toBe(
      'project = PROJ AND fixVersion = "1.2.0" ORDER BY issuetype ASC, key ASC',
    );
  });

  it('escapes quotes and backslashes in version names', () => {
    expect(jqlForFixVersion('PROJ', '1.0 "beta" \\ rc')).toBe(
      'project = PROJ AND fixVersion = "1.0 \\"beta\\" \\\\ rc" ORDER BY issuetype ASC, key ASC',
    );
  });

  it('uses the greater-than operator for changes since a version', () => {
    expect(jqlSinceVersion('AB', '2026.01')).toBe(
      'project = AB AND fixVersion > "2026.01" ORDER BY fixVersion ASC, key ASC',
    );
  });

  it('rejects project keys that could change the query', () => {
    expect(() => assertProjectKey('PROJ AND watcher = currentUser()')).toThrow(/Project key/);
    expect(() => jqlForFixVersion('A', '1.0')).toThrow(/Project key/);
    expect(() => jqlForFixVersion('PROJECTKEY12', '1.0')).toThrow(/Project key/);
  });

  it('rejects empty, huge, and control-character JQL', () => {
    expect(() => assertCustomJql('   ')).toThrow(/Enter a JQL/);
    expect(() => assertCustomJql('a'.repeat(2001))).toThrow(/2000/);
    expect(() => assertCustomJql('project = PROJ\u0000')).toThrow(/control/);
    expect(assertCustomJql('  project = PROJ  ')).toBe('project = PROJ');
  });
});
