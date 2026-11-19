import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../manifest.yml'), 'utf8');

describe('manifest Codegeist modules', () => {
  it('keeps the Rovo agent and exposes the same actions as MCP tools', () => {
    expect(manifest).toContain('jira:projectPage:');
    expect(manifest).toContain('rovo:agent:');
    const start = manifest.indexOf('  rovo:mcp:');
    const end = manifest.indexOf('\n  action:', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const mcp = manifest.slice(start, end);
    expect(mcp).toContain('key: release-scribe-mcp');
    expect(mcp).toContain('name: Release Scribe');
    expect(mcp).toContain('- draft-release-notes');
    expect(mcp).toContain('- changes-since-version');
    expect(manifest).not.toMatch(/^ {2}external:/m);
  });

  it('declares the Confluence v2 scopes needed to list spaces and create pages', () => {
    expect(manifest).toContain('read:confluence-space.summary');
    expect(manifest).toContain('write:confluence-content');
    expect(manifest).toContain('read:space:confluence');
    expect(manifest).toContain('write:page:confluence');
  });
});
