// Unit tests for the cross-worker save lock (§48). Every case uses its own
// temporary lock path, never SAVE_LOCK, so `npm test` cannot block or take
// over a running e2e suite (all worktrees share port 5232).
import { existsSync, mkdtempSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import config from '../playwright.config';
import { ACQUIRE_TIMEOUT_MS, STALE_MS, createDirLock } from './savesDir';

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

  it('T1: a throwing cleanup still releases, and the error propagates', async () => {
    const a = mk();
    await a.acquire();
    await expect(a.withHeld(() => { throw new Error('EPERM'); })).rejects.toThrow('EPERM');
    expect(existsSync(path)).toBe(false);
    await mk().acquire(200);
  });

  it('T2: a worker that never got the lock runs no cleanup and leaves the holder lock', async () => {
    await mk().acquire();
    const b = mk();
    await expect(b.acquire(100)).rejects.toThrow('Could not take');
    const spy = vi.fn();
    await b.withHeld(spy);
    expect(spy).not.toHaveBeenCalled();
    expect(existsSync(path)).toBe(true);
  });

  it('T6: a holder that lost its lock to a takeover does not remove the new holder lock', async () => {
    const a = mk();
    await a.acquire();
    backdate(STALE + 1_000);
    const b = mk();
    await b.acquire(500);
    a.release();
    expect(existsSync(path)).toBe(true);
    b.release();
    expect(existsSync(path)).toBe(false);
  });

  it('T7: the timing rule between STALE_MS, the acquire timeout and the test timeout', () => {
    const TEST_TIMEOUT_MS = config.timeout!;
    expect(STALE_MS).toBeGreaterThan(TEST_TIMEOUT_MS);
    expect(STALE_MS - ACQUIRE_TIMEOUT_MS).toBeLessThanOrEqual(ACQUIRE_TIMEOUT_MS);
  });

  it('T8: a holder that released and later fails to acquire touches nothing of the new holder', async () => {
    const a = mk();
    await a.acquire();
    const spy = vi.fn();
    await a.withHeld(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    const b = mk();
    await b.acquire();
    await expect(a.acquire(100)).rejects.toThrow('Could not take');
    spy.mockClear();
    await a.withHeld(spy);
    expect(spy).not.toHaveBeenCalled();
    expect(existsSync(path)).toBe(true);
  });

  it('T9: acquire with no argument gives up after ACQUIRE_TIMEOUT_MS', async () => {
    await mk().acquire();
    vi.useFakeTimers();
    try {
      const outcome = createDirLock(path, { staleMs: 1e9, pollMs: 10 }).acquire().then(() => 'acquired', (e: Error) => e.message);
      await vi.advanceTimersByTimeAsync(ACQUIRE_TIMEOUT_MS + 1_000);
      await expect(outcome).resolves.toContain('Could not take');
    } finally {
      vi.useRealTimers();
    }
  });

  it('T10: release with the owner file missing leaves the folder', async () => {
    const a = mk();
    await a.acquire();
    rmSync(join(path, 'owner'));
    a.release();
    expect(existsSync(path)).toBe(true);
  });
});
