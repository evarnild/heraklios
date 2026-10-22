import { describe, expect, it } from 'vitest';
import {
  checkPreconditions,
  isShipped,
  commitMessage,
  isBookkept,
  markLiveChecked,
  markMerged,
  mergeMessage,
  moveRowToShipped,
  planSteps,
  routeReasonStated,
  shippedRow,
} from './ship-lib.mjs';

const dir = 'intents/9-thing';
const good = {
  reviewHeader: { verdict: 'escalate', 'reviewed-commit': 'abc1234' },
  isAncestor: true,
  changedFiles: [`${dir}/review.md`, `${dir}/metadata.yml`],
  intentDir: dir,
  checkIntent: { verdict: 'PASS', reasonStated: false },
};

describe('checkPreconditions', () => {
  it('passes a reviewed branch, attest or escalate', () => {
    expect(checkPreconditions(good)).toEqual({ ok: true });
    expect(checkPreconditions({ ...good, reviewHeader: { ...good.reviewHeader, verdict: 'attest' } }).ok).toBe(true);
  });

  it('fails a rework verdict, a missing verdict and a missing review.md', () => {
    const rework = checkPreconditions({ ...good, reviewHeader: { ...good.reviewHeader, verdict: 'rework' } });
    expect(rework).toMatchObject({ ok: false, failed: 'verdict' });
    expect(checkPreconditions({ ...good, reviewHeader: { 'reviewed-commit': 'abc' } })).toMatchObject({ failed: 'verdict' });
    expect(checkPreconditions({ ...good, reviewHeader: null })).toMatchObject({ failed: 'verdict' });
  });

  it('fails when reviewed-commit is not an ancestor, or is missing', () => {
    expect(checkPreconditions({ ...good, isAncestor: false })).toMatchObject({ ok: false, failed: 'reviewed-commit' });
    expect(checkPreconditions({ ...good, reviewHeader: { verdict: 'attest' } })).toMatchObject({ failed: 'reviewed-commit' });
  });

  it('allows only review.md and metadata.yml of the intent after the reviewed commit', () => {
    expect(checkPreconditions({ ...good, changedFiles: [] }).ok).toBe(true);
    const third = checkPreconditions({ ...good, changedFiles: [...good.changedFiles, 'src/x.ts'] });
    expect(third).toMatchObject({ ok: false, failed: 'unreviewed-changes' });
    expect(third.message).toContain('src/x.ts');
    // another intent's metadata.yml is not this intent's
    const other = checkPreconditions({ ...good, changedFiles: ['intents/8-other/metadata.yml'] });
    expect(other.failed).toBe('unreviewed-changes');
  });

  it('fails a check:intent FAIL', () => {
    expect(checkPreconditions({ ...good, checkIntent: { verdict: 'FAIL', reasonStated: true } })).toMatchObject({ failed: 'check-intent' });
  });

  it('accepts ROUTE only with the reason stated in review.md', () => {
    expect(checkPreconditions({ ...good, checkIntent: { verdict: 'ROUTE', reasonStated: false } })).toMatchObject({
      ok: false,
      failed: 'check-intent',
    });
    expect(checkPreconditions({ ...good, checkIntent: { verdict: 'ROUTE', reasonStated: true } }).ok).toBe(true);
  });

  it('checks precondition 1 alone when check:intent is left out', () => {
    const rest = { ...good, checkIntent: undefined };
    expect(checkPreconditions(rest).ok).toBe(true);
    expect(checkPreconditions({ ...rest, isAncestor: false }).ok).toBe(false);
  });
});

describe('routeReasonStated', () => {
  const review = (body) => `verdict: attest\n\n${body}\n`;
  it('ignores the route lines pasted into the Type check section, even with the word reason', () => {
    expect(routeReasonStated(review('## Type check\nROUTE, reason stated\n  route: Declared fix, but no test changed.\n\n## Findings\n- none'))).toBe(false);
  });
  it('accepts the forms of reviews 38 and 40', () => {
    expect(routeReasonStated(review('## Passes\n| 2 | Type check | ROUTE, reason above |'))).toBe(true);
    expect(routeReasonStated(review('## Passes\n| 2 | Type check | ROUTE, reason stated below |'))).toBe(true);
    expect(routeReasonStated(review('`check:intent` says ROUTE: "Declared fix, but no test changed." Reason:\nthe fix is an e2e scenario.'))).toBe(true);
  });
  it('refuses a ROUTE with no stated reason', () => {
    expect(routeReasonStated(review('## Findings\n- check:intent ROUTE: no reason found'))).toBe(false);
    expect(routeReasonStated(review('## Findings\n- ROUTE, reason not stated'))).toBe(false);
    expect(routeReasonStated(review('## Verified\n- npm run check:intent -> ROUTE (exit 2)'))).toBe(false);
    expect(routeReasonStated(review('## Passes\n| 2 | Type check | ROUTE |'))).toBe(false);
    expect(routeReasonStated(review('| 1 | Intent | pass (the Board has no route back; reason: reload) |'))).toBe(false);
    expect(routeReasonStated(review('## Findings\n- none'))).toBe(false);
  });
  // one phrase per way of saying "no reason"; each is caught by exactly one pattern in NO_REASON
  it.each([
    ['ROUTE: no reason found'],
    ['ROUTE, reason unclear'],
    ['ROUTE, reason: none'],
    ['ROUTE; the reason was not given'],
    ["ROUTE; the reason isn't stated"],
    ['ROUTE: Reason to be decided by the owner'],
  ])('refuses "%s"', (line) => {
    expect(routeReasonStated(review(`## Findings\n- ${line}`))).toBe(false);
    // the same line, with a real reason in place of the negation, is accepted
    expect(routeReasonStated(review('## Findings\n- ROUTE, reason stated: a config-only change'))).toBe(true);
  });
  it('reads the current round only', () => {
    const text = '# Round 2\nverdict: attest\n\n## Type check\nPASS\n\n## Findings\n- none\n\n# Round 1 (history)\n- ROUTE, reason stated\n';
    expect(routeReasonStated(text)).toBe(false);
    // and a history block after the Type check section must not hide... or supply... a reason
    expect(routeReasonStated('verdict: x\n\n## Type check\nROUTE\n\n# Round 1 (history)\n- ROUTE, reason stated\n')).toBe(false);
    expect(routeReasonStated('verdict: x\n\n## Findings\n- ROUTE, reason stated\n\n# Round 1 (history)\n')).toBe(true);
  });
});

const META = ['# generated-by: x', 'id: 9', 'status: in-review', 'live_checked:', 'merged:', 'links:', '  - a    # keep'];

describe('markMerged / markLiveChecked', () => {
  for (const [name, eol] of [['LF', '\n'], ['CRLF', '\r\n']]) {
    it(`sets merged and status, keeping every other line and the ${name} endings`, () => {
      const text = META.join(eol) + eol;
      const out = markMerged(text, 'deadbee', '2026-10-22');
      expect(out).toBe(
        [
          '# generated-by: x',
          'id: 9',
          'status: done',
          'live_checked:',
          "merged: deadbee    # 2026-10-22, merged by Claude on the owner's explicit request in chat",
          'links:',
          '  - a    # keep',
        ].join(eol) + eol,
      );
      expect(out.split(eol).length).toBe(text.split(eol).length);
      expect(out.replace(/\r\n/g, '').includes('\n')).toBe(false === (eol === '\r\n') ? true : out.replace(/\r\n/g, '').includes('\n'));
    });

    it(`records the live check with the owner's words (${name})`, () => {
      const out = markLiveChecked(META.join(eol), '2026-10-22', 'live "checked"');
      expect(out).toContain(`live_checked: 2026-10-22 by-agent    # owner: "live 'checked'"${eol}`);
      expect(out.endsWith(`  - a    # keep`)).toBe(true); // no final newline added
    });
  }

  it('does not create a line the file lacks', () => {
    expect(() => markMerged('id: 9\n', 'a', '2026-10-22')).toThrow(/no merged, status/);
  });

  it('leaves mixed endings as they were', () => {
    const out = markMerged('status: x\r\nmerged:\nnote: y\r\n', 'h', 'd');
    expect(out.startsWith('status: done\r\nmerged: h')).toBe(true);
    expect(out.includes('chat\nnote: y\r\n')).toBe(true);
  });
});

const PLAN = [
  '# Plan',
  '### Shipped',
  '',
  '| Item | Merge |',
  '| --- | --- |',
  '| [§1](a/) one | `111` |',
  '| [§2](b/) two | `222` |',
  '',
  '### In flight',
  '',
  '| Item | Type · status |',
  '| --- | --- |',
  '| [§9](intents/9-thing/) thing | feature · in flight |',
  '',
  '### Queued',
  '',
  '| Item | Type · status |',
  '| --- | --- |',
  '| [§3](c/) three | fix · draft |',
  '| [§9](intents/9-thing/) thing | feature · accepted |',
  '',
  'Footer | with a bar',
];
const ROW = '| [§9](intents/9-thing/) thing | `333` |';

describe('moveRowToShipped', () => {
  for (const [name, eol] of [['LF', '\n'], ['CRLF', '\r\n']]) {
    it(`removes the row from In flight and Queued and appends it to Shipped (${name})`, () => {
      const out = moveRowToShipped(PLAN.join(eol) + eol, 9, ROW);
      const expected = [...PLAN];
      expected.splice(19, 1); // Queued row
      expected.splice(12, 1); // In flight row
      expected.splice(7, 0, ROW); // after the last Shipped row
      expect(out).toBe(expected.join(eol) + eol);
    });
  }

  it('appends after the last Shipped row, not at the end of the file', () => {
    const out = moveRowToShipped(PLAN.join('\n'), 9, ROW).split('\n');
    expect(out[7]).toBe(ROW);
    expect(out.at(-1)).toBe('Footer | with a bar');
  });

  it('adds a line break when the Shipped table is the last thing in a file without a final newline', () => {
    const out = moveRowToShipped(['### Shipped', '| Item | Merge |', '| --- | --- |', '| [§1](a/) x | `1` |'].join('\r\n'), 9, ROW);
    expect(out).toBe(['### Shipped', '| Item | Merge |', '| --- | --- |', '| [§1](a/) x | `1` |', ROW].join('\r\n') + '\r\n');
  });

  it('touches no other row, even one whose id starts the same', () => {
    const text = PLAN.join('\n').replace('[§3](c/)', '[§90](c/)');
    expect(moveRowToShipped(text, 9, ROW)).toContain('[§90](c/) three');
  });

  it('does not read a table under another heading as the Shipped table (L12)', () => {
    const text = ['### Shipped', '', 'Nothing yet.', '', '### Queued', '', '| Item | x |', '| [§9](intents/9-thing/) thing |'].join('\n');
    expect(isShipped(text, 9)).toBe(false);
    expect(() => moveRowToShipped(text, 9, ROW)).toThrow(/Shipped/);
  });

  it('is a no-op when the row is already in Shipped, and refuses a plan without a Shipped table', () => {
    const done = moveRowToShipped(PLAN.join('\n'), 9, ROW);
    expect(moveRowToShipped(done, 9, ROW)).toBe(done);
    expect(() => moveRowToShipped('# no table\n', 9, ROW)).toThrow(/Shipped/);
  });
});

describe('shippedRow / isBookkept', () => {
  const info = { id: 9, slug: 'thing', title: 'Thing', type: 'feature', tier: 'reviewed', rounds: '3', hash: 'abcdef0' };
  it('builds the row in the plan.md style', () => {
    expect(shippedRow(info)).toBe(
      '| [§9](intents/9-thing/) Thing (feature, Reviewed, 3 review rounds; see [review.md](intents/9-thing/review.md)) | `abcdef0` |',
    );
    expect(shippedRow({ ...info, rounds: '1' })).toContain('1 review round;');
  });
  it('knows when the bookkeeping is already there', () => {
    const shipped = moveRowToShipped(PLAN.join('\n'), 9, ROW);
    expect(isBookkept({ status: 'done', merged: 'abc' }, shipped, 9)).toBe(true);
    expect(isBookkept({ status: 'done', merged: 'abc' }, PLAN.join('\n'), 9)).toBe(false);
    expect(isBookkept({ status: 'in-review', merged: '' }, shipped, 9)).toBe(false);
    expect(isBookkept({ status: 'in-review', merged: 'abc' }, shipped, 9)).toBe(false);
    expect(isBookkept({ status: 'done', merged: '' }, shipped, 9)).toBe(false);
    expect(isBookkept({ status: 'done', merged: [] }, shipped, 9)).toBe(false);
  });
});

describe('planSteps', () => {
  const none = { liveCheckRequested: false, liveCheckRecorded: false, merged: false, bookkept: false, pushed: false, cleanedUp: false };
  const statuses = (s) => Object.fromEntries(planSteps(s).map((p) => [p.id, p.status]));

  it('plans everything for a fresh run, the live check only when requested', () => {
    expect(statuses(none)).toEqual({
      'live-check': 'n/a',
      preconditions: 'todo',
      merge: 'todo',
      verify: 'todo',
      bookkeeping: 'todo',
      push: 'todo',
      remove: 'todo',
    });
    expect(statuses({ ...none, liveCheckRequested: true })['live-check']).toBe('todo');
    expect(statuses({ ...none, liveCheckRequested: true, liveCheckRecorded: true })['live-check']).toBe('done');
  });

  it('skips the first steps once the branch is merged, and re-runs verify until the bookkeeping is in', () => {
    expect(statuses({ ...none, merged: true })).toMatchObject({
      'live-check': 'done',
      preconditions: 'done',
      merge: 'done',
      verify: 'todo',
      bookkeeping: 'todo',
    });
  });

  it('resumes after the bookkeeping, the push and the removal', () => {
    const booked = statuses({ ...none, merged: true, bookkept: true });
    expect(booked).toMatchObject({ verify: 'done', bookkeeping: 'done', push: 'todo', remove: 'todo' });
    expect(statuses({ ...none, merged: true, bookkept: true, pushed: true })).toMatchObject({ push: 'done', remove: 'todo' });
    const all = statuses({ ...none, merged: true, bookkept: true, pushed: true, cleanedUp: true });
    expect(Object.values(all).every((v) => v === 'done')).toBe(true);
  });
});

describe('merge message', () => {
  it('puts the trailers after a blank line, adding none of its own', () => {
    expect(mergeMessage(9, 'Thing', ['Co-Authored-By: A <a@b>', 'Claude-Session: https://x'])).toBe(
      'Merge §9: Thing\n\nCo-Authored-By: A <a@b>\nClaude-Session: https://x\n',
    );
    expect(mergeMessage(9, 'Thing')).toBe('Merge §9: Thing\n');
    expect(commitMessage('s', ['  ', ''])).toBe('s\n');
  });
});
