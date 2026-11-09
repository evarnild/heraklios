import { describe, expect, it } from 'vitest';
import { ALLOWANCE, baselineFrom, budgetLines, budgetVerdict, checkBudget, countLines, isBudgeted, LIMIT, parseCatFileBatch } from './size-budget-lib.mjs';

const F = 'src/scenes/Big.ts';
const plan = (...lines) => `## Where this goes\n\n${lines.join('\n')}\n\n## Subtasks\n`;
const rules = (errors) => errors.map((e) => e.rule);

describe('countLines', () => {
  it('counts newlines like wc -l', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(0);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\nb')).toBe(1);
  });
  it('gives CRLF and LF the same count', () => {
    expect(countLines('a\r\nb\r\nc\r\n')).toBe(countLines('a\nb\nc\n'));
    expect(countLines('a\r\nb\r\nc\r\n')).toBe(3);
  });
});

describe('isBudgeted', () => {
  it.each(['src/engine/combat.ts', 'server/saveApi.ts', 'scripts/ship.mjs', 'tools/orchestrator/orchestrator.mjs', 'src/x.js'])(
    'budgets %s',
    (p) => expect(isBudgeted(p)).toBe(true),
  );
  it.each([
    ['a test', 'src/engine/combat.test.ts'],
    ['an mjs test', 'scripts/ship.test.mjs'],
    ['e2e', 'e2e/smoke.ts'],
    ['the generated map', 'src/data/map.ts'],
    ['map-extract', 'tools/map-extract/x.js'],
    ['docs', 'docs/x.ts'],
    ['a non-code file', 'src/x.json'],
    ['the baseline itself', 'scripts/size-baseline.json'],
  ])('does not budget %s', (_n, p) => expect(isBudgeted(p)).toBe(false));
  it('accepts Windows separators', () => expect(isBudgeted('src\\engine\\combat.ts')).toBe(true));
});

describe('baselineFrom', () => {
  it('keeps budgeted files over the limit, sorted', () => {
    const m = { 'src/b.ts': 600, 'src/a.ts': 501, 'src/c.ts': 500, 'src/data/map.ts': 1400, 'src/d.test.ts': 900 };
    expect(baselineFrom(m)).toEqual({ 'src/a.ts': 501, 'src/b.ts': 600 });
    expect(Object.keys(baselineFrom(m))).toEqual(['src/a.ts', 'src/b.ts']);
  });
});

describe('budgetLines', () => {
  it('reads lines from "Where this goes" only', () => {
    const text = [
      '## Subtasks',
      `budget: ${F} +5: ignored, wrong section`,
      '## Where this goes',
      `- budget: ${F} +20: the new prompt`,
      'budget: `src/x.ts` +3: with ticks',
      '## Tests',
      `budget: ${F} +9: ignored too`,
    ].join('\n');
    expect(budgetLines(text)).toEqual([
      { path: F, n: 20, reason: 'the new prompt' },
      { path: 'src/x.ts', n: 3, reason: 'with ticks' },
    ]);
  });
  it('needs a reason, and copes with no plan', () => {
    expect(budgetLines(plan(String.raw`budget: src\scenes\BoardScene.ts +5: why`))).toEqual([{ path: 'src/scenes/BoardScene.ts', n: 5, reason: 'why' }]);
    expect(budgetLines(plan(`budget: ${F} +5:`))).toEqual([]);
    expect(budgetLines('')).toEqual([]);
    expect(budgetLines(undefined)).toEqual([]);
  });
  it('reads a CRLF plan', () => {
    expect(budgetLines(plan(`budget: ${F} +5: why`).replace(/\n/g, '\r\n'))).toHaveLength(1);
  });
});

describe('checkBudget', () => {
  const base = { [F]: 600 };
  const ok = (over = {}) =>
    checkBudget({ measured: { [F]: 600 }, baseline: { ...base }, baseBaseline: { ...base }, planText: '', ...over });

  it('passes an unchanged file', () => expect(ok()).toEqual([]));

  it('rule 1: a file over its ceiling fails, at the ceiling passes', () => {
    expect(rules(ok({ measured: { [F]: 601 } }))).toEqual([1]);
    expect(ok({ measured: { [F]: 600 } })).toEqual([]);
  });

  it('rule 2: an unlisted file over 500 fails, at 500 passes', () => {
    expect(rules(ok({ measured: { [F]: 600, 'src/New.ts': LIMIT + 1 } }))).toEqual([2]);
    expect(ok({ measured: { [F]: 600, 'src/New.ts': LIMIT } })).toEqual([]);
  });

  it('rule 2 ignores files that are not budgeted', () => {
    expect(ok({ measured: { [F]: 600, 'src/New.test.ts': 900 } })).toEqual([]);
  });

  it('rule 3: raising a ceiling by 51 fails, even with a budget line', () => {
    const p = plan(`budget: ${F} +51: because`);
    expect(rules(ok({ measured: { [F]: 651 }, baseline: { [F]: 651 }, planText: p }))).toEqual([3]);
  });

  it('rule 3: raising by exactly 50 with a budget line passes', () => {
    const p = plan(`budget: ${F} +${ALLOWANCE}: because`);
    expect(ok({ measured: { [F]: 650 }, baseline: { [F]: 650 }, planText: p })).toEqual([]);
  });

  it('rule 4: raising by 10 without a budget line fails', () => {
    expect(rules(ok({ measured: { [F]: 610 }, baseline: { [F]: 610 } }))).toEqual([4]);
  });

  it('rule 4: a budget line that is too small, or for another file, fails', () => {
    const args = { measured: { [F]: 610 }, baseline: { [F]: 610 } };
    expect(rules(ok({ ...args, planText: plan(`budget: ${F} +9: short`) }))).toEqual([4]);
    expect(rules(ok({ ...args, planText: plan('budget: src/other.ts +10: wrong file') }))).toEqual([4]);
    expect(ok({ ...args, planText: plan(`budget: ${F} +10: right`) })).toEqual([]);
  });

  it('rule 4: a budget line outside "Where this goes" does not count', () => {
    const text = `## Subtasks\nbudget: ${F} +10: here\n`;
    expect(rules(ok({ measured: { [F]: 610 }, baseline: { [F]: 610 }, planText: text }))).toEqual([4]);
  });

  it('adding a file to the baseline needs a plan line and at most 50 over 500', () => {
    const G = 'src/engine/Newish.ts';
    const withG = { measured: { [F]: 600, [G]: 520 }, baseline: { [F]: 600, [G]: 520 } };
    expect(rules(ok(withG))).toEqual([4]);
    expect(ok({ ...withG, planText: plan(`budget: ${G} +20: new module`) })).toEqual([]);
    const big = { measured: { [F]: 600, [G]: 551 }, baseline: { [F]: 600, [G]: 551 } };
    expect(rules(ok({ ...big, planText: plan(`budget: ${G} +51: x`) }))).toEqual([3]);
  });

  it('rule 5: a shorter file whose ceiling was not lowered fails', () => {
    expect(rules(ok({ measured: { [F]: 590 } }))).toEqual([5]);
  });

  it('rule 5: lowering the ceiling to the length passes, and needs no plan line', () => {
    expect(ok({ measured: { [F]: 590 }, baseline: { [F]: 590 } })).toEqual([]);
  });

  it('rule 5: a file that fell to the limit leaves the baseline', () => {
    expect(rules(ok({ measured: { [F]: 500 } }))).toEqual([5]);
    expect(ok({ measured: { [F]: 500 }, baseline: {} })).toEqual([]);
  });

  it('rule 5: a deleted file must leave the baseline', () => {
    expect(rules(ok({ measured: {} }))).toEqual([5]);
    expect(ok({ measured: {}, baseline: {} })).toEqual([]);
  });

  it('first creation (no baseline at the merge base) needs no growth check or budget line', () => {
    const baseline = { [F]: 600, 'src/Z.ts': 700 };
    expect(checkBudget({ measured: { ...baseline }, baseline, baseBaseline: null, planText: '' })).toEqual([]);
  });

  it('first creation still applies rules 1, 2 and 5', () => {
    const run = (measured) => rules(checkBudget({ measured, baseline: { [F]: 600 }, baseBaseline: null, planText: '' }));
    expect(run({ [F]: 601 })).toEqual([1]);
    expect(run({ [F]: 600, 'src/Z.ts': 501 })).toEqual([2]);
    expect(run({ [F]: 550 })).toEqual([5]);
  });

  it('a growth in one file does not hide another', () => {
    const G = 'src/engine/Other.ts';
    const e = checkBudget({
      measured: { [F]: 610, [G]: 700 },
      baseline: { [F]: 610, [G]: 700 },
      baseBaseline: { [F]: 600, [G]: 700 },
      planText: plan(`budget: ${F} +10: ok`),
    });
    expect(e).toEqual([]);
  });
});

describe('budgetVerdict', () => {
  const failures = [
    { rule: 1, message: 'over' },
    { rule: 3, message: 'too much' },
    { rule: 4, message: 'no line' },
  ];
  it('keeps every failure an error for a feature', () => {
    const v = budgetVerdict(failures, 'feature');
    expect(v.errors).toHaveLength(3);
    expect(v.routes).toEqual([]);
  });
  it('routes rules 3 and 4 (both) for an adjustment or experiment, and keeps the others errors', () => {
    for (const type of ['adjustment', 'experiment']) {
      const v = budgetVerdict(failures, type);
      expect(v.errors).toEqual(['Size budget: over']);
      expect(v.routes).toHaveLength(2);
      expect(v.routes[0]).toContain('too much');
      expect(v.routes[1]).toContain('no line');
      expect(v.routes[0]).toContain('Re-declare as a fix or feature');
    }
  });
});

describe('parseCatFileBatch', () => {
  it('reads found and missing objects in order', () => {
    const buf = Buffer.from('abc blob 4\na\nb\n\nmain:gone missing\ndef blob 0\n\n');
    expect(parseCatFileBatch(buf, 3)).toEqual(['a\nb\n', null, '']);
  });
  it('counts bytes, not characters', () => {
    const buf = Buffer.from('abc blob 3\n\u00e9x\n');
    expect(parseCatFileBatch(buf, 1)).toEqual(['\u00e9x']);
  });
});
