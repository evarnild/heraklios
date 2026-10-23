// What the dashboard shows (spec B3): the queue and the sessions view, read
// by running the existing scripts (`queue --json`, `sessions --json`) through
// the injected runner, plus each open intent's metadata, so the next step can
// be derived. Nothing is cached or written: git and metadata.yml stay the
// owners of the data (spec B12).
import { join } from 'node:path';
import { parseMetadata, parseReviewHeader } from '../../scripts/intent-check-lib.mjs';
import { branchFor } from '../../scripts/session-lib.mjs';
import { nextStep, waitingOnOwner } from './orchestrator-lib.mjs';

const TERMINAL = new Set(['done', 'abandoned', 'deferred']);

/** The scripts the server runs, always `node <script>` with an argument array. */
export function scriptCall(root, script, args = []) {
  return { file: process.execPath, args: [join(root, 'scripts', script), ...args], cwd: root };
}

async function runJson(runner, call, what) {
  const out = await runner.run(call.file, call.args, { cwd: call.cwd });
  if (out.code !== 0) throw new Error(`${what} failed: ${(out.stderr || out.stdout).trim()}`);
  try {
    return JSON.parse(out.stdout);
  } catch {
    throw new Error(`${what} did not print JSON`);
  }
}

/** `{ kind, base }`: where an intent's files are read and written. */
function sourceOf(intent, worktree, root) {
  if (worktree) return { kind: 'worktree', base: worktree.path };
  if (intent.source === 'main') return { kind: 'main', base: root };
  return { kind: 'branch', base: null }; // a branch without a worktree: read through git, never written
}

async function readOpenIntent({ runner, fs, root }, intent, source, branch) {
  const dir = `intents/${intent.id}-${intent.slug}`;
  const empty = { metadata: null, reviewHeader: null, files: {} };
  if (source.kind === 'branch') {
    const show = await runner.run('git', ['show', `${branch}:${dir}/metadata.yml`], { cwd: root });
    if (show.code !== 0) return empty;
    const tree = await runner.run('git', ['ls-tree', '--name-only', branch, `${dir}/`], { cwd: root });
    const names = tree.stdout.split(/\r?\n/).map((n) => n.slice(dir.length + 1));
    return { metadata: parseMetadata(show.stdout), reviewHeader: null, files: { spec: names.includes('spec.md'), plan: names.includes('plan.md') } };
  }
  const text = await fs.readFile(join(source.base, dir, 'metadata.yml'));
  if (text === null) return empty;
  const review = await fs.readFile(join(source.base, dir, 'review.md'));
  return {
    metadata: parseMetadata(text),
    reviewHeader: review === null ? null : parseReviewHeader(review),
    files: {
      spec: await fs.exists(join(source.base, dir, 'spec.md')),
      plan: await fs.exists(join(source.base, dir, 'plan.md')),
    },
  };
}

/**
 * The whole dashboard payload: `{ root, intents, worktrees }`. Each intent is
 * the queue's row plus `group`, `next` (`nextStep`), `worktree`, `location`
 * and `session`, with what waits on the owner first.
 */
export async function loadState(deps) {
  const { runner, root } = deps;
  const [queue, worktrees] = await Promise.all([
    runJson(runner, scriptCall(root, 'queue.mjs', ['--json']), 'npm run queue'),
    runJson(runner, scriptCall(root, 'sessions.mjs', ['--json']), 'npm run sessions'),
  ]);
  const byId = new Map(worktrees.filter((w) => w.id).map((w) => [String(w.id), w]));
  const rows = Object.entries(queue).flatMap(([group, list]) => list.map((i) => ({ ...i, group })));
  const intents = await Promise.all(
    rows.map(async (intent) => {
      const wt = byId.get(String(intent.id)) ?? null;
      const location = sourceOf(intent, wt, root);
      const session = wt?.session?.state ?? null;
      const worktree = { exists: wt !== null, path: wt?.path ?? null, branch: wt?.branch ?? null, session };
      const read = TERMINAL.has(intent.status)
        ? { metadata: { status: intent.status }, reviewHeader: null, files: {} }
        : await readOpenIntent(deps, intent, location, wt?.branch ?? branchFor(intent));
      const next = nextStep({ ...read, worktree });
      return { ...intent, next, worktree, location, session, review: read.reviewHeader?.verdict ?? null };
    }),
  );
  return { root, intents: waitingOnOwner(intents), worktrees };
}

/** Finds one intent in a loaded state, or null. */
export function findIntent(state, id) {
  return state.intents.find((i) => String(i.id) === String(id)) ?? null;
}
