// The real file system behind the save API (intents/45-save-api, spec B2).
// One file per slot: slot-1.json ... slot-6.json, autosave.json. The slot
// names come from the allow-list in saveApi.ts, so no path is ever built
// from anything a request sent.
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

export function fileSaveFs(dir: string): SaveFs {
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
    async write(slot, text) {
      await mkdir(dir, { recursive: true });
      // Temp file in the same folder, then rename over the target: a crash
      // leaves either the old save or the new one, never half of one.
      const temp = join(dir, `${fileNameOf(slot)}.${process.pid}.tmp`);
      try {
        await writeFile(temp, text, 'utf8');
        await rename(temp, pathOf(slot));
      } catch (e) {
        await rm(temp, { force: true });
        throw e;
      }
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
}
