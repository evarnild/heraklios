import { describe, expect, it } from 'vitest';
import { artefactOrigins, gateShares, metadataProblems, qualityByTier } from './scan-lib.mjs';

const intent = (over = {}) => ({ id: '1', merged: null, gates: {}, ...over });

describe('metadataProblems', () => {
  it('flags a merged: that is not a hash, without asking git', () => {
    let asked = false;
    const p = metadataProblems([intent({ merged: '2026-10-20' }), intent({ id: '2', merged: '--output=x' })], () => ((asked = true), true));
    expect(p.map((x) => [x.id, x.field])).toEqual([['1', 'merged'], ['2', 'merged']]);
    expect(asked).toBe(false);
  });

  it('flags a hash git cannot resolve, and passes one it can', () => {
    expect(metadataProblems([intent({ merged: 'abc1234' })], () => false)).toHaveLength(1);
    expect(metadataProblems([intent({ merged: 'abc1234' })], () => true)).toEqual([]);
  });

  it('flags a malformed gate, naming intent and field, and accepts both recorded forms', () => {
    const gates = { intent_accepted: 'yes', spec_accepted: '2026-10-20', plan_approved: '2026-10-20 by-agent', live_checked: [] };
    const p = metadataProblems([intent({ gates })], () => true);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ id: '1', field: 'intent_accepted', value: 'yes' });
  });
});

describe('gateShares', () => {
  it('counts owner and agent per field, ignoring empty and malformed values', () => {
    const f = 'intent_accepted';
    const shares = gateShares([
      intent({ gates: { [f]: '2026-10-20' } }),
      intent({ gates: { [f]: '2026-10-20 by-agent' } }),
      intent({ gates: { [f]: [] } }),
      intent({ gates: { [f]: 'TBD' } }),
    ]);
    expect(shares[f]).toEqual({ owner: 1, agent: 1 });
    expect(shares.live_checked).toEqual({ owner: 0, agent: 0 });
  });
});

describe('artefactOrigins', () => {
  const stamps = (spec, plan) => ({ stamps: { 'intent.md': 'heraklios/intent@0.1.3', ...(spec !== undefined && { 'spec.md': spec }), ...(plan !== undefined && { 'plan.md': plan }) } });

  it('counts a /spec spec and a /build-plan plan as skill-made, any version', () => {
    const o = artefactOrigins([stamps('heraklios/spec@0.1.0', 'heraklios/build-plan@0.1.0'), stamps('heraklios/spec@0.2.0', 'heraklios/build-plan@1.0.0')]);
    expect(o['spec.md']).toEqual({ skill: 2, hand: 0, unstamped: 0 });
    expect(o['plan.md']).toEqual({ skill: 2, hand: 0, unstamped: 0 });
  });

  it('counts an old intent stamp as hand-made and no stamp as unstamped', () => {
    const o = artefactOrigins([stamps('heraklios/intent@0.1.2', 'heraklios/intent@0.1.1'), stamps(null, null)]);
    expect(o['spec.md']).toEqual({ skill: 0, hand: 1, unstamped: 1 });
    expect(o['plan.md']).toEqual({ skill: 0, hand: 1, unstamped: 1 });
  });

  it('does not count a stamp of the other skill as skill-made', () => {
    const o = artefactOrigins([stamps('heraklios/build-plan@0.1.0', 'heraklios/spec@0.1.0')]);
    expect(o['spec.md']).toEqual({ skill: 0, hand: 1, unstamped: 0 });
    expect(o['plan.md']).toEqual({ skill: 0, hand: 1, unstamped: 0 });
  });

  it('does not match a skill name that merely starts with the right one', () => {
    const o = artefactOrigins([stamps('heraklios/spec-x@0.1.0', 'heraklios/build-plan-x@0.1.0')]);
    expect(o['spec.md']).toEqual({ skill: 0, hand: 1, unstamped: 0 });
    expect(o['plan.md']).toEqual({ skill: 0, hand: 1, unstamped: 0 });
  });

  it('counts an intent without the file nowhere', () => {
    const o = artefactOrigins([stamps(undefined, 'heraklios/build-plan@0.1.0')]);
    expect(o['spec.md']).toEqual({ skill: 0, hand: 0, unstamped: 0 });
    expect(o['plan.md']).toEqual({ skill: 1, hand: 0, unstamped: 0 });
  });
});

describe('qualityByTier', () => {
  const rv = (tier, extra = {}) => ({ tier, verdict: 'attest', ...extra });
  const intents = [
    { id: 1, type: 'feature', followsUp: null, review: rv('attested') },
    { id: 2, type: 'refactor', followsUp: null, review: rv('reviewed') },
    { id: 3, type: 'fix', followsUp: null, review: rv('attested') }, // merged before the window
    { id: 4, type: 'adjustment', followsUp: null, review: rv('attested') },
    { id: 5, type: 'feature', followsUp: null, review: null }, // never reviewed
    { id: 10, type: 'fix', followsUp: '2', review: rv('attested') },
    { id: 11, type: 'fix', followsUp: '1', review: rv('attested') },
    { id: 12, type: 'fix', followsUp: '3', review: null },
    { id: 13, type: 'fix', followsUp: '99', review: null },
    { id: 14, type: 'feature', followsUp: '1', review: null },
  ];
  const outsideWindow = new Set([3]);
  const mergedInWindow = (i) => !outsideWindow.has(i.id);
  const reverts = [
    { subject: 'Revert "§4: tweak"' },
    { subject: 'Revert §2 merge' },
    { subject: 'Revert something' },
    { subject: 'Revert §3' },
    { subject: 'Revert § 1' },
  ];

  it('T7: counts changes, follow-ups and reverts per tier (numbers pinned against the pre-move inline code in sdlc-scan.mjs)', () => {
    expect(qualityByTier({ intents, reverts, mergedInWindow })).toEqual({
      attested: { changes: 4, followUps: 1, reverts: 2 },
      reviewed: { changes: 1, followUps: 1, reverts: 1 },
    });
  });
});
