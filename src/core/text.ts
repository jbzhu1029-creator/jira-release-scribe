export function hasDisallowedControls(value: string, allowWhitespace = false): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (allowWhitespace && (code === 9 || code === 10 || code === 13)) continue;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function stripControlChars(value: string): string {
  let result = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    result += code < 32 || code === 127 ? ' ' : char;
  }
  return result;
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  if (max <= 3) return value.slice(0, max);
  return `${value.slice(0, max - 3).trimEnd()}...`;
}

const LEADING_TAGS = /^(?:\[[^\]]{1,40}\]\s*)+/;
const CONVENTIONAL_PREFIX =
  /^(?:feat|fix|chore|docs|refactor|test|style|perf|improvement|improve|bug|feature|task)(?:\([^)]{1,40}\))?:\s+/i;

/** Strip internal tags and conventional-commit prefixes from a customer-facing line. */
export function tidyCustomerSummary(summary: string): string {
  const original = collapseWhitespace(summary);
  let text = original;
  let previous = '';
  while (text && text !== previous) {
    previous = text;
    text = text.replace(LEADING_TAGS, '').replace(CONVENTIONAL_PREFIX, '').trim();
  }
  return text || original;
}

const MARKDOWN_SPECIAL = /[\\`*_]/g;

export function escapeMarkdown(value: string): string {
  return value.replace(MARKDOWN_SPECIAL, (character) => `\\${character}`);
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function joinAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function formatUtcDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toISOString().slice(0, 10);
}
