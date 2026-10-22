import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileNameOf, fileSaveFs, savesDir, slotOfFileName } from './fileSaveFs';

let dir: string;
beforeEach(() => {
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
