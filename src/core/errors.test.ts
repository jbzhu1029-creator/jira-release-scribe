import { describe, expect, it } from 'vitest';
import { errorMessage, formatApiError } from './errors';

describe('API errors', () => {
  it('reads Jira error messages and field errors', () => {
    const message = formatApiError(
      400,
      JSON.stringify({ errorMessages: ['Version does not exist'], errors: { jql: 'Expecting operator' } }),
      'Jira search failed',
    );
    expect(message).toContain('Jira search failed (400)');
    expect(message).toContain('Version does not exist');
    expect(message).toContain('Expecting operator');
  });

  it('does not echo an HTML body', () => {
    expect(formatApiError(502, '<html>gateway</html>', 'Jira search failed')).toBe('Jira search failed (502).');
    expect(formatApiError(403, '<html>denied</html>', 'Jira search failed')).not.toContain('<html>');
  });

  it('reads a Confluence v2 errors array', () => {
    const message = formatApiError(
      400,
      JSON.stringify({
        errors: [{ status: 400, code: 'BAD_REQUEST', title: 'A page with this title already exists: Release notes' }],
      }),
      'Could not create the Confluence page',
    );
    expect(message).toContain('Edit the page title and publish again.');
    expect(message).toContain('already exists: Release notes');
  });

  it('explains permission, missing objects, access prompts, and rate limits', () => {
    expect(formatApiError(403, '', 'Jira search failed')).toContain('do not have permission to browse those issues');
    expect(formatApiError(403, '', 'Could not list fix versions')).toContain('fix versions');
    expect(formatApiError(403, '', 'Could not create the Confluence page')).toContain('copy the notes');
    expect(formatApiError(404, '', 'Could not list fix versions')).toContain('cannot see its fix versions');
    expect(formatApiError(401, '', 'Jira search failed')).toContain('approve the app access prompt');
    expect(formatApiError(429, '{"message":"slow down"}', 'Jira search failed')).toContain('rate-limited');
  });

  it('uses the error message and a fallback for unknown throws', () => {
    expect(errorMessage(new Error('Choose a fix version.'))).toBe('Choose a fix version.');
    expect(errorMessage('nope')).toBe('Something went wrong while building release notes.');
  });
});
