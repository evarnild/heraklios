// Unit tests for the cross-worker save lock (§48). Every case uses its own
// temporary lock path, never SAVE_LOCK, so `npm test` cannot block or take
// over a running e2e suite (all worktrees share port 5232).
import { existsSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDirLock } from './savesDir';

const STALE = 5_000;
let dir: string;
let path: string;
const mk = () => createDirLock(path, { staleMs: STALE, pollMs: 10 });
const backdate = (ms: number) => {
  const t = new Date(Date.now() - ms);
  utimesSync(path, t, t);
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'h48-lock-'));
  path = join(dir, 'lock');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('createDirLock', () => {
  it('T3: a fresh lock held by another instance makes acquire time out', async () => {
    await mk().acquire();
    await expect(mk().acquire(200)).rejects.toThrow('Could not take the save-scenario lock');
  });

  it('T4: a lock older than staleMs is taken over', async () => {
    await mk().acquire();
    backdate(STALE + 1_000);
    await mk().acquire(500);
    expect(existsSync(path)).toBe(true);
  });

  it('T5: a lock younger than staleMs is not taken over', async () => {
    await mk().acquire();
    backdate(STALE - 3_000);
    await expect(mk().acquire(200)).rejects.toThrow('Could not take');
  });
});
