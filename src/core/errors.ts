export function formatApiError(status: number, body: string, fallback: string): string {
  const detail = readErrorDetail(body);
  const guidance = guidanceFor(status, detail, fallback);
  const message = guidance
    ? detail
      ? `${guidance} (${status}) ${detail}`
      : `${guidance} (${status}).`
    : detail
      ? `${fallback} (${status}): ${detail}`
      : `${fallback} (${status}).`;
  return message.slice(0, 500);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim().slice(0, 500);
  return 'Something went wrong while building release notes.';
}

function guidanceFor(status: number, detail: string, fallback: string): string | undefined {
  if ((status === 400 || status === 409) && /title/i.test(detail) && /already exists/i.test(detail)) {
    return 'A Confluence page with this title already exists. Edit the page title and publish again.';
  }
  if (status === 401) {
    return 'Reload Release Scribe and approve the app access prompt if Jira shows one.';
  }
  if (status === 429) {
    return 'Jira or Confluence rate-limited this request. Wait a moment and try again.';
  }
  if (status === 403) return permissionGuidance(fallback);
  if (status === 404) return notFoundGuidance(fallback);
  return undefined;
}

function permissionGuidance(fallback: string): string {
  if (/page/i.test(fallback)) {
    return 'You do not have permission to create a page in that space. You can still copy the notes.';
  }
  if (/version/i.test(fallback)) {
    return 'You do not have permission to view fix versions in that project.';
  }
  if (/project/i.test(fallback)) {
    return 'You do not have permission to list Jira projects.';
  }
  if (/space/i.test(fallback)) {
    return 'You do not have permission to list Confluence spaces. You can still copy the notes.';
  }
  return 'You do not have permission to browse those issues. The query runs as you, so it only returns work you can already open.';
}

function notFoundGuidance(fallback: string): string {
  if (/version/i.test(fallback)) {
    return 'That project was not found, or you cannot see its fix versions.';
  }
  if (/space/i.test(fallback)) {
    return 'Confluence spaces could not be loaded. You can still copy the notes.';
  }
  if (/page/i.test(fallback)) {
    return 'That Confluence space was not found, or you cannot add a page there.';
  }
  if (/project/i.test(fallback)) {
    return 'Jira projects could not be loaded.';
  }
  return 'Jira could not run that search. Check the project key and the version name.';
}

function pushText(messages: string[], value: unknown): void {
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (!trimmed || messages.includes(trimmed) || messages.length >= 6) return;
  messages.push(trimmed);
}

function collectErrorText(value: unknown, messages: string[]): void {
  if (messages.length >= 6) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string') pushText(messages, item);
      else collectErrorText(item, messages);
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  pushText(messages, record.message);
  pushText(messages, record.title);
  pushText(messages, record.detail);
  if (Array.isArray(record.errorMessages)) {
    for (const message of record.errorMessages) pushText(messages, message);
  }
  if (!record.errors || typeof record.errors !== 'object') return;
  if (Array.isArray(record.errors)) {
    for (const item of record.errors) collectErrorText(item, messages);
    return;
  }
  for (const item of Object.values(record.errors as Record<string, unknown>)) {
    if (typeof item === 'string') pushText(messages, item);
    else collectErrorText(item, messages);
  }
}

function readErrorDetail(body: string): string {
  try {
    const messages: string[] = [];
    collectErrorText(JSON.parse(body) as unknown, messages);
    return messages.join(' ');
  } catch {
    return '';
  }
}
