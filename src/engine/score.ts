import type { GameState, PlayerId } from './state';
import { armyValue, livingUnits, unitType } from './state';

/**
 * The score at the final count, and what the Board's score panel shows live.
 *
 * Rulebook: `05-rules-french-original.md:480-482` (each player still holding
 * units adds up their purchase values; the highest wins) and `:487-489` ("Le
 * joueur dont les vaisseaux restent seuls en mer obtient, lors du compte
 * final, une bonification de 30 points ... qu'il additionnera à d'éventuelles
 * unités présentes sur le terrain"). `02-rules-transcription.md:301-305`
 * reads it as "all other players' fleets sunk or absent".
 *
 * Interpretations (§81 spec):
 * - I1: "seuls en mer" = the only player with at least one ship not destroyed,
 *   wherever it is. Land units can never enter sea-like terrain and nothing
 *   carries troops, so ships are the only units at sea. A galley on a coast
 *   or river-wide hex still counts: the test is the unit's domain, never the
 *   hex, so a galley cannot drop out by rowing up a river.
 * - I2: fleets that were never bought count as absent, so an opponent with
 *   no ships never blocks the bonus. This keeps the score a function of the
 *   current state alone.
 * - I3: shown live, it is what the final count would be if the game ended now.
 * - I4: the 30 is added to the army value, whatever that is (ships only too).
 * - I5: the elimination ending's sole survivor wins whatever the scores; the
 *   bonus then only changes the figure Game Over shows.
 *
 * `armyValue` keeps its meaning (full printed cost of every unit not
 * destroyed, so a damaged ship counts in full) and excludes the bonus.
 */
export const NAVAL_BONUS_POINTS = 30;

/** The player holding the naval bonus, or null (no ships, or ships in two or more armies). */
export function navalBonusPlayer(state: GameState): PlayerId | null {
  let holder: PlayerId | null = null;
  for (const u of state.units) {
    if (u.destroyed || unitType(u).domain !== 'naval') continue;
    if (holder !== null && holder !== u.owner) return null;
    holder = u.owner;
  }
  return holder;
}

export interface PlayerScore {
  playerId: PlayerId;
  armyValue: number;
  navalBonus: number;
  score: number;
  unitsLeft: number;
}

/** One entry per `state.players` entry, in that order (eliminated players stay, at 0). */
export function playerScores(state: GameState): PlayerScore[] {
  const bonusId = navalBonusPlayer(state);
  return state.players.map((p) => {
    const value = armyValue(state, p.id);
    const navalBonus = bonusId === p.id ? NAVAL_BONUS_POINTS : 0;
    return {
      playerId: p.id,
      armyValue: value,
      navalBonus,
      score: value + navalBonus,
      unitsLeft: livingUnits(state, p.id).length,
    };
  });
}
