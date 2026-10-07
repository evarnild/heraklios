// Pure logic behind `npm run check:intent` (scripts/check-intent.mjs).
// Kept free of git/fs calls so it can be unit-tested; see
// intent-check-lib.test.mjs. The rules it encodes are written down for
// humans in intents/README.md — change both together.

/** Branch prefix → intent type. */
export const PREFIX_TO_TYPE = {
  feat: 'feature',
  fix: 'fix',
  refactor: 'refactor',
  adjust: 'adjustment',
  exp: 'experiment',
};

/** Which artefacts each intent type requires, and which gates must be recorded. */
export const TYPE_RULES = {
  feature: { files: ['intent.md', 'spec.md', 'plan.md'], gates: ['intent_accepted', 'spec_accepted', 'plan_approved'] },
  fix: { files: ['intent.md', 'plan.md'], gates: ['intent_accepted', 'plan_approved'] },
  refactor: { files: ['intent.md', 'plan.md'], gates: ['intent_accepted', 'plan_approved'] },
  adjustment: { files: ['intent.md'], gates: ['intent_accepted'] },
  experiment: { files: ['intent.md'], gates: ['intent_accepted'] },
};

/** An adjustment is only an adjustment while its blast radius stays small. */
export const ADJUSTMENT_LIMITS = { files: 5, lines: 60 };

const BRANCH_RE = /^(?:codex\/)?(feat|fix|refactor|adjust|exp)\/(\d+)-([a-z0-9][a-z0-9-]*)$/;

/**
 * Parses `feat/27-naval-retreat` (optionally `codex/`-prefixed) into its parts.
 * Returns null for branches that carry no intent id (main, stable, worktree-agent-*).
 */
export function parseBranch(name) {
  const m = BRANCH_RE.exec(name.trim());
  if (!m) return null;
  return { prefix: m[1], type: PREFIX_TO_TYPE[m[1]], id: m[2], slug: m[3] };
}

/**
 * Minimal parser for the flat metadata.yml format in intents/_templates —
 * `key: value` lines, `#` comments, and `- item` list entries under a key
 * with an empty value. Not a general YAML parser, deliberately: the format is
 * ours, and a dependency for six keys is not worth it.
 */
export function parseMetadata(text) {
  const out = {};
  let listKey = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').replace(/^#.*$/, '');
    if (!line.trim()) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      out[listKey].push(unquote(item[1]));
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === '' || value === '[]') {
      out[key] = [];
      listKey = key;
    } else {
      out[key] = unquote(value);
      listKey = null;
    }
  }
  return out;
}

function unquote(v) {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

const isTest = (p) => /\.test\.(ts|mjs|js)$/.test(p);
const isRuleCode = (p) => /^src\/(engine|data)\//.test(p) && !isTest(p);
const isSource = (p) => /^src\//.test(p) && !isTest(p);
const isIntentArtefact = (p) => p.startsWith('intents/');

/**
 * Checks one change against its intent.
 *
 * @param {object} input
 * @param {string} input.branch          branch name
 * @param {object|null} input.metadata   parsed metadata.yml, or null if the folder is missing
 * @param {string|null} input.intentDir  e.g. "intents/27-naval-retreat", or null
 * @param {string[]} input.intentFiles   file names present in that folder
 * @param {{path:string, added:number, deleted:number}[]} input.diff  numstat vs. the merge base
 * @returns {{errors:string[], routes:string[], notes:string[], type:string|null, id:string|null}}
 *   errors block the change; routes say the declared type does not fit what
 *   arrived (the change should take the fuller path); notes are informational.
 */
export function checkChange({ branch, metadata, intentDir, intentFiles, diff }) {
  const errors = [];
  const routes = [];
  const notes = [];
  const parsed = parseBranch(branch);
  if (!parsed) {
    errors.push(
      `Branch "${branch}" carries no intent id. Name it <prefix>/<id>-<slug>, prefix one of ${Object.keys(PREFIX_TO_TYPE).join(', ')} (e.g. feat/27-naval-retreat).`,
    );
    return { errors, routes, notes, type: null, id: null };
  }
  const { id } = parsed;
  if (!metadata || !intentDir) {
    errors.push(`No intents/${id}-*/metadata.yml found for intent ${id}. Run /intent to draft it.`);
    return { errors, routes, notes, type: parsed.type, id };
  }

  const declared = metadata.type;
  if (!TYPE_RULES[declared]) {
    errors.push(`${intentDir}/metadata.yml: type "${declared}" is not one of ${Object.keys(TYPE_RULES).join(', ')}.`);
    return { errors, routes, notes, type: declared ?? null, id };
  }
  if (String(metadata.id) !== id) errors.push(`${intentDir}/metadata.yml: id "${metadata.id}" does not match branch id "${id}".`);
  if (declared !== parsed.type) {
    errors.push(`Branch prefix "${parsed.prefix}/" says ${parsed.type}, but ${intentDir}/metadata.yml declares ${declared}. Make them agree.`);
  }

  const rules = TYPE_RULES[declared];
  for (const f of rules.files) {
    if (!intentFiles.includes(f)) errors.push(`${declared} intents need ${intentDir}/${f}.`);
  }
  const touchesSource = diff.some((d) => isSource(d.path));
  for (const gate of rules.gates) {
    const v = metadata[gate];
    // An empty `gate:` line parses as an empty list, not a missing key.
    if (!v || (Array.isArray(v) && v.length === 0) || v === 'null' || v === '~') {
      // A plan that is not approved yet is fine while only artefacts change;
      // it is a gate violation once code arrives.
      const msg = `Gate "${gate}" is not recorded in ${intentDir}/metadata.yml.`;
      if (touchesSource) errors.push(`${msg} Code changed before the gate was passed.`);
      else notes.push(msg);
    }
  }

  checkShape(declared, diff, routes, notes);
  return { errors, routes, notes, type: declared, id };
}

/** Compares what arrived against what the declared type should look like. */
function checkShape(type, diff, routes, notes) {
  const code = diff.filter((d) => !isIntentArtefact(d.path));
  const lines = code.reduce((n, d) => n + d.added + d.deleted, 0);
  const testsTouched = code.some((d) => isTest(d.path));
  const ruleCodeTouched = code.some((d) => isRuleCode(d.path));
  notes.push(`${code.length} file(s), ${lines} line(s) changed outside intents/.`);

  if (type === 'adjustment') {
    if (code.length > ADJUSTMENT_LIMITS.files || lines > ADJUSTMENT_LIMITS.lines) {
      routes.push(
        `Declared adjustment, but ${code.length} files / ${lines} lines changed (limit ${ADJUSTMENT_LIMITS.files} / ${ADJUSTMENT_LIMITS.lines}). Route to fix or feature.`,
      );
    }
    if (ruleCodeTouched) routes.push('Declared adjustment, but rule code in src/engine or src/data changed. Route to fix or feature.');
  }
  if (type === 'fix' && !testsTouched && code.length > 0) {
    routes.push('Declared fix, but no test changed. A fix carries a test so the defect cannot come back.');
  }
  if (type === 'refactor') {
    const testDeletions = code.filter((d) => isTest(d.path) && d.deleted > 0).map((d) => d.path);
    if (testDeletions.length) {
      routes.push(`Declared refactor, but existing tests lost lines (${testDeletions.join(', ')}). Behaviour may have changed — check, or route to feature.`);
    }
  }
  if ((type === 'feature' || type === 'fix') && ruleCodeTouched && !testsTouched) {
    routes.push('Rule code in src/engine or src/data changed with no test change.');
  }
}

/** Formats a result as the "Type check" block the review report embeds. */
export function formatResult(r) {
  const verdict = r.errors.length ? 'FAIL' : r.routes.length ? 'ROUTE' : 'PASS';
  const out = [`type-check: ${verdict}${r.id ? ` (intent ${r.id}, ${r.type})` : ''}`];
  for (const e of r.errors) out.push(`  error: ${e}`);
  for (const x of r.routes) out.push(`  route: ${x}`);
  for (const n of r.notes) out.push(`  note:  ${n}`);
  return { verdict, text: out.join('\n') };
}
