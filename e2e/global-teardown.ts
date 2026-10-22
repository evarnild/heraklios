// Runs once after every `npm run e2e`: the temporary saves folder (e2e/savesDir.ts) goes away.
import { rmSync } from 'node:fs';
import { SAVES_DIR, SAVE_LOCK } from './savesDir';

export default function globalTeardown(): void {
  rmSync(SAVES_DIR, { recursive: true, force: true });
  rmSync(SAVE_LOCK, { recursive: true, force: true });
}
