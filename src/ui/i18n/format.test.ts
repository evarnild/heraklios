import { describe, expect, it } from 'vitest';
import type { ArmyError } from '../../engine/army';
import type { DriftEvent } from '../../engine/drift';
import { buildSavedGame } from '../../engine/saveGame';
import { createInitialState } from '../../engine/turnManager';
import type { Player, PlayerId, Unit } from '../../engine/state';
import type { LandAttackPreview } from '../../engine/combat';
import { clockLimitText, describeSlot, dieModifierParts, formatAttackLine, formatArmyError, formatDriftEvent, formatSaveError, roundLimitText } from './format';
import { messagesFor, type Language } from './index';

const LANGS: Language[] = ['en', 'fr'];

describe('formatArmyError', () => {
  const cases: { error: ArmyError; en: string; fr: string }[] = [
    {
      error: { kind: 'overMax', typeId: 'phalanges', count: 6, max: 5 },
      en: 'Phalanxes: 6 exceeds the maximum of 5',
      fr: 'Phalanges : 6 dépasse le maximum de 5',
    },
    {
      error: { kind: 'overBudget', total: 405, budget: 400 },
      en: 'Total cost 405 exceeds the 400-point budget',
      fr: 'Le coût total de 405 dépasse le budget de 400 points',
    },
    {
      error: { kind: 'underBudget', total: 75, budget: 400 },
      en: 'Total cost 75 is under the 400-point budget — spend all 400 points to confirm',
      fr: 'Le coût total de 75 est sous le budget de 400 points — dépensez les 400 points pour valider',
    },
  ];
  it.each(cases)('words $error.kind in both languages', ({ error, en, fr }) => {
    expect(formatArmyError(error, messagesFor('en'))).toBe(en);
    expect(formatArmyError(error, messagesFor('fr'))).toBe(fr);
  });
});

function elephant(): Unit {
  return {
    id: 'e1',
    owner: 0 as PlayerId,
    typeId: 'elephants',
    position: { q: 5, r: 5 },
    movementLeft: 0,
    facing: 0,
    equipmentPoints: undefined,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
  };
}

describe('formatDriftEvent', () => {
  const e = elephant();
  // (7,15) is marsh on the shipped map (see drift.test.ts); (9999,9999) is not on it.
  const cases: { event: DriftEvent; en: string; fr: string }[] = [
    {
      event: { kind: 'driftStarted', elephant: e, remainingSteps: 3 },
      en: 'Elephants is forced to retreat - instead it drifts!',
      fr: 'L’unité Éléphants doit reculer — elle dérive à la place !',
    },
    {
      event: { kind: 'directionRolled', elephant: e, dieRoll: 4, direction: { q: 1, r: 0 }, remainingSteps: 2 },
      en: 'Direction die: 4 - 2 hex(es) of movement to go.',
      fr: 'Dé de direction : 4 — 2 hexagone(s) de déplacement restant(s).',
    },
    {
      event: { kind: 'moved', elephant: e, hex: { q: 6, r: 15 } },
      en: 'Elephants moves to (6, 15).',
      fr: 'L’unité Éléphants se déplace en (6, 15).',
    },
    {
      event: { kind: 'stopped', elephant: e },
      en: 'Elephants has used up its movement and stops drifting.',
      fr: 'L’unité Éléphants a épuisé son déplacement et cesse de dériver.',
    },
    {
      event: { kind: 'eliminatedLeavingLandZone', elephant: e, hex: { q: 7, r: 15 } },
      en: 'Elephants drifts into the marsh and is eliminated!',
      fr: 'L’unité Éléphants dérive dans les marais et est éliminée !',
    },
    {
      event: { kind: 'eliminatedLeavingLandZone', elephant: e, hex: { q: 9999, r: 9999 } },
      en: 'Elephants drifts off the map and is eliminated!',
      fr: 'L’unité Éléphants dérive hors de la carte et est éliminée !',
    },
    {
      event: { kind: 'driftElephantDestroyed', elephant: e },
      en: 'Elephants is destroyed.',
      fr: 'L’unité Éléphants est détruite.',
    },
    {
      event: { kind: 'repelled', elephant: e },
      en: 'Elephants is repelled and must drift again!',
      fr: 'L’unité Éléphants est repoussée et doit dériver à nouveau !',
    },
  ];
  it.each(cases.map((c, i) => ({ ...c, name: `${i} ${c.event.kind}` })))('narrates $name', ({ event, en, fr }) => {
    expect(formatDriftEvent(event, messagesFor('en'))).toBe(en);
    expect(formatDriftEvent(event, messagesFor('fr'))).toBe(fr);
  });

  it('words the sea exit', () => {
    // (23,3) is a sea hex on the shipped map (see drift.test.ts's off-map-or-sea case).
    const event: DriftEvent = { kind: 'eliminatedLeavingLandZone', elephant: e, hex: { q: 23, r: 3 } };
    expect(formatDriftEvent(event, messagesFor('en'))).toBe('Elephants drifts into the sea and is eliminated!');
    expect(formatDriftEvent(event, messagesFor('fr'))).toBe('L’unité Éléphants dérive dans la mer et est éliminée !');
  });

  it('agrees with a feminine unit and a plural one alike, because the sentence is about "l’unité"', () => {
    const feminine = { ...e, typeId: 'cavalerie-legere' };
    const plural = { ...e, typeId: 'chars-lourds' };
    const fr = messagesFor('fr');
    expect(formatDriftEvent({ kind: 'repelled', elephant: feminine }, fr)).toBe('L’unité Cavalerie Légère est repoussée et doit dériver à nouveau !');
    expect(formatDriftEvent({ kind: 'driftElephantDestroyed', elephant: plural }, fr)).toBe('L’unité Chars Lourds est détruite.');
  });

  it('narrates nothing for the beats that were never logged', () => {
    expect(formatDriftEvent({ kind: 'directionResumed', elephant: e, direction: { q: 1, r: 0 } }, messagesFor('en'))).toBeNull();
    expect(formatDriftEvent({ kind: 'enteredVacatedHex', elephant: e, hex: { q: 1, r: 1 } }, messagesFor('en'))).toBeNull();
  });
});

function sampleSave(activeIndex = 0) {
  const players: Player[] = [
    { id: 0 as PlayerId, name: 'Athens', edge: 'W', purchasePoints: 400, eliminated: false },
    { id: 1 as PlayerId, name: 'Persia', edge: 'E', purchasePoints: 400, eliminated: false },
  ];
  const gameState = createInitialState(players, 'multi-defender');
  gameState.turnNumber = 3;
  gameState.phase = 'movement';
  gameState.activePlayerIndex = activeIndex;
  return buildSavedGame({
    savedAt: '2026-07-25T12:34:56.000Z',
    playerCount: 2,
    playerNames: ['Athens', 'Persia'],
    edges: ['W', 'E'],
    armySelections: [],
    combatMode: 'multi-defender',
    seatControls: ['human', 'human'],
    testMode: false,
    gameState,
    attackedThisPhase: [],
    rammedThisTurn: [],
  });
}

describe('describeSlot', () => {
  it('names the turn, the saved active player and the phase, in each language', () => {
    expect(describeSlot(sampleSave(), messagesFor('en'))).toBe('Turn 3 — Athens (movement)');
    expect(describeSlot(sampleSave(), messagesFor('fr'))).toBe('Tour 3 — Athens (mouvement)');
  });

  it('follows seat order rather than assuming player 0 is active', () => {
    for (const lang of LANGS) {
      expect(describeSlot(sampleSave(1), messagesFor(lang))).toContain('Persia');
    }
  });
});

describe('formatSaveError', () => {
  it('words each error in both languages', () => {
    expect(formatSaveError({ kind: 'invalidJson' }, messagesFor('en'))).toBe("That file isn't valid JSON.");
    expect(formatSaveError({ kind: 'invalidJson' }, messagesFor('fr'))).toBe('Ce fichier n’est pas du JSON valide.');
    expect(formatSaveError({ kind: 'notASave' }, messagesFor('en'))).toBe("That file isn't a Héraklios save.");
    expect(formatSaveError({ kind: 'unreadable' }, messagesFor('fr'))).toBe('Ce fichier n’a pas pu être lu.');
    expect(formatSaveError({ kind: 'unsupportedVersion', version: 99, expected: 3 }, messagesFor('en'))).toBe(
      "Save file version 99 isn't supported (expected 3).",
    );
    expect(formatSaveError({ kind: 'unsupportedVersion', version: 99, expected: 3 }, messagesFor('fr'))).toContain('99');
  });
});

describe('clockLimitText and roundLimitText', () => {
  it('label every preset in both languages', () => {
    const en = messagesFor('en');
    const fr = messagesFor('fr');
    expect(clockLimitText(null, en)).toBe('Off');
    expect(clockLimitText(null, fr)).toBe('Aucune');
    expect(clockLimitText(30 * 60_000, en)).toBe('30 min');
    expect(clockLimitText(60 * 60_000, fr)).toBe('1 h');
    expect(clockLimitText(120 * 60_000, en)).toBe('2 h');
    expect(roundLimitText(null, en)).toBe('Off');
    expect(roundLimitText(6, en)).toBe('6 rounds');
    expect(roundLimitText(12, fr)).toBe('12 manches');
  });
});

describe('formatAttackLine (§53)', () => {
  const base: LandAttackPreview = {
    attackForce: 12,
    attackerForces: new Map(),
    defenseForce: 6,
    terrainModifier: 0,
    terrainOnlyModifier: 0,
    terrainModifierSource: null,
    terrainModifierSourceHex: null,
    riverCrossingApplied: false,
  };
  const hill = { ...base, terrainModifier: 2, terrainOnlyModifier: 2, terrainModifierSource: 'plateau' as const, terrainModifierSourceHex: { q: 4, r: 9 } };
  const river = { ...base, terrainModifier: 1, riverCrossingApplied: true };
  const both = { ...hill, terrainModifier: 3, riverCrossingApplied: true };
  const en = messagesFor('en');
  const fr = messagesFor('fr');
  const A = ['Archers', 'Hoplites'];
  const T = ['Peltasts'];

  it('attackers and targets with both forces, no modifier', () => {
    expect(formatAttackLine(A, T, base, en)).toBe('Attack: Archers, Hoplites (12) → Peltasts (6)');
    expect(formatAttackLine(A, T, base, fr)).toBe('Attaque : Archers, Hoplites (12) → Peltasts (6)');
  });

  it('adds the die modifier and its parts: terrain only, river only, both', () => {
    expect(formatAttackLine(A, T, hill, en)).toBe(
      'Attack: Archers, Hoplites (12) → Peltasts (6), die +2 (2 Plateau at (4, 9))'.replace('Plateau', en.terrain.plateau),
    );
    expect(formatAttackLine(A, T, river, en)).toBe('Attack: Archers, Hoplites (12) → Peltasts (6), die +1 (1 river crossing)');
    expect(formatAttackLine(A, T, both, en)).toBe(
      `Attack: Archers, Hoplites (12) → Peltasts (6), die +3 (2 ${en.terrain.plateau} at (4, 9) + 1 river crossing)`,
    );
    expect(formatAttackLine(A, T, river, fr)).toBe('Attaque : Archers, Hoplites (12) → Peltasts (6), dé +1 (1 traversée de rivière)');
    expect(formatAttackLine(A, T, hill, fr)).toBe(
      `Attaque : Archers, Hoplites (12) → Peltasts (6), dé +2 (2 ${fr.terrain.plateau} en (4, 9))`,
    );
  });

  it('attackers alone ask for a target, with no number', () => {
    expect(formatAttackLine(A, [], null, en)).toBe('Attack: Archers, Hoplites, choose a target.');
    expect(formatAttackLine(['Trireme'], [], null, fr)).toBe('Attaque : Trireme, choisissez une cible.');
  });

  it('an empty attacker group is cleared', () => {
    expect(formatAttackLine([], [], null, en)).toBe('Attack cleared.');
    expect(formatAttackLine([], [], null, fr)).toBe('Attaque annulée.');
  });

  it('dieModifierParts is empty when nothing modifies the die', () => {
    expect(dieModifierParts(base, en)).toEqual([]);
  });

  it('autosave line in both languages', () => {
    expect(en.saves.autosaved).toBe('Autosaved.');
    expect(fr.saves.autosaved).toBe('Sauvegarde automatique effectuée.');
  });
});
