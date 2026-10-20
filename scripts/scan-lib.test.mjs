import { describe, expect, it } from 'vitest';
import { gateShares, metadataProblems } from './scan-lib.mjs';

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
