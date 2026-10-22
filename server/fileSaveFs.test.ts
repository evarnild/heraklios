import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RENAME_ATTEMPTS, fileNameOf, fileSaveFs, renameOver, savesDir, slotOfFileName, type RenameOps } from './fileSaveFs';

// Every rename the real fs layer makes goes through this spy, which records how
// many are in flight at once on the same target (they must never overlap: that is
// what fails with EPERM on Windows) and in what order they finished.
const renames = vi.hoisted(() => ({ inFlight: new Map<string, number>(), maxInFlight: 0, total: 0, delayMs: 5, temps: [] as string[] }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    writeFile: (path: string, ...rest: unknown[]) => {
      renames.temps.push(String(path));
      return (real.writeFile as (...a: unknown[]) => Promise<void>)(path, ...rest);
    },
    rename: async (from: string, to: string) => {
      renames.total++;
      const n = (renames.inFlight.get(to) ?? 0) + 1;
      renames.inFlight.set(to, n);
      renames.maxInFlight = Math.max(renames.maxInFlight, n);
      try {
        await new Promise((r) => setTimeout(r, renames.delayMs)); // widen the window so an overlap is certain to show
        return await real.rename(from, to);
      } finally {
        renames.inFlight.set(to, (renames.inFlight.get(to) ?? 1) - 1);
      }
    },
  };
});


let dir: string;
beforeEach(() => {
  renames.inFlight.clear();
  renames.maxInFlight = 0;
  renames.total = 0;
  renames.delayMs = 5;
  renames.temps = [];
  dir = mkdtempSync(join(tmpdir(), 'h45-fs-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('fileSaveFs', () => {
  it('writes one file per slot and reads it back', async () => {
    const fs = fileSaveFs(dir);
    await fs.write('2', 'two');
    await fs.write('autosave', 'auto');
    expect(readFileSync(join(dir, 'slot-2.json'), 'utf8')).toBe('two');
    expect(await fs.read('autosave')).toBe('auto');
    expect((await fs.list()).sort()).toEqual(['2', 'autosave']);
  });

  it('replaces the old content and leaves no temp file', async () => {
    const fs = fileSaveFs(dir);
    await fs.write('1', 'old');
    await fs.write('1', 'new');
    expect(await fs.read('1')).toBe('new');
    expect(readdirSync(dir)).toEqual(['slot-1.json']);
  });

  it('creates the folder on the first write; a missing folder lists empty', async () => {
    const fs = fileSaveFs(join(dir, 'nested', 'saves'));
    expect(await fs.list()).toEqual([]);
    expect(await fs.read('1')).toBeNull();
    await fs.write('1', 'x');
    expect(await fs.read('1')).toBe('x');
  });

  it('removes a file, and an empty slot is not an error', async () => {
    const fs = fileSaveFs(dir);
    await fs.write('3', 'x');
    await fs.remove('3');
    await fs.remove('3');
    expect(await fs.read('3')).toBeNull();
  });

  it('lists only slot files, ignoring anything else in the folder', async () => {
    writeFileSync(join(dir, 'notes.txt'), 'x');
    writeFileSync(join(dir, 'slot-9.json'), 'x');
    writeFileSync(join(dir, 'slot-1.json.123.tmp'), 'x');
    writeFileSync(join(dir, 'slot-4.json'), 'x');
    expect(await fileSaveFs(dir).list()).toEqual(['4']);
  });
});

describe('fileSaveFs under stress', () => {
  it('survives many concurrent writes to one slot: all succeed, one body wins, no temp file is left', async () => {
    const fs = fileSaveFs(dir);
    const bodies = Array.from({ length: 40 }, (_, i) => `body-${i}-${'x'.repeat(5000)}`);
    const results = await Promise.allSettled(bodies.map((b) => fs.write('autosave', b)));
    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
    expect(bodies).toContain(await fs.read('autosave'));
    expect(readdirSync(dir)).toEqual(['autosave.json']);
  });

  it('a failed write leaves no temp file and rejects', async () => {
    const fs = fileSaveFs(dir);
    mkdirSync(join(dir, 'slot-1.json')); // the rename onto a folder fails
    await expect(fs.write('1', 'x')).rejects.toThrow();
    expect(readdirSync(dir)).toEqual(['slot-1.json']);
  });
});

describe('the per-slot write queue', () => {
  it('never renames two writes over one target at once, and the last issued write wins', async () => {
    const fs = fileSaveFs(dir);
    const bodies = Array.from({ length: 12 }, (_, i) => `body-${i}`);
    const results = await Promise.allSettled(bodies.map((b) => fs.write('2', b)));
    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
    expect(renames.total).toBe(12); // no retries were needed
    expect(renames.maxInFlight).toBe(1);
    expect(await fs.read('2')).toBe('body-11');
  });

  it('two stores on one folder (dev and preview processes) do not share a temp file', async () => {
    renames.delayMs = 60; // both temp files are written before either rename happens
    const a = fileSaveFs(dir);
    const b = fileSaveFs(dir); // separate queues: only the unique temp names keep them apart
    const results = await Promise.allSettled([a.write('5', 'from-a'), b.write('5', 'from-b')]);
    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
    expect(['from-a', 'from-b']).toContain(await a.read('5'));
    expect(readdirSync(dir)).toEqual(['slot-5.json']);
    // Concurrent renames of one shared temp file can both "succeed" on Windows, so check the names themselves.
    expect(renames.temps).toHaveLength(2);
    expect(new Set(renames.temps).size).toBe(2);
  });

  it('different slots may write at the same time', async () => {
    const fs = fileSaveFs(dir);
    await Promise.all([fs.write('1', 'a'), fs.write('2', 'b'), fs.write('3', 'c')]);
    expect(await fs.list()).toHaveLength(3);
  });

  it('a rejected write does not block the next write to the same slot', async () => {
    const fs = fileSaveFs(dir);
    mkdirSync(join(dir, 'slot-4.json')); // the rename onto a folder fails
    const bad = fs.write('4', 'x');
    const next = fs.write('4', 'y'); // queued behind the failing one
    await expect(bad).rejects.toThrow();
    rmSync(join(dir, 'slot-4.json'), { recursive: true });
    await expect(next).resolves.toBeUndefined();
    expect(await fs.read('4')).toBe('y');
  });
});

describe('renameOver (the retry)', () => {
  const eperm = () => Object.assign(new Error('EPERM'), { code: 'EPERM' });
  function ops(failures: Error[]): RenameOps & { sleeps: number[]; calls: number } {
    const state = { sleeps: [] as number[], calls: 0 };
    return {
      get sleeps() { return state.sleeps; },
      get calls() { return state.calls; },
      rename: async () => {
        state.calls++;
        const failure = failures.shift();
        if (failure) throw failure;
      },
      sleep: async (ms) => void state.sleeps.push(ms),
      jitter: () => 0.5,
    };
  }

  it('succeeds after transient errors, pausing longer each time', async () => {
    const o = ops([eperm(), eperm(), eperm()]);
    await renameOver('a', 'b', o);
    expect(o.calls).toBe(4);
    expect(o.sleeps).toEqual([37, 62, 87]);
  });

  it.each(['EPERM', 'EBUSY', 'EACCES'])('retries %s', async (code) => {
    const o = ops([Object.assign(new Error(code), { code })]);
    await renameOver('a', 'b', o);
    expect(o.calls).toBe(2);
  });

  it('gives up after the limit with the error, within a bounded total pause', async () => {
    const always = Array.from({ length: 50 }, () => eperm());
    const o = ops(always);
    await expect(renameOver('a', 'b', o)).rejects.toThrow('EPERM');
    expect(o.calls).toBe(RENAME_ATTEMPTS);
    expect(o.sleeps).toHaveLength(RENAME_ATTEMPTS - 1);
    expect(o.sleeps.reduce((a, b) => a + b, 0)).toBeLessThan(1000);
    const worst = ops(Array.from({ length: 50 }, () => eperm()));
    worst.jitter = () => 0.999;
    await expect(renameOver('a', 'b', worst)).rejects.toThrow();
    expect(worst.sleeps.reduce((a, b) => a + b, 0)).toBeLessThan(1000);
  });

  it.each(['ENOENT', 'EISDIR', 'ENOSPC', undefined])('does not retry %s', async (code) => {
    const o = ops([Object.assign(new Error('boom'), { code })]);
    await expect(renameOver('a', 'b', o)).rejects.toThrow('boom');
    expect(o.calls).toBe(1);
    expect(o.sleeps).toEqual([]);
  });
});

describe('names and folder', () => {
  it('maps slots to files and back', () => {
    expect(fileNameOf('5')).toBe('slot-5.json');
    expect(fileNameOf('autosave')).toBe('autosave.json');
    expect(slotOfFileName('slot-5.json')).toBe('5');
    expect(slotOfFileName('slot-7.json')).toBeNull();
  });

  it('uses HERAKLIOS_SAVES_DIR, else saves/ under the root', () => {
    expect(savesDir('/r', { HERAKLIOS_SAVES_DIR: '/tmp/x' })).toBe('/tmp/x');
    expect(savesDir('/r', {})).toBe(join('/r', 'saves'));
  });
});
