// checkChange and `blocked_by` (spec §71 AC2). Ported from product-advice-agent
// §18's intent-check-lib.test.mjs cases (Vitest, I1); kept in its own file so
// intent-check-lib.test.mjs does not grow past its 509 lines. Every case
// asserts the exact errors/notes, so a FAIL for another reason cannot pass.
import { describe, expect, it } from 'vitest';
import { checkChange } from './intent-check-lib.mjs';

const meta = (over = {}) => ({
  id: '27',
  type: 'fix',
  status: 'in-progress',
  intent_accepted: '2026-10-07',
  plan_approved: '2026-10-07',
  ...over,
});
const base = (over = {}) => ({
  branch: 'fix/27-drift-log',
  metadata: meta(),
  intentDir: 'intents/27-drift-log',
  intentFiles: ['intent.md', 'plan.md', 'metadata.yml'],
  diff: [
    { path: 'src/engine/drift.ts', added: 4, deleted: 1 },
    { path: 'src/engine/drift.test.ts', added: 20, deleted: 0 },
  ],
  ...over,
});
const withBlocked = (items, blockers) => base({ metadata: meta({ blocked_by: items }), blockers });
const DIR = 'intents/27-drift-log/metadata.yml';

describe('checkChange and blocked_by', () => {
  it('fails on an open direct blocker, naming both intents', () => {
    const r = checkChange(withBlocked(['13    needs the growth'], [{ id: '13', reason: 'needs the growth', state: 'open' }]));
    expect(r.errors).toEqual(['§27 is blocked by §13, which is not merged into main (needs the growth).']);
  });
  it('leaves out the bracket when the open blocker has no reason', () => {
    const r = checkChange(withBlocked(['13'], [{ id: '13', reason: '', state: 'open' }]));
    expect(r.errors).toEqual(['§27 is blocked by §13, which is not merged into main.']);
  });
  it('fails on an unknown blocker and on a broken record', () => {
    const r = checkChange(withBlocked(['99    x', 'x    y', '27    me'], [{ id: '99', reason: 'x', state: 'unknown' }]));
    expect(r.errors).toEqual([
      `${DIR}: blocked_by item "x    y": "x" is not an intent id (digits).`,
      `${DIR}: blocked_by item "27    me": an intent cannot block itself.`,
      `${DIR}: blocked_by names §99, which is on no branch.`,
    ]);
  });
  it('fails on each broken-record kind alone', () => {
    expect(checkChange(withBlocked(['x    y'], [])).errors).toEqual([`${DIR}: blocked_by item "x    y": "x" is not an intent id (digits).`]);
    expect(checkChange(withBlocked(['27    me'], [])).errors).toEqual([`${DIR}: blocked_by item "27    me": an intent cannot block itself.`]);
  });
  it('notes an item without a reason, without failing', () => {
    const r = checkChange(withBlocked(['13'], [{ id: '13', reason: '', state: 'cleared' }]));
    expect(r.errors).toEqual([]);
    expect(r.notes).toContain(`${DIR}: blocked_by item "13": no reason given.`);
  });
  it('passes with cleared blockers, with none, and without the field', () => {
    expect(checkChange(withBlocked(['13    r'], [{ id: '13', reason: 'r', state: 'cleared' }])).errors).toEqual([]);
    expect(checkChange(withBlocked([], [])).errors).toEqual([]);
    expect(checkChange(base()).errors).toEqual([]);
  });
  it('an intent without the key gives the same result with or without blockers passed (B5)', () => {
    expect(checkChange(base({ blockers: [] }))).toEqual(checkChange(base()));
  });
});
