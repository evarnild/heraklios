import { describe, expect, it } from 'vitest';
import { RulesPanelState } from './rulesPanelState';

describe('the Tables panel visibility (§55)', () => {
  it('opens on the default tab, then on the last tab chosen', () => {
    const s = new RulesPanelState();
    expect(s.shown).toBe(false);
    s.toggle('terrain');
    expect(s).toMatchObject({ shown: true, tab: 'terrain' });
    s.setTab('boarding');
    s.toggle('land');
    expect(s.shown).toBe(false);
    s.toggle('land');
    expect(s).toMatchObject({ shown: true, tab: 'boarding' });
  });

  it('keeps its tab through close and reopen, and a tab can be chosen while closed (§84: no suppression)', () => {
    const s = new RulesPanelState();
    s.open('terrain');
    s.setTab('ramming');
    s.close();
    s.setTab('boarding');
    expect(s).toMatchObject({ shown: false, tab: 'boarding' });
    s.open('land');
    expect(s).toMatchObject({ shown: true, tab: 'boarding' });
  });

  it('reset forgets everything', () => {
    const s = new RulesPanelState();
    s.open('land');
    s.reset();
    expect(s).toMatchObject({ shown: false, tab: null });
    s.open('terrain');
    expect(s.shown).toBe(true);
  });
});
