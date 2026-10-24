import { describe, expect, it } from 'vitest';
import {
  autoLaunch,
  foreignHost,
  foreignOrigin,
  gateAllowed,
  gateWrite,
  nextStep,
  parseCliArgs,
  roleLaunch,
  validId,
  waitingOnOwner,
} from './orchestrator-lib.mjs';

describe('validId', () => {
  it('accepts digits only', () => {
    expect(validId('52')).toBe(true);
    for (const bad of ['', '5a', '-1', '1 2', '../1', '1;2', '--x', 52, null, undefined]) {
      expect(validId(bad)).toBe(false);
    }
  });
});

describe('foreignHost (spec B2)', () => {
  it('accepts this PC own names, with the server port when it is given', () => {
    for (const host of ['localhost:5299', '127.0.0.1:5299', '[::1]:5299', 'LOCALHOST:5299']) {
      expect(foreignHost({ host }, 5299)).toBe(false);
    }
    expect(foreignHost({ host: 'localhost' })).toBe(false);
  });
  it('refuses a foreign name, a missing Host, a lookalike and a wrong or missing port', () => {
    for (const host of ['evil.example', 'evil.example:5299', 'localhost.evil.example:5299', '127.0.0.1.evil:5299', '192.168.1.5:5299', '']) {
      expect(foreignHost({ host }, 5299)).toBe(true);
    }
    expect(foreignHost({ host: undefined }, 5299)).toBe(true);
    expect(foreignHost({ host: 'localhost:5173' }, 5299)).toBe(true);
    expect(foreignHost({ host: 'localhost' }, 5299)).toBe(true);
  });
});

describe('foreignOrigin (spec B2)', () => {
  const host = '127.0.0.1:5299';
  it('allows no Origin and the server own origin', () => {
    expect(foreignOrigin({ host, origin: undefined })).toBe(false);
    expect(foreignOrigin({ host, origin: 'http://127.0.0.1:5299' })).toBe(false);
  });
  it('refuses another site, another port, another scheme, "null" and garbage', () => {
    for (const origin of ['http://evil.example', 'http://127.0.0.1:5173', 'https://127.0.0.1:5299', 'http://localhost:5299', 'null', 'x y']) {
      expect(foreignOrigin({ host, origin })).toBe(true);
    }
  });
});

describe('nextStep (spec B3)', () => {
  const meta = (over) => ({
    type: 'feature',
    status: 'draft',
    intent_accepted: [],
    spec_accepted: [],
    plan_approved: [],
    live_checked: [],
    ...over,
  });
  const D = '2026-10-23';
  const files = { spec: true, plan: true };

  it('draft: the owner accepts the intent', () => {
    expect(nextStep({ metadata: meta({}) })).toEqual({ step: 'Accept the intent', owner: 'owner', gate: 'intent_accepted' });
  });
  it('accepted feature without spec.md: an agent drafts it', () => {
    const metadata = meta({ status: 'accepted', intent_accepted: D });
    expect(nextStep({ metadata, files: {} })).toEqual({ step: 'Draft the spec (/spec)', owner: 'agent' });
  });
  it('spec present, not accepted: the owner accepts it', () => {
    const metadata = meta({ status: 'accepted', intent_accepted: D });
    expect(nextStep({ metadata, files })).toEqual({ step: 'Accept the spec', owner: 'owner', gate: 'spec_accepted' });
  });
  it('spec accepted, no plan.md: an agent drafts it', () => {
    const metadata = meta({ status: 'accepted', intent_accepted: D, spec_accepted: D });
    expect(nextStep({ metadata, files: { spec: true } })).toEqual({ step: 'Draft the plan (/build-plan)', owner: 'agent' });
  });
  it('plan present, not approved: the owner approves it', () => {
    const metadata = meta({ status: 'accepted', intent_accepted: D, spec_accepted: D });
    expect(nextStep({ metadata, files })).toEqual({ step: 'Approve the plan', owner: 'owner', gate: 'plan_approved' });
  });
  it('all gates, no worktree: the owner spawns', () => {
    const metadata = meta({ status: 'accepted', intent_accepted: D, spec_accepted: D, plan_approved: `${D} by-agent` });
    expect(nextStep({ metadata, files, worktree: { exists: false } })).toEqual({ step: 'Spawn the worktree', owner: 'owner' });
  });
  it('all gates, worktree: the implementer builds', () => {
    const metadata = meta({ status: 'in-progress', intent_accepted: D, spec_accepted: D, plan_approved: D });
    expect(nextStep({ metadata, files, worktree: { exists: true, session: 'working' } })).toEqual({
      step: 'Implementer builds, then sets status: in-review',
      owner: 'agent',
    });
  });
  it('a worktree session that needs you beats everything else', () => {
    const metadata = meta({ status: 'in-progress', intent_accepted: D, spec_accepted: D, plan_approved: D });
    expect(nextStep({ metadata, files, worktree: { exists: true, session: 'needs you' } })).toEqual({
      step: 'Answer the waiting session',
      owner: 'owner',
    });
  });
  describe('in-review', () => {
    const metadata = meta({ status: 'in-review', intent_accepted: D, spec_accepted: D, plan_approved: D });
    it('no review yet: /review', () => {
      expect(nextStep({ metadata, files, reviewHeader: {} })).toEqual({ step: 'Run /review', owner: 'agent' });
    });
    it('rework: the agent reworks', () => {
      expect(nextStep({ metadata, files, reviewHeader: { verdict: 'rework' } })).toEqual({
        step: 'Rework the findings, then /review again',
        owner: 'agent',
      });
    });
    it('escalate: the owner decides', () => {
      expect(nextStep({ metadata, files, reviewHeader: { verdict: 'escalate' } })).toEqual({
        step: 'Decide the escalated findings',
        owner: 'owner',
      });
    });
    it('attest with a live check owed: the owner records it', () => {
      expect(nextStep({ metadata, files, reviewHeader: { verdict: 'attest', 'live-check': 'owed' } })).toEqual({
        step: 'Run the live check, then record it',
        owner: 'owner',
        gate: 'live_checked',
      });
    });
    it('attest, live check done or not needed: ship', () => {
      const shipStep = { step: 'Ship (dry-run first)', owner: 'owner' };
      expect(nextStep({ metadata, files, reviewHeader: { verdict: 'attest', 'live-check': 'not-needed' } })).toEqual(shipStep);
      const done = { ...metadata, live_checked: D };
      expect(nextStep({ metadata: done, files, reviewHeader: { verdict: 'attest', 'live-check': 'owed' } })).toEqual(shipStep);
    });
  });
  it('an adjustment needs only the intent gate', () => {
    const metadata = meta({ type: 'adjustment', status: 'accepted', intent_accepted: D });
    expect(nextStep({ metadata, files: {}, worktree: { exists: false } })).toEqual({ step: 'Spawn the worktree', owner: 'owner' });
  });
  it('done, abandoned, deferred and missing metadata have nothing next', () => {
    expect(nextStep({ metadata: meta({ status: 'done' }) })).toEqual({ step: 'Nothing: done', owner: 'none' });
    expect(nextStep({ metadata: meta({ status: 'abandoned' }) }).owner).toBe('none');
    expect(nextStep({ metadata: meta({ status: 'deferred' }) }).owner).toBe('none');
    expect(nextStep({ metadata: null })).toEqual({ step: 'No metadata.yml', owner: 'none' });
  });
});

describe('gateAllowed (spec B8)', () => {
  const D = '2026-10-23';
  const base = { type: 'feature', status: 'accepted', intent_accepted: D, spec_accepted: [], plan_approved: [], live_checked: [] };
  const ctx = (over = {}) => ({ metadata: base, specExists: true, planExists: true, reviewHeader: {}, ...over });
  const withMeta = (over) => ctx({ metadata: { ...base, ...over } });

  it('intent_accepted: only on a draft', () => {
    expect(gateAllowed('intent_accepted', withMeta({ status: 'draft', intent_accepted: [] })).ok).toBe(true);
    expect(gateAllowed('intent_accepted', withMeta({ status: 'accepted', intent_accepted: [] })).ok).toBe(false);
  });
  it('spec_accepted: needs spec.md and the intent gate', () => {
    expect(gateAllowed('spec_accepted', ctx()).ok).toBe(true);
    expect(gateAllowed('spec_accepted', ctx({ specExists: false })).ok).toBe(false);
    expect(gateAllowed('spec_accepted', withMeta({ intent_accepted: [] })).ok).toBe(false);
  });
  it('plan_approved: needs plan.md, and for a feature the spec gate', () => {
    expect(gateAllowed('plan_approved', withMeta({ spec_accepted: D })).ok).toBe(true);
    expect(gateAllowed('plan_approved', ctx({ metadata: { ...base, spec_accepted: D }, planExists: false })).ok).toBe(false);
    expect(gateAllowed('plan_approved', ctx()).ok).toBe(false); // spec not accepted yet
  });
  it('plan_approved on a fix needs no spec gate', () => {
    const metadata = { type: 'fix', status: 'accepted', intent_accepted: D, plan_approved: [] };
    expect(gateAllowed('plan_approved', ctx({ metadata })).ok).toBe(true);
    expect(gateAllowed('spec_accepted', ctx({ metadata })).ok).toBe(false);
  });
  it('live_checked: only when the current review says owed', () => {
    expect(gateAllowed('live_checked', ctx({ reviewHeader: { 'live-check': 'owed' } })).ok).toBe(true);
    expect(gateAllowed('live_checked', ctx({ reviewHeader: { 'live-check': 'not-needed' } })).ok).toBe(false);
    expect(gateAllowed('live_checked', ctx({ reviewHeader: undefined })).ok).toBe(false);
  });
  it('refuses a gate already recorded or malformed, a terminal intent, and what is not a gate', () => {
    expect(gateAllowed('intent_accepted', withMeta({ status: 'draft' })).ok).toBe(false);
    expect(gateAllowed('spec_accepted', withMeta({ spec_accepted: 'yes' })).ok).toBe(false);
    expect(gateAllowed('spec_accepted', withMeta({ status: 'done' })).ok).toBe(false);
    expect(gateAllowed('merged', ctx()).ok).toBe(false);
    expect(gateAllowed('spec_accepted', { ...ctx(), metadata: null }).ok).toBe(false);
  });
  it('gives a reason when it refuses', () => {
    expect(gateAllowed('spec_accepted', ctx({ specExists: false }))).toEqual({ ok: false, reason: 'there is no spec.md yet' });
  });
});

describe('gateWrite (spec B8)', () => {
  const text = [
    '# generated-by: heraklios/intent@0.1.5',
    'id: 52',
    'status: accepted',
    'intent_accepted: 2026-10-23 by-agent    # owner: "accept"',
    'spec_accepted:',
    'plan_approved:    # later',
    'live_checked:',
    '',
  ].join('\n');

  it('replaces only that line with a bare date', () => {
    expect(gateWrite(text, 'spec_accepted', '2026-10-24')).toBe(
      text.replace('spec_accepted:\n', 'spec_accepted: 2026-10-24\n'),
    );
  });
  it('never writes by-agent, and drops the old comment of that line only', () => {
    const out = gateWrite(text, 'plan_approved', '2026-10-24');
    expect(out).toContain('plan_approved: 2026-10-24\n');
    expect(out).not.toContain('by-agent    # later');
    expect(out).toContain('intent_accepted: 2026-10-23 by-agent    # owner: "accept"');
  });
  it('keeps CRLF endings', () => {
    const crlf = text.replace(/\n/g, '\r\n');
    expect(gateWrite(crlf, 'live_checked', '2026-10-24')).toBe(crlf.replace('live_checked:\r\n', 'live_checked: 2026-10-24\r\n'));
  });
  it('refuses a non-gate key, a bad date and a missing line', () => {
    expect(() => gateWrite(text, 'status', '2026-10-24')).toThrow(/not a gate/);
    expect(() => gateWrite(text, 'spec_accepted', '2026-10-24 by-agent')).toThrow(/YYYY-MM-DD/);
    expect(() => gateWrite('id: 1\n', 'spec_accepted', '2026-10-24')).toThrow(/no spec_accepted line/);
  });
});

describe('roleLaunch (spec B5)', () => {
  const args = { id: '52', slug: 'orchestrator-ui', worktreePath: 'C:/wt/52-orchestrator-ui', mainPath: 'C:/repo', branch: 'feat/52-orchestrator-ui', port: 5252 };
  it('reviewer and auto run in the main checkout with the skill command', () => {
    expect(roleLaunch('reviewer', args)).toEqual({ cwd: 'C:/repo', prompt: '/review 52' });
    expect(roleLaunch('auto', args)).toEqual({ cwd: 'C:/repo', prompt: '/auto 52' });
    expect('agent' in roleLaunch('reviewer', args) || 'agent' in roleLaunch('auto', args)).toBe(false);
  });
  it('implementer runs in the worktree with the brief', () => {
    const out = roleLaunch('implementer', { ...args, brief: 'BRIEF TEXT' });
    expect(out.cwd).toBe('C:/wt/52-orchestrator-ui');
    expect(out.agent).toBe('heraklios-implementer'); // the real agent, as /spawn runs it (F5)
    expect(out.prompt).toContain('intent §52 (orchestrator-ui)');
    expect(out.prompt).toContain('on branch feat/52-orchestrator-ui');
    expect(out.prompt).toContain('Its dev port is 5252.');
    expect(out.prompt).toContain('intents/52-orchestrator-ui/');
    expect(out.prompt).toContain('leave the main checkout C:/repo alone');
    expect(out.prompt.endsWith('\nBRIEF TEXT')).toBe(true);
  });
  it('implementer without a worktree is refused', () => {
    expect(() => roleLaunch('implementer', { ...args, worktreePath: undefined })).toThrow(/no worktree/);
  });
  it('refuses an unknown role and a non-digit id', () => {
    for (const role of ['shell', 'coordinator', '', undefined, 'Auto']) expect(() => roleLaunch(role, args)).toThrow(/unknown role/);
    for (const id of ['5a', '', '52 --x', '../52']) expect(() => roleLaunch('auto', { ...args, id })).toThrow(/invalid intent id/);
  });
});

describe('waitingOnOwner (spec B3)', () => {
  it('puts a session that needs you first, then the owner steps, then the rest, each by id', () => {
    const e = (id, owner, session) => ({ id: String(id), next: { owner }, session });
    const out = waitingOnOwner([e(9, 'agent'), e(30, 'owner'), e(12, 'owner'), e(40, 'agent', 'needs you'), e(5, 'none')]);
    expect(out.map((x) => x.id)).toEqual(['40', '12', '30', '5', '9']);
  });
  it('does not change its input', () => {
    const input = [{ id: '2', next: { owner: 'agent' } }, { id: '1', next: { owner: 'owner' } }];
    waitingOnOwner(input);
    expect(input.map((x) => x.id)).toEqual(['2', '1']);
  });
});

describe('parseCliArgs (spec B1)', () => {
  it('defaults to 5299 and takes --port in both forms', () => {
    expect(parseCliArgs([])).toEqual({ port: 5299 });
    expect(parseCliArgs(['--port', '6000'])).toEqual({ port: 6000 });
    expect(parseCliArgs(['--port=6001'])).toEqual({ port: 6001 });
  });
  it('refuses a bad port, a missing value and any other argument', () => {
    for (const argv of [['--port'], ['--port', 'x'], ['--port', '0'], ['--port', '70000'], ['--port=1e3'], ['--host', '0.0.0.0'], ['5299']]) {
      expect(() => parseCliArgs(argv), argv.join(' ')).toThrow();
    }
  });
});

describe('autoLaunch: what an Auto click can resume (F13)', () => {
  it('starts, or resumes a closed session, with no stop recorded', () => {
    for (const none of [null, undefined, '', '  ']) {
      const r = autoLaunch(none, '52');
      expect(r.allowed).toBe(true);
      expect(r.confirmText).toContain('/auto 52');
      expect(r.confirmText).toContain('plan_approved');
      expect(r.confirmText).toContain('It starts a run'); // blank text is no stop, not a cause to clear
    }
  });
  it('an escalate stop: the click also means "I have read the diff"', () => {
    const r = autoLaunch('escalate, owner reads the diff', '52');
    expect(r.allowed).toBe(true);
    expect(r.confirmText).toContain('I have read the diff');
  });
  it('spec drafted and live check owed: tells the owner to record the gate first', () => {
    const spec = autoLaunch('spec drafted, waiting for spec_accepted', '52');
    expect(spec.allowed).toBe(true);
    expect(spec.confirmText).toContain('spec_accepted');
    const live = autoLaunch('live check owed', '52');
    expect(live.allowed).toBe(true);
    expect(live.confirmText).toContain('live_checked');
  });
  it('ready for /ship re-runs the dry-run and never ships', () => {
    const r = autoLaunch('ready for /ship', '52');
    expect(r.allowed).toBe(true);
    expect(r.confirmText).toContain('dry-run');
  });
  it('a cleared cause (red verify and the like) is allowed, naming the cause', () => {
    const r = autoLaunch('red verify', '52');
    expect(r.allowed).toBe(true);
    expect(r.confirmText).toContain('red verify');
  });
  it('a stop that needs the owner answer is refused with the terminal instruction', () => {
    for (const stop of [
      'spec questions',
      'decision needed',
      'spec or plan amendment needed',
      'critical finding',
      'plan exists unapproved, owner decides',
      'plan found the spec incomplete',
    ]) {
      const r = autoLaunch(stop, '52');
      expect(r.allowed, stop).toBe(false);
      expect(r.reason, stop).toContain('coordinator terminal');
      expect(r.reason, stop).toContain('/auto 52');
      expect(r.confirmText, stop).toBeUndefined();
    }
  });
  it('out of rounds is refused: the intent continues by hand', () => {
    const r = autoLaunch('out of rounds, open findings below', '52');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('by hand');
  });
});
