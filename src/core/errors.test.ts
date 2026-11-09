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
  });

  it('uses the error message and a fallback for unknown throws', () => {
    expect(errorMessage(new Error('Choose a fix version.'))).toBe('Choose a fix version.');
    expect(errorMessage('nope')).toBe('Something went wrong while building release notes.');
  });
});
