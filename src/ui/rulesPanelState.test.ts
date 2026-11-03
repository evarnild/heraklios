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

  it('is hidden while suppressed and comes back open on the same tab', () => {
    const s = new RulesPanelState();
    s.open('terrain');
    s.setTab('ramming');
    s.setSuppressed(true);
    expect(s.shown).toBe(false);
    s.setSuppressed(false);
    expect(s).toMatchObject({ shown: true, tab: 'ramming' });
  });

  it('stays closed when it was closed before the suppression', () => {
    const s = new RulesPanelState();
    s.setSuppressed(true);
    s.setSuppressed(false);
    expect(s.shown).toBe(false);
  });

  it('ignores open, toggle, close and tab changes while suppressed', () => {
    const s = new RulesPanelState();
    s.setSuppressed(true);
    s.toggle('terrain');
    s.open('terrain');
    expect(s.shown).toBe(false);
    s.setSuppressed(false);
    expect(s.shown).toBe(false);
    s.open('land');
    s.setSuppressed(true);
    s.close();
    s.setTab('boarding');
    s.setSuppressed(false);
    expect(s).toMatchObject({ shown: true, tab: 'land' });
  });

  it('reset forgets everything, suppression included', () => {
    const s = new RulesPanelState();
    s.open('land');
    s.setSuppressed(true);
    s.reset();
    expect(s).toMatchObject({ shown: false, tab: null });
    s.open('terrain');
    expect(s.shown).toBe(true);
  });
});
