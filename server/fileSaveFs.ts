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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Renames over the target. On Windows a rename onto a file that is open or
 * being replaced (another handle, antivirus) fails with EPERM/EBUSY/EACCES
 * for a moment, so those are retried a few times before giving up.
 */
async function renameOver(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await rename(from, to);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw e;
      await sleep(25 * attempt);
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
      const run = (queues.get(slot) ?? Promise.resolve()).catch(() => undefined).then(() => writeOnce(slot, text));
      queues.set(slot, run);
      return run;
    },
    async remove(slot) {
      await rm(pathOf(slot), { force: true });
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
