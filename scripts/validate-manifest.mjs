import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '@forge/manifest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const result = await validate(false, resolve(root, 'manifest.yml'));
const problems = result.errors ?? [];

for (const problem of problems) {
  const location = problem.line ? `:${problem.line}` : '';
  const line = `${problem.level.toUpperCase()} ${problem.reference}${location}: ${problem.message}`;
  if (problem.level === 'warning') console.warn(line);
  else console.error(line);
}

const errors = problems.filter((problem) => problem.level === 'error');
if (!result.success || errors.length > 0) {
  process.exit(1);
}

console.log(`manifest.yml matches @forge/manifest (${problems.length} warning(s)).`);
