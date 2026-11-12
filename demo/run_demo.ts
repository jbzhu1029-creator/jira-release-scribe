import { appendFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSampleRelease, formatScene, parseSampleFixture, type DemoScene } from '../src/demo/sampleRelease';

const demoDir = path.dirname(fileURLToPath(import.meta.url));

function readPauseList(sceneCount: number): number[] | undefined {
  const raw = process.env.DEMO_PAUSE_LIST;
  if (raw === undefined || raw.trim() === '') return undefined;
  const parts = raw.split(',').map((part) => Number(part.trim()));
  if (parts.length !== sceneCount || parts.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error(`DEMO_PAUSE_LIST must be ${sceneCount} comma-separated non-negative millisecond values.`);
  }
  return parts;
}

function resolveDwell(scene: DemoScene, index: number, pauses: number[] | undefined): number {
  if (process.argv.includes('--fast')) return 0;
  const listed = pauses?.[index];
  if (listed !== undefined) return listed;
  const raw = process.env.DEMO_PAUSE_MS;
  if (raw === undefined || raw === '') return scene.dwellMs;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('DEMO_PAUSE_MS must be a non-negative number of milliseconds.');
  }
  return parsed;
}

function markScene(index: number): void {
  const file = process.env.DEMO_TIMING_FILE;
  if (!file) return;
  appendFileSync(file, `${index} ${Date.now()}\n`);
}

function shouldClear(): boolean {
  return !process.argv.includes('--fast') && !process.argv.includes('--no-clear');
}

function wait(ms: number): Promise<void> {
  if (ms === 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  const fixturePath = path.join(demoDir, 'fixtures', 'atlas-board.json');
  const fixture = parseSampleFixture(JSON.parse(await readFile(fixturePath, 'utf8')) as unknown);
  const demo = await buildSampleRelease(fixture);
  const outDir = path.join(demoDir, 'output');
  await mkdir(outDir, { recursive: true });
  for (const file of demo.files) {
    await writeFile(path.join(outDir, file.name), file.contents, 'utf8');
  }

  const pauses = readPauseList(demo.scenes.length);
  for (let index = 0; index < demo.scenes.length; index += 1) {
    const scene = demo.scenes[index];
    if (!scene) continue;
    if (shouldClear()) console.clear();
    markScene(index);
    console.log(formatScene(scene, index, demo.scenes.length));
    await wait(resolveDwell(scene, index, pauses));
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
