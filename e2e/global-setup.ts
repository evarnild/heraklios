// Runs once before every `npm run e2e` (spec AC5): a production build must
// not contain the dev-only test hook. Builds into a temp directory, never
// `dist/`, so it can't clobber a build someone is previewing.
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';

const HOOK = '__heraklios';

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

export default async function globalSetup(): Promise<void> {
  const outDir = mkdtempSync(join(tmpdir(), 'h32-build-'));
  try {
    await build({ logLevel: 'warn', build: { outDir, emptyOutDir: true } });
    const leaks = filesUnder(outDir).filter((f) => readFileSync(f, 'utf8').includes(HOOK));
    if (leaks.length) {
      throw new Error(`The production build contains the dev-only test hook "${HOOK}" in: ${leaks.join(', ')}`);
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
