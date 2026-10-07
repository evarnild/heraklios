import { describe, expect, it } from 'vitest';
import { checkChange, formatResult, parseBranch, parseMetadata } from './intent-check-lib.mjs';

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

describe('parseBranch', () => {
  it('reads prefix, type, id and slug', () => {
    expect(parseBranch('feat/27-naval-retreat')).toEqual({ prefix: 'feat', type: 'feature', id: '27', slug: 'naval-retreat' });
    expect(parseBranch('codex/adjust/3-copy')).toMatchObject({ type: 'adjustment', id: '3' });
  });

  it('returns null for branches without an intent id', () => {
    for (const b of ['main', 'stable', 'feat/naval-retreat', 'worktree-agent-a164fba', 'chore/27-x']) {
      expect(parseBranch(b)).toBeNull();
    }
  });
});

describe('parseMetadata', () => {
  it('reads scalars, quoted values, comments and lists', () => {
    const m = parseMetadata(
      ['id: 27', 'type: "fix"   # declared', '# a comment', 'intent_accepted: ', 'links:', '  - plan-history.md#19', "  - 'intents/26-x'", 'status: draft'].join('\r\n'),
    );
    expect(m).toEqual({ id: '27', type: 'fix', intent_accepted: [], links: ['plan-history.md#19', 'intents/26-x'], status: 'draft' });
  });
});

describe('checkChange', () => {
  it('passes a well-formed fix', () => {
    const r = checkChange(base());
    expect(r.errors).toEqual([]);
    expect(r.routes).toEqual([]);
    expect(formatResult(r).verdict).toBe('PASS');
  });

  it('fails a branch with no intent id', () => {
    const r = checkChange(base({ branch: 'feat/naval-retreat' }));
    expect(formatResult(r).verdict).toBe('FAIL');
    expect(r.errors[0]).toMatch(/carries no intent id/);
  });

  it('fails when the intent folder is missing', () => {
    const r = checkChange(base({ metadata: null, intentDir: null }));
    expect(r.errors[0]).toMatch(/No intents\/27-\*/);
  });

  it('fails when branch prefix and declared type disagree', () => {
    const r = checkChange(base({ branch: 'feat/27-drift-log' }));
    expect(r.errors.join()).toMatch(/says feature, but .* declares fix/);
  });

  it('fails when the metadata id differs from the branch id', () => {
    const r = checkChange(base({ metadata: meta({ id: '28' }) }));
    expect(r.errors.join()).toMatch(/does not match branch id/);
  });

  it('fails an unknown type', () => {
    const r = checkChange(base({ metadata: meta({ type: 'chore' }) }));
    expect(r.errors.join()).toMatch(/not one of/);
  });

  it('requires the artefacts the type needs', () => {
    const r = checkChange(base({ branch: 'feat/27-drift-log', metadata: meta({ type: 'feature', spec_accepted: '2026-10-07' }) }));
    expect(r.errors).toContain('feature intents need intents/27-drift-log/spec.md.');
  });

  it('treats a missing gate as an error only once source code changed', () => {
    const noPlan = meta({ plan_approved: [] });
    const withCode = checkChange(base({ metadata: noPlan }));
    expect(withCode.errors.join()).toMatch(/plan_approved.*Code changed before the gate/);

    const artefactsOnly = checkChange(base({ metadata: noPlan, diff: [{ path: 'intents/27-drift-log/plan.md', added: 40, deleted: 0 }] }));
    expect(artefactsOnly.errors).toEqual([]);
    expect(artefactsOnly.notes.join()).toMatch(/plan_approved/);
  });

  it('routes a fix that carries no test', () => {
    const r = checkChange(base({ diff: [{ path: 'src/ui/hexTooltip.ts', added: 3, deleted: 1 }] }));
    expect(formatResult(r).verdict).toBe('ROUTE');
    expect(r.routes.join()).toMatch(/no test changed/);
  });

  it('routes an adjustment that outgrew its blast radius', () => {
    const adj = { branch: 'adjust/27-copy', metadata: meta({ type: 'adjustment' }), intentFiles: ['intent.md', 'metadata.yml'] };
    const small = checkChange(base({ ...adj, diff: [{ path: 'README.md', added: 5, deleted: 5 }] }));
    expect(small.routes).toEqual([]);

    const big = checkChange(base({ ...adj, diff: [{ path: 'src/ui/session.ts', added: 50, deleted: 20 }] }));
    expect(big.routes.join()).toMatch(/70 lines/);

    const files = Array.from({ length: 6 }, (_, i) => ({ path: `docs/a${i}.md`, added: 1, deleted: 0 }));
    expect(checkChange(base({ ...adj, diff: files })).routes.join()).toMatch(/6 files/);

    const rules = checkChange(base({ ...adj, diff: [{ path: 'src/data/units.ts', added: 1, deleted: 1 }] }));
    expect(rules.routes.join()).toMatch(/rule code/);
  });

  it('does not count intents/ artefacts toward the adjustment limits', () => {
    const r = checkChange(
      base({
        branch: 'adjust/27-copy',
        metadata: meta({ type: 'adjustment' }),
        intentFiles: ['intent.md', 'metadata.yml'],
        diff: [
          { path: 'intents/27-copy/intent.md', added: 200, deleted: 0 },
          { path: 'README.md', added: 2, deleted: 2 },
        ],
      }),
    );
    expect(r.routes).toEqual([]);
  });

  it('routes a refactor that removed test lines', () => {
    const r = checkChange(
      base({
        branch: 'refactor/27-split',
        metadata: meta({ type: 'refactor' }),
        diff: [
          { path: 'src/scenes/BoardScene.ts', added: 10, deleted: 200 },
          { path: 'src/engine/combat.test.ts', added: 0, deleted: 12 },
        ],
      }),
    );
    expect(r.routes.join()).toMatch(/existing tests lost lines \(src\/engine\/combat.test.ts\)/);
  });

  it('routes a feature that changed rule code without a test', () => {
    const r = checkChange(
      base({
        branch: 'feat/27-x',
        metadata: meta({ type: 'feature', spec_accepted: '2026-10-07' }),
        intentFiles: ['intent.md', 'spec.md', 'plan.md', 'metadata.yml'],
        diff: [{ path: 'src/engine/combat.ts', added: 30, deleted: 2 }],
      }),
    );
    expect(r.routes.join()).toMatch(/Rule code .* no test change/);
  });
});
