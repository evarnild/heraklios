// The folder the e2e run's save API writes into (intents/45-save-api, spec
// B10): a temporary folder, never the real `saves/`. Playwright starts the
// web server before global setup runs, so the path is fixed here (one per
// port, so two checkouts never share one); global setup empties it, global
// teardown removes it, and the scenarios read it by this same name.
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const SAVES_DIR = join(tmpdir(), 'heraklios-e2e-saves-5232');
