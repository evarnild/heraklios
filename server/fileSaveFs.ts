// The real file system behind the save API (intents/45-save-api, spec B2).
// One file per slot: slot-1.json ... slot-6.json, autosave.json. The slot
// names come from the allow-list in saveApi.ts, so no path is ever built
// from anything a request sent.
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SLOTS, type SaveFs, type Slot } from './saveApi';

export function fileNameOf(slot: Slot): string {
  return slot === 'autosave' ? 'autosave.json' : `slot-${slot}.json`;
}

/** The slot a file name belongs to, or null for any other file in the folder. */
export function slotOfFileName(name: string): Slot | null {
  return SLOTS.find((slot) => fileNameOf(slot) === name) ?? null;
}

/**
 * The saves folder: `HERAKLIOS_SAVES_DIR` if set, else `saves/` under the
 * checkout root (gitignored). It is created on the first write.
 */
export function savesDir(root: string, env: Record<string, string | undefined> = process.env): string {
  const override = env.HERAKLIOS_SAVES_DIR;
  return override ? override : join(root, 'saves');
}

function isMissing(e: unknown): boolean {
  return (e as NodeJS.ErrnoException)?.code === 'ENOENT';
}

/** What `renameOver` needs from the outside; tests inject failures and a fake clock. */
export interface RenameOps {
  rename(from: string, to: string): Promise<void>;
  sleep(ms: number): Promise<void>;
  /** 0 <= jitter() < 1 */
  jitter(): number;
}

const realOps: RenameOps = {
  rename,
  sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  jitter: Math.random,
};

/** Error codes of a rename that may succeed a moment later (Windows: the target is open or being replaced). */
const TRANSIENT = new Set(['EPERM', 'EBUSY', 'EACCES']);
export const RENAME_ATTEMPTS = 8;

/**
 * Renames over the target. On Windows a rename onto a file that is open or
 * being replaced (another handle, antivirus, another server process on the
 * same folder) fails with EPERM/EBUSY/EACCES for a moment, so those are
 * retried with a growing, jittered pause: attempt n waits 25n ms plus up to
 * 25 ms, at most 7 pauses, under 0.9 s in all. That bound is the limit:
 * two server processes (dev and preview) hammering one slot for longer than
 * that can still lose a write with a 500, which the game reports as a failed
 * save.
 */
export async function renameOver(from: string, to: string, ops: RenameOps = realOps): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await ops.rename(from, to);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (attempt >= RENAME_ATTEMPTS || !code || !TRANSIENT.has(code)) throw e;
      await ops.sleep(25 * attempt + Math.floor(ops.jitter() * 25));
    }
  }
}

export function fileSaveFs(dir: string): SaveFs {
  /** The latest write per slot: writes to one slot run one after another, never renaming over each other. */
  const queues = new Map<Slot, Promise<unknown>>();
  const pathOf = (slot: Slot) => join(dir, fileNameOf(slot));
  return {
    async read(slot) {
      try {
        return await readFile(pathOf(slot), 'utf8');
      } catch (e) {
        if (isMissing(e)) return null;
        throw e;
      }
    },
    write(slot, text) {
      return enqueue(slot, () => writeOnce(slot, text));
    },
    // Through the same queue as writes: a DELETE issued after a PUT must run after it.
    remove(slot) {
      return enqueue(slot, () => rm(pathOf(slot), { force: true }));
    },
    async list() {
      try {
        return (await readdir(dir)).flatMap((name) => slotOfFileName(name) ?? []);
      } catch (e) {
        if (isMissing(e)) return [];
        throw e;
      }
    },
  };

  function enqueue(slot: Slot, job: () => Promise<void>): Promise<void> {
    const run = (queues.get(slot) ?? Promise.resolve()).catch(() => undefined).then(job);
    queues.set(slot, run);
    return run;
  }

  async function writeOnce(slot: Slot, text: string): Promise<void> {
    await mkdir(dir, { recursive: true });
    // Temp file in the same folder, then rename over the target: a crash
    // leaves either the old save or the new one, never half of one.
    // The temp name is unique per write: concurrent writes to one slot must not share it.
    const temp = join(dir, `${fileNameOf(slot)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temp, text, 'utf8');
      await renameOver(temp, pathOf(slot));
    } catch (e) {
      await rm(temp, { force: true });
      throw e;
    }
  }
}
