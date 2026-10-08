#!/usr/bin/env node
// `npm run sdlc:scan [-- --since 2025-10-01] [--json]`
//
// Reads what each SDLC level leaves behind — context file, one-command
// verification, intents/ contents, skill stamps, review verdicts — plus the
// outcome measures from git history (throughput, intent-id reference rate,
// revert rate). /grid uses this to pre-fill docs/sdlc-grid.md; nobody should
// gather these numbers by hand.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseMetadata } from './intent-check-lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const since = flag('--since') ?? isoDaysAgo(365);
const asJson = args.includes('--json');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

function isoDaysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

// --- Agent-readiness (org rule 1) -----------------------------------------
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const readiness = {
  contextFile: existsSync('CLAUDE.md'),
  verifyCommand: Boolean(pkg.scripts?.verify),
  lint: Boolean(pkg.scripts?.lint),
  reviewPolicy: existsSync('REVIEW-POLICY.md'),
  typeCheck: Boolean(pkg.scripts?.['check:intent']),
};

// --- Intents and their artefacts ------------------------------------------
const STAMP_RE = /<!--\s*generated-by:\s*([^\s]+)\s*-->/;
const intents = [];
if (existsSync('intents')) {
  for (const dir of readdirSync('intents')) {
    const path = join('intents', dir);
    if (dir.startsWith('_') || !existsSync(join(path, 'metadata.yml'))) continue;
    const meta = parseMetadata(readFileSync(join(path, 'metadata.yml'), 'utf8'));
    const files = readdirSync(path);
    const stamps = {};
    for (const f of files.filter((x) => x.endsWith('.md'))) {
      const m = STAMP_RE.exec(readFileSync(join(path, f), 'utf8'));
      stamps[f] = m ? m[1] : null;
    }
    let review = null;
    if (files.includes('review.md')) {
      const text = readFileSync(join(path, 'review.md'), 'utf8');
      const field = (k) => new RegExp(`^${k}:\\s*(\\S+)`, 'm').exec(text)?.[1] ?? null;
      review = { verdict: field('verdict'), tier: field('tier'), round: field('round'), sampled: field('sampled') };
    }
    const links = Array.isArray(meta.links) ? meta.links : [];
    intents.push({ dir, id: meta.id, type: meta.type, status: meta.status, files, stamps, review, links });
  }
}
const countBy = (xs, key) => xs.reduce((acc, x) => ((acc[x[key] ?? 'unset'] = (acc[x[key] ?? 'unset'] ?? 0) + 1), acc), {});
const stamped = intents.filter((i) => Object.values(i.stamps).some(Boolean)).length;

// --- Outcome measures from main's first-parent history ---------------------
const log = git('log', '--first-parent', 'main', `--since=${since}`, '--format=%h%x09%ad%x09%s', '--date=short')
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [hash, date, ...rest] = l.split('\t');
    return { hash, date, subject: rest.join('\t') };
  });
const isPlanOnly = (s) => /^Plan[:\s]/i.test(s);
const changes = log.filter((c) => !isPlanOnly(c.subject));
const referencesIntent = (s) => /§\s?\d+/.test(s) || /\b(feat|fix|refactor|adjust|exp)\/\d+-/.test(s);
const reverts = changes.filter((c) => /^Revert\b/.test(c.subject));
// Measure from the later of --since and the first change, so a young repo's
// throughput isn't diluted by weeks before it existed.
const firstChange = changes.length ? changes[changes.length - 1].date : since;
const windowStart = Math.max(new Date(since).getTime(), new Date(firstChange).getTime());
const weeks = Math.max(1, (Date.now() - windowStart) / (7 * 86400000));

// --- Quality per review tier (REVIEW-POLICY.md "Against rubber-stamping") --
// A follow-up is a fix intent whose links name an earlier intent folder; it
// counts against the tier that earlier change was reviewed at. A revert
// counts against the tier of the § its subject names.
const tierOf = new Map(intents.filter((i) => i.review?.tier).map((i) => [String(i.id), i.review.tier]));
const perTier = {};
const bump = (tier, key) => {
  perTier[tier] ??= { changes: 0, followUps: 0, reverts: 0 };
  perTier[tier][key] += 1;
};
for (const tier of tierOf.values()) bump(tier, 'changes');
for (const i of intents.filter((x) => x.type === 'fix')) {
  for (const link of i.links) {
    const id = /^intents\/(\d+)-/.exec(link)?.[1];
    if (id && tierOf.has(id)) bump(tierOf.get(id), 'followUps');
  }
}
for (const c of reverts) {
  const id = /§\s?(\d+)/.exec(c.subject)?.[1];
  if (id && tierOf.has(id)) bump(tierOf.get(id), 'reverts');
}

const byMonth = {};
for (const c of changes) {
  const m = c.date.slice(0, 7);
  byMonth[m] = (byMonth[m] ?? 0) + 1;
}

const until = new Date().toISOString().slice(0, 10);
const report = {
  since,
  // The window the per-week figure divides by; record it with the number,
  // because the same history gives a different rate on a later day.
  window: { from: new Date(windowStart).toISOString().slice(0, 10), to: until },
  readiness,
  intents: {
    total: intents.length,
    byType: countBy(intents, 'type'),
    byStatus: countBy(intents, 'status'),
    withSkillStamp: stamped,
    reviews: intents.filter((i) => i.review).map((i) => ({ id: i.id, ...i.review })),
  },
  outcome: {
    changesOnMain: changes.length,
    perWeek: Number((changes.length / weeks).toFixed(2)),
    intentReferenceRate: changes.length ? Number((changes.filter((c) => referencesIntent(c.subject)).length / changes.length).toFixed(2)) : 0,
    reverts: reverts.length,
    revertRate: changes.length ? Number((reverts.length / changes.length).toFixed(3)) : 0,
    byMonth,
  },
  perTier,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const yes = (b) => (b ? 'yes' : 'no');
  const r = report;
  console.log(`# SDLC scan (main, window ${r.window.from} → ${r.window.to})\n`);
  console.log('## Agent-readiness');
  console.log(`context file: ${yes(r.readiness.contextFile)} · verify: ${yes(r.readiness.verifyCommand)} · lint: ${yes(r.readiness.lint)} · review policy: ${yes(r.readiness.reviewPolicy)} · type check: ${yes(r.readiness.typeCheck)}\n`);
  console.log('## Intents');
  console.log(`total: ${r.intents.total} · by type: ${JSON.stringify(r.intents.byType)} · by status: ${JSON.stringify(r.intents.byStatus)} · skill-stamped: ${r.intents.withSkillStamp}`);
  for (const rv of r.intents.reviews) console.log(`  review §${rv.id}: verdict ${rv.verdict}, tier ${rv.tier}, round ${rv.round}, sampled ${rv.sampled}`);
  console.log('\n## Outcome (first-parent commits on main, plan-only commits excluded)');
  console.log(`changes: ${r.outcome.changesOnMain} · per week: ${r.outcome.perWeek} · reference an intent/§: ${Math.round(r.outcome.intentReferenceRate * 100)}% · reverts: ${r.outcome.reverts} (${(r.outcome.revertRate * 100).toFixed(1)}%)`);
  console.log(`by month: ${Object.entries(r.outcome.byMonth).sort().map(([m, n]) => `${m}=${n}`).join(' ')}`);
  console.log('\n## Quality per review tier (intents with a review.md only)');
  const tiers = Object.entries(r.perTier);
  if (!tiers.length) console.log('no reviewed intents yet');
  for (const [tier, q] of tiers) console.log(`${tier}: ${q.changes} change(s) · ${q.followUps} follow-up fix(es) · ${q.reverts} revert(s)`);
}
