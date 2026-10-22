// The folder the e2e run's save API writes into (intents/45-save-api, spec
// B10): a temporary folder, never the real `saves/`. Playwright starts the
// web server before global setup runs, so the path is fixed here (one per
// port, so two checkouts never share one); global setup empties it, global
// teardown removes it, and the scenarios read it by this same name.
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const SAVES_DIR = join(tmpdir(), 'heraklios-e2e-saves-5232');

/**
 * A cross-worker lock for the scenarios that use the save slots. All workers
 * share one server and one SAVES_DIR, and Playwright runs copies of a scenario
 * (--repeat-each) on different workers at once; each copy deletes and creates
 * slot files, so two at a time would delete each other's. The lock is an
 * exclusive mkdir (atomic on every OS), taken in beforeEach and released in
 * afterEach. A lock older than STALE_MS belongs to a crashed run and is
 * taken over; global setup and teardown remove it too.
 */
export const SAVE_LOCK = `${SAVES_DIR}.lock`;
const STALE_MS = 60_000;

export interface DirLock {
  acquire(timeoutMs?: number): Promise<void>;
  release(): void;
  /** The afterEach entry point: the old behaviour (cleanup, then release), unguarded. */
  withHeld(cleanup: () => void | Promise<void>): Promise<void>;
}

/** A lock on a folder path; `held` is per instance (a failed acquire must not release someone else's). */
export function createDirLock(path: string, { staleMs, pollMs = 50 }: { staleMs: number; pollMs?: number }): DirLock {
  let held = false;

  async function acquire(timeoutMs = 25_000): Promise<void> {
    const start = Date.now();
    for (;;) {
      try {
        mkdirSync(path);
        held = true;
        return;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      }
      try {
        if (Date.now() - statSync(path).mtimeMs > staleMs) rmSync(path, { recursive: true, force: true });
      } catch {
        // released between the two calls: try again
      }
      if (Date.now() - start > timeoutMs) throw new Error('Could not take the save-scenario lock (another worker holds it)');
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  function release(): void {
    if (!held) return;
    held = false;
    rmSync(path, { recursive: true, force: true });
  }

  async function withHeld(cleanup: () => void | Promise<void>): Promise<void> {
    await cleanup();
    release();
  }

  return { acquire, release, withHeld };
}

const saveLock = createDirLock(SAVE_LOCK, { staleMs: STALE_MS });
export const acquireSaveLock = saveLock.acquire;
export const releaseSaveLock = saveLock.release;
