// The size budget (§61, spec B7 to B9): a committed ceiling, in physical
// lines, for every hand-written source file over the 500-line limit, so a big
// file can't keep growing unnoticed while the lint warning count stays put.
// Pure functions only; scripts/size-budget.mjs measures, check-intent.mjs
// reads git. Principle 13 in docs/architecture.md.

/** The file-length limit (matches `max-lines` in eslint.config.js). */
export const LIMIT = 500;
/** The most a ceiling may rise, or a new entry sit over LIMIT, per intent (B9). */
export const ALLOWANCE = 50;

/**
 * Physical lines, `wc -l` style: the number of `\n`. A CRLF file and its LF
 * twin count the same, and a missing final newline doesn't add a line.
 */
export function countLines(text) {
  let n = 0;
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++;
  return n;
}

const norm = (p) => p.replace(/\\/g, '/');

/**
 * B7: a budgeted file is a non-test `*.ts`, `*.mjs` or `*.js` under `src/`,
 * `server/`, `scripts/` or `tools/`. Excluded: tests (the lint length rules
 * are off there too), the generated `src/data/map.ts` and
 * `tools/map-extract/` (not Node/TS, not run at build time).
 */
export function isBudgeted(path) {
  const p = norm(path);
  if (!/^(src|server|scripts|tools)\//.test(p)) return false;
  if (!/\.(ts|mjs|js)$/.test(p)) return false;
  if (/\.test\.[^/]+$/.test(p)) return false;
  if (p === 'src/data/map.ts') return false;
  if (p.startsWith('tools/map-extract/')) return false;
  return true;
}

/**
 * The baseline for a measurement: every budgeted file over LIMIT, mapped to
 * its length, sorted by path.
 */
export function baselineFrom(measured) {
  const out = {};
  for (const path of Object.keys(measured).sort()) {
    if (isBudgeted(path) && measured[path] > LIMIT) out[path] = measured[path];
  }
  return out;
}

const BUDGET_RE = /^[\s>*-]*budget:\s+`?([^\s`]+)`?\s+\+(\d+):\s*(\S.*?)\s*$/;

/**
 * `budget: <path> +<n>: <reason>` lines from the plan's `## Where this goes`
 * section only (B10); the same text elsewhere in the plan is ignored.
 */
export function budgetLines(planText) {
  const out = [];
  let inSection = false;
  for (const line of String(planText ?? '').split(/\r?\n/)) {
    if (/^## /.test(line)) {
      inSection = /^## Where this goes\s*$/.test(line);
      continue;
    }
    if (!inSection) continue;
    const m = BUDGET_RE.exec(line);
    if (m) out.push({ path: norm(m[1]), n: Number(m[2]), reason: m[3] });
  }
  return out;
}

/**
 * B8's five failures.
 *
 * @param {object} input
 * @param {Record<string, number>} input.measured    lines of every budgeted file now present
 * @param {Record<string, number>} input.baseline    the branch's size-baseline.json
 * @param {Record<string, number>|null} input.baseBaseline  the merge base's, or null when it has none
 *   (first creation: rules 3 and 4 don't apply, there is nothing to grow from)
 * @param {string} input.planText                    the intent's plan.md ('' if none)
 * @returns {{rule: 1|2|3|4|5, message: string}[]}
 */
export function checkBudget({ measured, baseline, baseBaseline, planText }) {
  const errors = [];
  const fail = (rule, message) => errors.push({ rule, message });

  for (const [path, lines] of Object.entries(measured)) {
    if (!isBudgeted(path)) continue;
    const ceiling = baseline[path];
    if (ceiling === undefined) {
      if (lines > LIMIT) {
        fail(2, `${path} has ${lines} lines, over ${LIMIT}, and is not in scripts/size-baseline.json. Split it, or add it with a budget: line in the plan.`);
      }
    } else if (lines > ceiling) {
      fail(1, `${path} has ${lines} lines, over its ceiling of ${ceiling}. Move code out, or raise the ceiling with a budget: line in the plan.`);
    }
  }

  for (const [path, ceiling] of Object.entries(baseline)) {
    const lines = measured[path];
    if (lines === undefined) {
      fail(5, `${path} is in scripts/size-baseline.json but is gone or no longer budgeted. Remove the entry (npm run size:baseline -- --write).`);
    } else if (lines < ceiling) {
      fail(5, `${path} has ${lines} lines, under its ceiling of ${ceiling}. Lower the ceiling (npm run size:baseline -- --write).`);
    }
  }

  if (baseBaseline !== null && baseBaseline !== undefined) {
    const lines = budgetLines(planText);
    for (const [path, ceiling] of Object.entries(baseline)) {
      const base = baseBaseline[path];
      const growth = base === undefined ? ceiling - LIMIT : ceiling - base;
      if (growth <= 0 && base !== undefined) continue;
      const what = base === undefined ? `adds ${path} to the baseline (${ceiling} lines)` : `raises ${path} from ${base} to ${ceiling}`;
      if (growth > ALLOWANCE) {
        fail(3, `The branch ${what}: that is +${growth} lines, more than the ${ALLOWANCE} allowed per intent.`);
      }
      const stated = lines.find((l) => l.path === norm(path) && l.n >= growth);
      if (!stated) {
        fail(4, `The branch ${what} without a matching "budget: ${path} +${Math.max(growth, 0)}: <reason>" line in the plan's "Where this goes".`);
      }
    }
  }
  return errors;
}

/**
 * Splits checkBudget's failures into check-intent's `errors` and `routes`.
 * An adjustment or experiment has no plan, so it can't state a reason to
 * raise a ceiling: rules 3 and 4 route it ("re-declare as a fix or feature")
 * rather than block it. Rules 1, 2 and 5 are errors for every type.
 */
export function budgetVerdict(failures, type) {
  const errors = [];
  const routes = [];
  const planless = type === 'adjustment' || type === 'experiment';
  for (const f of failures) {
    if (planless && (f.rule === 3 || f.rule === 4)) {
      routes.push(`Declared ${type}, which has no plan to state a budget: line. ${f.message} Re-declare as a fix or feature.`);
    } else {
      errors.push(`Size budget: ${f.message}`);
    }
  }
  return { errors, routes };
}

/**
 * Reads the output of `git cat-file --batch` for a known list of requests, in
 * order: `<oid> <type> <size>\n<content>\n` per found object, or
 * `<name> missing\n`. Returns each object's text, or null when it was missing.
 */
export function parseCatFileBatch(buffer, count) {
  const out = [];
  let pos = 0;
  for (let i = 0; i < count; i++) {
    const eol = buffer.indexOf(0x0a, pos);
    const header = buffer.toString('utf8', pos, eol);
    pos = eol + 1;
    if (header.endsWith(' missing')) {
      out.push(null);
      continue;
    }
    const size = Number(header.split(' ')[2]);
    out.push(buffer.toString('utf8', pos, pos + size));
    pos += size + 1;
  }
  return out;
}
