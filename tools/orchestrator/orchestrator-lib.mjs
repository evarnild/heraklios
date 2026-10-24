// Pure logic behind the orchestrator (§52): which step comes next for an
// intent, which gate buttons may be pressed, the Host/Origin checks, what a
// launched session is told, and the one-line gate write. No fs, no git, no
// processes: server.mjs does those through injected seams, and this file is
// unit-tested (orchestrator-lib.test.mjs). The rules themselves stay in
// intents/README.md, REVIEW-POLICY.md and the skills; this only reads them.
import { GATE_FIELDS, parseGate, TYPE_RULES } from '../../scripts/intent-check-lib.mjs';
import { setKeys } from '../../scripts/ship-lib.mjs';

/** The roles a session can be launched in (spec B5). Anything else is refused. */
export const ROLES = ['implementer', 'reviewer', 'auto'];
/** The agent definition in `.claude/agents/` the implementer role runs as (SDK `options.agent`, the `--agent` flag). */
export const IMPLEMENTER_AGENT = 'heraklios-implementer';

const TERMINAL = new Set(['done', 'abandoned', 'deferred']);
const ID_RE = /^[0-9]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for an intent id the routes accept: digits only, so it can never be an option or a path. */
export function validId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

const recorded = (metadata, gate) => parseGate(metadata?.[gate]).state === 'recorded';

// --- Host and Origin (spec B2), mirroring server/saveApi.ts --------------

/** This PC's own names only; a rebound attacker.example still sends its own Host. */
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:(\d+))?$/i;

/**
 * True when the request must be refused for its `Host`. Stricter than the
 * save API in one way: when the server's own `port` is given, the header must
 * carry that exact port (spec B2: "this PC's own name and port").
 */
export function foreignHost({ host }, port) {
  const m = typeof host === 'string' ? LOCAL_HOST.exec(host) : null;
  if (!m) return true;
  return port === undefined ? false : m[3] !== String(port);
}

/**
 * True when an `Origin` is present and is not `http://<own Host>`: another
 * website talking to localhost. No `Origin` (curl, same-origin GET) passes.
 */
export function foreignOrigin({ host, origin }) {
  if (origin === undefined) return false;
  try {
    return new URL(origin).origin !== `http://${host}`;
  } catch {
    return true; // "null" or garbage
  }
}

// --- Gate buttons (spec B8) ------------------------------------------------

/**
 * Whether a gate button may be pressed. Returns `{ ok, reason }`. A gate
 * already recorded, or malformed, is never overwritten here.
 */
export function gateAllowed(gate, { metadata, specExists, planExists, reviewHeader }) {
  const no = (reason) => ({ ok: false, reason });
  if (!GATE_FIELDS.includes(gate)) return no(`${gate} is not a gate`);
  if (!metadata) return no('no metadata.yml');
  if (TERMINAL.has(metadata.status)) return no(`the intent is ${metadata.status}`);
  if (parseGate(metadata[gate]).state !== 'empty') return no(`${gate} is already set`);
  const rules = TYPE_RULES[metadata.type];
  if (!rules) return no(`unknown type "${metadata.type}"`);
  if (gate === 'live_checked') {
    return reviewHeader?.['live-check'] === 'owed' ? { ok: true } : no('the current review does not say live-check: owed');
  }
  if (!rules.gates.includes(gate)) return no(`a ${metadata.type} has no ${gate}`);
  if (gate === 'intent_accepted') {
    return metadata.status === 'draft' ? { ok: true } : no('the intent is not a draft');
  }
  if (!recorded(metadata, 'intent_accepted')) return no('intent_accepted comes first');
  if (gate === 'spec_accepted') return specExists ? { ok: true } : no('there is no spec.md yet');
  if (rules.gates.includes('spec_accepted') && !recorded(metadata, 'spec_accepted')) return no('spec_accepted comes first');
  return planExists ? { ok: true } : no('there is no plan.md yet');
}

/**
 * The new metadata.yml text with `gate:` set to a bare date and every other
 * line untouched. A bare date is the owner's own gate (intents/README.md →
 * "Who edits what", "You write it directly"); the click is that act.
 */
export function gateWrite(text, gate, date) {
  if (!GATE_FIELDS.includes(gate)) throw new Error(`${gate} is not a gate`);
  if (!DATE_RE.test(date)) throw new Error(`date must be YYYY-MM-DD, got "${date}"`);
  return setKeys(text, { [gate]: date });
}

// --- The next step (spec B3) -----------------------------------------------

const owner = (step, gate) => (gate ? { step, owner: 'owner', gate } : { step, owner: 'owner' });
const agent = (step) => ({ step, owner: 'agent' });

function reviewStep(metadata, reviewHeader) {
  const verdict = reviewHeader?.verdict;
  if (!verdict) return agent('Run /review');
  if (verdict === 'rework') return agent('Rework the findings, then /review again');
  if (verdict === 'escalate') return owner('Decide the escalated findings');
  if (reviewHeader['live-check'] === 'owed' && !recorded(metadata, 'live_checked')) {
    return owner('Run the live check, then record it', 'live_checked');
  }
  return owner('Ship (dry-run first)');
}

function gateStep(metadata, files) {
  const rules = TYPE_RULES[metadata.type];
  if (!rules) return agent(`Fix metadata: unknown type "${metadata.type}"`);
  const needs = (g) => rules.gates.includes(g);
  if (!recorded(metadata, 'intent_accepted')) return owner('Accept the intent', 'intent_accepted');
  if (needs('spec_accepted') && !files.spec) return agent('Draft the spec (/spec)');
  if (needs('spec_accepted') && !recorded(metadata, 'spec_accepted')) return owner('Accept the spec', 'spec_accepted');
  if (needs('plan_approved') && !files.plan) return agent('Draft the plan (/build-plan)');
  if (needs('plan_approved') && !recorded(metadata, 'plan_approved')) return owner('Approve the plan', 'plan_approved');
  return null;
}

/**
 * `{ step, owner: 'owner' | 'agent' | 'none', gate? }`: what comes next for an
 * intent and who does it. `files` is `{ spec, plan }` (do they exist);
 * `worktree` is `{ exists, session }` with the sessions-view state text.
 */
export function nextStep({ metadata, reviewHeader, worktree, files = {} }) {
  if (!metadata) return { step: 'No metadata.yml', owner: 'none' };
  if (TERMINAL.has(metadata.status)) return { step: `Nothing: ${metadata.status}`, owner: 'none' };
  if (worktree?.session === 'needs you') return owner('Answer the waiting session');
  const gated = gateStep(metadata, files);
  if (gated) return gated;
  if (metadata.status === 'in-review') return reviewStep(metadata, reviewHeader);
  if (!worktree?.exists) return owner('Spawn the worktree');
  return agent('Implementer builds, then sets status: in-review');
}

/**
 * Entries (`{ id, next, session? }`) with what waits on the owner first, a
 * session that needs an answer ahead of the rest, then by id.
 */
export function waitingOnOwner(entries) {
  const rank = (e) => {
    if (e.session === 'needs you') return 0;
    return e.next?.owner === 'owner' ? 1 : 2;
  };
  return [...entries].sort((a, b) => rank(a) - rank(b) || Number(a.id) - Number(b.id));
}

// --- Launching a session (spec B5) -----------------------------------------

/**
 * `{ cwd, prompt }` for a role, plus `agent` for the implementer. The
 * implementer works in the intent's worktree on the brief `/spawn` step 5
 * gives, as the `heraklios-implementer` agent (the SDK's `options.agent`, the
 * `--agent` flag: its system prompt, tools and model, as `/spawn` launches it);
 * reviewer and auto run as the coordinator in the main checkout (spec B10). Throws on any other role and
 * on an id that is not digits.
 */
export function roleLaunch(role, { id, slug, worktreePath, mainPath, brief, branch, port }) {
  if (!ROLES.includes(role)) throw new Error(`unknown role "${role}"`);
  if (!validId(id)) throw new Error(`invalid intent id "${id}"`);
  if (role === 'reviewer') return { cwd: mainPath, prompt: `/review ${id}` };
  if (role === 'auto') return { cwd: mainPath, prompt: `/auto ${id}` };
  if (!worktreePath) throw new Error(`§${id} has no worktree: spawn it first`);
  const lines = [
    `You are the implementer for intent §${id} (${slug}).`,
    `Work in the worktree ${worktreePath}${branch ? ` on branch ${branch}` : ''}; the branch already exists and is checked out there, so skip any "branch from main" step.`,
    port ? `Its dev port is ${port}.` : null,
    `Read intents/${id}-${slug}/ (intent, spec, plan) and CLAUDE.md, then start the plan's subtasks in order.`,
    `Use absolute paths in the worktree and leave the main checkout ${mainPath} alone.`,
    'Never push, merge, rebase or record a gate. When `npm run verify` is green and the work is done, set `status: in-review` in metadata.yml and commit.',
    brief ? `\n${brief}` : null,
  ];
  return { cwd: worktreePath, prompt: lines.filter((l) => l !== null).join('\n'), agent: IMPLEMENTER_AGENT };
}

// --- What an Auto click can resume (spec B5, review F13) -------------------

const IN_TERMINAL = 'answered in a coordinator terminal with `/auto <id>` plus the answer';
/**
 * Stops whose resume needs the owner's *answer*, which an Auto click (it sends
 * only `/auto <id>`, to a headless session) cannot carry. The strings are the
 * ones .claude/skills/auto/SKILL.md writes, matched as prefixes (a stop may add detail).
 */
const NEEDS_ANSWER = [
  'spec questions',
  'decision needed',
  'spec or plan amendment needed',
  'critical finding',
  'plan exists unapproved',
  'plan found the spec incomplete',
];
/** Stops the skill does not resume at all: the intent continues by hand. */
const BY_HAND = ['out of rounds'];

const startsWithAny = (text, list) => list.some((p) => text.startsWith(p));

const AUTO_BASE = (id) =>
  `This click is your /auto ${id}. It authorises the session to record plan_approved (and auto_authorized) for §${id}, only for §${id} and only for this run. It runs Claude Code and may use your quota.`;

/**
 * What an Auto click may do for an intent whose `auto_stopped` is given
 * (null/empty: no run yet, or a session closed mid-run). Returns
 * `{ allowed, reason, confirmText }`: when `allowed` is false, `reason` says
 * why and where the stop is answered; when true, `confirmText` is what the
 * page's confirm shows, naming what the click means for that stop. Used by the
 * page (via /api/state) and enforced by the launch route, so a POST cannot skip it.
 */
export function autoLaunch(autoStopped, id = '<id>') {
  const stop = typeof autoStopped === 'string' ? autoStopped.trim() : '';
  const base = AUTO_BASE(id);
  if (startsWithAny(stop, NEEDS_ANSWER)) {
    return { allowed: false, reason: `Stopped: ${stop}. This needs your answer, which a click cannot carry: it is ${IN_TERMINAL.replace('<id>', id)}.` };
  }
  if (startsWithAny(stop, BY_HAND)) {
    return { allowed: false, reason: `Stopped: ${stop}. The skill does not resume this stop: the intent continues by hand.` };
  }
  let tail = '';
  if (stop === '') tail = 'It starts a run, or resumes one a closed session left.';
  else if (stop.startsWith('spec drafted')) tail = 'Record spec_accepted with its button first: this resumes the run from the accepted spec.';
  else if (stop.startsWith('live check owed')) tail = 'Record live_checked with its button first, once you have run the live check and it passed.';
  else if (stop.startsWith('escalate')) tail = 'It ALSO means "I have read the diff": the run goes on to the live-check or ship stop with no further review. Click only if you have read it.';
  else if (stop.startsWith('ready for /ship')) tail = 'It re-runs the ship dry-run and reports; it never ships.';
  else tail = `The run stopped at "${stop}". Click only if you have cleared that cause: the run redoes the step that stopped.`;
  return { allowed: true, confirmText: `${base} ${tail} Launch it?` };
}

// --- The command line (spec B1) ----------------------------------------------

/** Default port: the top of the per-intent range (spec Assumptions); `--port` overrides. */
export const DEFAULT_PORT = 5299;

/** `{ port }` from `[--port <n> | --port=<n>]`. Throws on anything else, so a typo cannot start the wrong thing. */
export function parseCliArgs(argv) {
  let port = DEFAULT_PORT;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    let raw = null;
    if (a === '--port') raw = argv[++i];
    else if (a.startsWith('--port=')) raw = a.slice('--port='.length);
    else throw new Error(`Unknown argument ${a}. Usage: npm run orchestrator [-- --port <1-65535>]`);
    if (!/^[0-9]{1,5}$/.test(raw ?? '') || Number(raw) < 1 || Number(raw) > 65535) {
      throw new Error(`--port needs a number from 1 to 65535, got "${raw ?? ''}"`);
    }
    port = Number(raw);
  }
  return { port };
}
