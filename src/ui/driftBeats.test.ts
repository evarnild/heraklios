import { describe, expect, it } from 'vitest';
import type { DriftEvent } from '../engine/drift';
import { DIRECTIONS, facingForDirection } from '../engine/hex';
import type { Unit } from '../engine/state';
import { driftBeat } from './driftBeats';
import { messagesFor } from './i18n';

const m = messagesFor('en');
const elephant: Unit = {
  id: 'e',
  owner: 1,
  typeId: 'elephants',
  position: { q: 10, r: 4 },
  movementLeft: 0,
  facing: 0,
  defendedThisPhase: false,
  charged: false,
  destroyed: false,
};
const occupant: Unit = { ...elephant, id: 'o', owner: 0, typeId: 'fantassins-lourds', position: { q: 10, r: 2 } };
const ctx = { m, formatCombat: () => 'THE FIGHT' };
const hex = { q: 10, r: 3 };

describe('driftBeat', () => {
  // Kills a silent kind that pauses: Continue would do nothing (§57).
  it.each<DriftEvent>([
    { kind: 'directionRollNeeded', elephant, remainingSteps: 4 },
    { kind: 'combatRollNeeded', elephant, occupant, hex },
    { kind: 'retreatResolutionNeeded', unit: occupant },
    { kind: 'directionForbidden', elephant, dieRoll: 3, direction: DIRECTIONS[2]! },
  ])('$kind shows nothing and does not pause', (event) => {
    expect(driftBeat(event, ctx)).toEqual({ lines: [], arrow: null, move: null, clash: null, render: false, pause: false });
  });

  // Kills a moved beat that skips its pause (the regression at drift.test.ts:783).
  it('every moved beat pauses, with its line, the cue, the arrow following and a render', () => {
    const beat = driftBeat({ kind: 'moved', elephant, hex }, ctx);
    expect(beat).toEqual({
      lines: [m.drift.moved('Elephants', 10, 3)],
      arrow: { kind: 'follow', elephant },
      move: { elephantId: 'e', hex },
      clash: null,
      render: true,
      pause: true,
    });
  });

  it('entering a vacated hex moves and renders, with no line', () => {
    const beat = driftBeat({ kind: 'enteredVacatedHex', elephant, hex }, ctx);
    expect(beat).toMatchObject({ lines: [], move: { elephantId: 'e', hex }, render: true, pause: true });
  });

  // Kills an arrow that survives into the next leg: it must be dropped at a start.
  it('a drift starting resets the arrow (no direction yet) and says so', () => {
    const beat = driftBeat({ kind: 'driftStarted', elephant, remainingSteps: 4 }, ctx);
    expect(beat.arrow).toEqual({ kind: 'reset', elephant });
    expect(beat.lines).toEqual([m.drift.started('Elephants')]);
    expect(beat.pause).toBe(true);
    expect(beat.render).toBe(false);
  });

  it('a rolled direction points the arrow, writes its line and renders', () => {
    const direction = DIRECTIONS[2]!;
    const beat = driftBeat({ kind: 'directionRolled', elephant, dieRoll: 3, direction, remainingSteps: 4 }, ctx);
    expect(beat.arrow).toEqual({ kind: 'point', elephant, facing: facingForDirection(direction) });
    expect(beat.lines).toEqual([m.drift.directionRolled(3, 4)]);
    expect(beat).toMatchObject({ render: true, pause: true });
  });

  // Kills a resumed direction that writes a line: nothing happened worth logging.
  it('a resumed direction updates the arrow with no line, and still pauses', () => {
    const direction = DIRECTIONS[2]!;
    const beat = driftBeat({ kind: 'directionResumed', elephant, direction }, ctx);
    expect(beat.arrow).toEqual({ kind: 'point', elephant, facing: 2 });
    expect(beat.lines).toEqual([]);
    expect(beat).toMatchObject({ render: true, pause: true });
  });

  // Kills a trample without its clash cue, or with one line instead of two.
  it('a trample is a clash and two lines, and pauses', () => {
    const beat = driftBeat({ kind: 'combatResolved', detail: {} as never, outcome: {} as never, elephant, occupant, hex }, ctx);
    expect(beat.clash).toEqual({ elephantId: 'e', hex });
    expect(beat.lines).toEqual([m.log.tramples('Elephants', 'Heavy infantry', 10, 3), 'THE FIGHT']);
    expect(beat).toMatchObject({ pause: true, render: false, arrow: null, move: null });
  });

  // Kills a destroyed elephant left on screen while paused (drift.ts's stale-frame note).
  it('a destroyed elephant and an elimination render', () => {
    expect(driftBeat({ kind: 'driftElephantDestroyed', elephant }, ctx)).toMatchObject({ render: true, pause: true });
    expect(driftBeat({ kind: 'eliminatedLeavingLandZone', elephant, hex }, ctx)).toMatchObject({ render: true, pause: true });
  });

  it('stopped and repelled are a line and a pause', () => {
    expect(driftBeat({ kind: 'stopped', elephant }, ctx)).toEqual({
      lines: [m.drift.stopped('Elephants')],
      arrow: null,
      move: null,
      clash: null,
      render: false,
      pause: true,
    });
    expect(driftBeat({ kind: 'repelled', elephant }, ctx)).toMatchObject({ lines: [m.drift.repelled('Elephants')], pause: true });
  });
});
