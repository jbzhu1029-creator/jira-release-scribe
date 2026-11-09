export function formatApiError(status: number, body: string, fallback: string): string {
  const detail = readErrorDetail(body);
  const message = detail ? `${fallback} (${status}): ${detail}` : `${fallback} (${status}).`;
  return message.slice(0, 500);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 500);
  return 'Something went wrong while building release notes.';
}

function readErrorDetail(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      errorMessages?: unknown;
      errors?: unknown;
      message?: unknown;
    };
    const messages: string[] = [];
    if (Array.isArray(parsed.errorMessages)) {
      for (const message of parsed.errorMessages) {
        if (typeof message === 'string' && message.trim()) messages.push(message.trim());
      }
    }
    if (parsed.errors && typeof parsed.errors === 'object') {
      for (const value of Object.values(parsed.errors as Record<string, unknown>)) {
        if (typeof value === 'string' && value.trim()) messages.push(value.trim());
      }
    }
    if (typeof parsed.message === 'string' && parsed.message.trim()) messages.push(parsed.message.trim());
    return messages.join(' ');
  } catch {
    return '';
  }
}
