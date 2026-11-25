import type { HexCoord } from '../data/map';
import type { LandAttackDetail, LandCombatOutcome } from '../engine/combat';
import { SILENT_PAUSE_KINDS, type DriftEvent } from '../engine/drift';
import { facingForDirection } from '../engine/hex';
import type { Unit } from '../engine/state';
import { messages, type Messages } from './i18n';
import { formatDriftEvent, unitNameIn } from './i18n/format';

/**
 * What the Board shows for one `DriftEvent` of an elephant's drift (§73), as
 * plain data: the log lines, the arrow, the cue, whether to draw now, and
 * whether the beat waits for "Continue". These are the pacing rules
 * `resolveElephantDrift`'s hooks held (`onDriftStart`, `onDirectionRolled`,
 * `onDriftMoved`, `onNarrate`, `onRender`, `onCombat`, `onStep`); the scene
 * applies each beat in the order its fields are listed here, and draws the live
 * state, which at a pause really is at that step.
 */
export type ArrowChange =
  /** A drift (or a trampled elephant's own) starts: no direction rolled yet, so no arrow. */
  | { kind: 'reset'; elephant: Unit }
  /** A direction is known (rolled, or resumed after a nested drift): point the arrow. */
  | { kind: 'point'; elephant: Unit; facing: number }
  /** The elephant moved: the arrow follows it, keeping its facing. */
  | { kind: 'follow'; elephant: Unit };

export interface DriftBeat {
  /** Log lines to append to the drift's entry, in order. */
  lines: string[];
  arrow: ArrowChange | null;
  /** The elephant entered `hex`: the next render slides it there (§66). */
  move: { elephantId: string; hex: HexCoord } | null;
  /** A trample at `hex`: draws now, so the clash plays before whatever the next beat changes (§66). */
  clash: { elephantId: string; hex: HexCoord } | null;
  /** Draw the live state now (a clash draws itself). */
  render: boolean;
  /** Wait for Continue after this beat. */
  pause: boolean;
}

export interface BeatContext {
  /** The combat report line of a trample's fight (the scene words it with its own report). */
  formatCombat(elephant: Unit, occupant: Unit, detail: LandAttackDetail, outcome: LandCombatOutcome): string;
  m?: Messages;
}

function silent(): DriftBeat {
  return { lines: [], arrow: null, move: null, clash: null, render: false, pause: false };
}

/** The beat of one drift event. A kind that only asks for an input (or refuses a direction) is silent. */
export function driftBeat(event: DriftEvent, ctx: BeatContext): DriftBeat {
  if (SILENT_PAUSE_KINDS.has(event.kind)) return silent();
  const m = ctx.m ?? messages();
  const narrated = formatDriftEvent(event, m);
  const beat: DriftBeat = { ...silent(), lines: narrated ? [narrated] : [], pause: true };
  switch (event.kind) {
    case 'driftStarted':
      return { ...beat, arrow: { kind: 'reset', elephant: event.elephant } };
    case 'directionRolled':
    case 'directionResumed':
      return { ...beat, arrow: { kind: 'point', elephant: event.elephant, facing: facingForDirection(event.direction) }, render: true };
    case 'moved':
    case 'enteredVacatedHex':
      return {
        ...beat,
        arrow: { kind: 'follow', elephant: event.elephant },
        move: { elephantId: event.elephant.id, hex: event.hex },
        render: true,
      };
    case 'eliminatedLeavingLandZone':
    case 'driftElephantDestroyed':
      return { ...beat, render: true };
    case 'combatResolved':
      return {
        ...beat,
        clash: { elephantId: event.elephant.id, hex: event.hex },
        lines: [
          m.log.tramples(unitNameIn(m, event.elephant.typeId), unitNameIn(m, event.occupant.typeId), event.hex.q, event.hex.r),
          ctx.formatCombat(event.elephant, event.occupant, event.detail, event.outcome),
        ],
      };
    default:
      return beat; // stopped, repelled: a line and a pause
  }
}
