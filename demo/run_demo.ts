import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSampleRelease, formatScene, parseSampleFixture, type DemoScene } from '../src/demo/sampleRelease';

const demoDir = path.dirname(fileURLToPath(import.meta.url));

function resolveDwell(scene: DemoScene): number {
  if (process.argv.includes('--fast')) return 0;
  const raw = process.env.DEMO_PAUSE_MS;
  if (raw === undefined || raw === '') return scene.dwellMs;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('DEMO_PAUSE_MS must be a non-negative number of milliseconds.');
  }
  return parsed;
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

  for (let index = 0; index < demo.scenes.length; index += 1) {
    const scene = demo.scenes[index];
    if (!scene) continue;
    if (shouldClear()) console.clear();
    console.log(formatScene(scene, index, demo.scenes.length));
    await wait(resolveDwell(scene));
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
