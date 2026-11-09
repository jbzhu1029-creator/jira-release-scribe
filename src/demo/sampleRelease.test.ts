import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createFixtureSearch } from './fixtureSearch';
import { buildSampleRelease, formatScene, parseSampleFixture, sceneClocks } from './sampleRelease';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = path.join(repoRoot, 'demo', 'fixtures', 'atlas-board.json');
const narrationPath = path.join(repoRoot, 'demo', 'narration.md');

const story = {
  key: 'ATLAS-1',
  fields: { summary: 'One', issuetype: { name: 'Story' }, status: { name: 'Done' } },
};

describe('createFixtureSearch', () => {
  it('joins pages and skips an issue with no key', async () => {
    const search = createFixtureSearch([
      {
        issues: [story, { fields: { summary: 'Missing key' } }],
        isLast: false,
        nextPageToken: 'page-2',
      },
      {
        issues: [{ key: 'ATLAS-2', fields: { summary: 'Two', issuetype: { name: 'Bug' } } }],
        isLast: true,
      },
    ]);
    const result = await search.searchByJql('project = ATLAS');
    expect(result.truncated).toBe(false);
    expect(result.issues.map((issue) => issue.key)).toEqual(['ATLAS-1', 'ATLAS-2']);
  });

  it('stops when the page says it is the last one', async () => {
    const search = createFixtureSearch([
      { issues: [story], isLast: true, nextPageToken: 'ignored' },
      { issues: [{ key: 'ATLAS-9', fields: { summary: 'Hidden', issuetype: { name: 'Task' } } }], isLast: true },
    ]);
    const result = await search.searchByJql('project = ATLAS');
    expect(result.issues.map((issue) => issue.key)).toEqual(['ATLAS-1']);
  });

  it('rejects a fixture that points at a missing page', async () => {
    const search = createFixtureSearch([{ issues: [story], isLast: false, nextPageToken: 'missing' }]);
    await expect(search.searchByJql('project = ATLAS')).rejects.toThrow(/next page/);
  });
});

describe('parseSampleFixture', () => {
  it('rejects a payload without a project', () => {
    expect(() => parseSampleFixture({})).toThrow(/project/);
  });

  it('rejects a release block with no pages', () => {
    expect(() =>
      parseSampleFixture({
        project: { key: 'ATLAS', name: 'Atlas Board' },
        versions: [],
        release: { versionName: '1.4.0', pages: [] },
      }),
    ).toThrow(/release/);
  });
});

describe('Atlas Board sample', () => {
  const fixture = parseSampleFixture(JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown);

  it('drafts the 1.4.0 notes from both search pages', async () => {
    const demo = await buildSampleRelease(fixture);
    expect(demo.releaseJql).toBe('project = ATLAS AND fixVersion = "1.4.0" ORDER BY issuetype ASC, key ASC');
    expect(demo.release.issueCount).toBe(10);
    expect(demo.release.truncated).toBe(false);
    expect(demo.release.counts).toEqual({ features: 3, improvements: 2, bugfixes: 2, other: 3 });
    expect(demo.release.groups.other.map((issue) => issue.key)).toEqual(['ATLAS-150', 'ATLAS-151', 'ATLAS-155']);
    expect(demo.release.audiences.engineering).toContain('**ATLAS-140**');
    expect(demo.release.audiences.engineering).toContain('[INTERNAL] feat: Share a board with a guest link');
    expect(demo.release.audiences.engineering).toContain('(Done, Highest)');
    expect(demo.release.audiences.engineering).toContain('\\*drag-and-drop\\*');
    expect(demo.release.audiences.customer).not.toContain('ATLAS-');
    expect(demo.release.audiences.customer).not.toContain('[INTERNAL]');
    expect(demo.release.audiences.customer).not.toContain('feat:');
    expect(demo.release.audiences.customer).toContain('Share a board with a guest link');
    const customer = demo.scenes.find((scene) => scene.id === 'customer');
    expect(customer?.body).toContain('ATLAS-140 engineering summary:');
    expect(customer?.body).toContain('[INTERNAL] feat: Share a board with a guest link');
    expect(customer?.body).toContain('ATLAS-140 customer line:\n  Share a board with a guest link');
    expect(demo.release.audiences.customer).toContain('Note the guest-link permission model');
    expect(demo.release.audiences.executive).toBe(
      'ATLAS 1.4.0 includes 3 features, 2 improvements, 2 bug fixes, and 3 other changes. Highlights include Share a board with a guest link, Add a timeline view for cross-team plans, and Pin a column to the left.',
    );
    expect(demo.release.storage).toContain('&lt;script&gt;');
    expect(demo.release.storage).not.toContain('<script>');
  });

  it('returns only the executive paragraph for changes since 1.3.0', async () => {
    const demo = await buildSampleRelease(fixture);
    expect(demo.sinceJql).toBe('project = ATLAS AND fixVersion > "1.3.0" ORDER BY fixVersion ASC, key ASC');
    expect(demo.since.counts).toEqual({ features: 1, improvements: 0, bugfixes: 2, other: 0 });
    const sinceScene = demo.scenes.find((scene) => scene.id === 'since-version');
    expect(sinceScene?.body).toContain(
      'ATLAS since 1.3.0 includes 1 feature and 2 bug fixes. Highlights include Share a board with a guest link, Calendar week starts on the wrong day, and Fix \\*drag-and-drop\\* crash when a card title contains <script>.',
    );
    expect(sinceScene?.body).not.toContain('## Internal engineering');
    expect(demo.files.map((file) => file.name)).toEqual(['ATLAS-1.4.0.md', 'ATLAS-since-1.3.0-executive.md']);
    expect(demo.files[0]?.contents).toBe(demo.release.markdown);
    expect(demo.files[1]?.contents).toBe(`${demo.since.audiences.executive}\n`);
  });

  it('sorts versions and builds a page payload that is not sent', async () => {
    const demo = await buildSampleRelease(fixture);
    const project = demo.scenes.find((scene) => scene.id === 'sample-project');
    expect(project?.body.indexOf('1.4.0')).toBeLessThan(project?.body.indexOf('0.9.0') ?? -1);
    expect(project?.body).toContain('unreleased');
    expect(project?.body).toContain('archived');
    const payload = demo.scenes.find((scene) => scene.id === 'confluence-payload');
    expect(payload?.body).toContain('POST /wiki/api/v2/pages');
    expect(payload?.body).toContain('<li><strong>ATLAS-128</strong>');
    expect(payload?.body).toContain('&lt;script&gt;');
    expect(payload?.body).not.toContain('<script>');
    expect(payload?.body).toContain('Release Scribe has not been installed on an Atlassian site.');
    expect(demo.pageTitle).toBe('Release notes: ATLAS 1.4.0 (2026-11-09)');
    const rendered = demo.scenes.map((scene, index) => formatScene(scene, index, demo.scenes.length)).join('\n');
    expect(rendered).not.toMatch(/monthly active|users love|deployed to production|install link:/i);
  });

  it('matches the narration clocks', async () => {
    const demo = await buildSampleRelease(fixture);
    const clocks = sceneClocks(demo.scenes);
    expect(clocks[0]).toBe('0:00-0:20');
    expect(clocks.at(-1)).toBe('2:30-2:51');
    expect(demo.scenes.reduce((total, scene) => total + scene.dwellMs, 0)).toBe(171_000);
    const narration = readFileSync(narrationPath, 'utf8');
    demo.scenes.forEach((scene, index) => {
      expect(narration).toContain(`Scene ${index + 1} of ${demo.scenes.length} - ${scene.title} (${clocks[index]})`);
    });
  });

  it('rejects a release version the fixture does not list', async () => {
    const missing = {
      ...fixture,
      release: { ...fixture.release, versionName: '9.9.9' },
    };
    await expect(buildSampleRelease(missing)).rejects.toThrow(/9\.9\.9/);
  });
});
