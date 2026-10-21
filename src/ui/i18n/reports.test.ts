import { describe, expect, it } from 'vitest';
import { messagesFor } from './index';
import type { BoardingReport, CombatReport, RamReport } from './reports';

const en = messagesFor('en');
const fr = messagesFor('fr');

const COMBAT: CombatReport = {
  attackers: [
    { unit: 'Heavy cavalry', force: 6 },
    { unit: 'Archers', force: 2 },
  ],
  defenders: [{ unit: 'Phalanxes', force: 5 }],
  attackTotal: 8,
  defenseTotal: 5,
  ratio: '3-2',
  crtColumn: '3-2',
  columnNumber: 6,
  columnCount: 9,
  columnIndex: 5,
  dieRaw: 4,
  modifier: 1,
  modifierParts: ['1 Plateau at (4, 9)', '1 river crossing'],
  dieModified: 5,
  dieUsed: null,
  result: 'DR',
  exchangeThreshold: null,
};

describe('combat report', () => {
  it('keeps the English text of the old log, line for line', () => {
    expect(en.log.combatReport({ ...COMBAT, ratio: '3:2', result: en.results.DR })).toBe(
      [
        'ATTACKERS (total 8):',
        '  Heavy cavalry (atk 6)',
        '  Archers (atk 2)',
        'DEFENDERS (total 5):',
        '  Phalanxes (def 5)',
        'Ratio: 3:2 (CRT column "3-2", column 6 of 9, array index 5)',
        'Die: 4 + 1 (1 Plateau at (4, 9) + 1 river crossing) = 5',
        'Result: DR — defender retreats',
      ].join('\n'),
    );
  });

  it('shows the used die and the exchange threshold only when they apply', () => {
    const text = en.log.combatReport({ ...COMBAT, modifier: 0, dieUsed: 6, dieModified: 7, result: 'EX', exchangeThreshold: 5 });
    expect(text).toContain('Die: 4 (used 6)');
    expect(text).toContain('Exchange threshold: attacker must sacrifice units totaling at least 5 attack');
    expect(en.log.combatReport(COMBAT)).not.toContain('Exchange threshold');
  });

  it('is written in French, with its own labels', () => {
    expect(fr.log.combatReport({ ...COMBAT, ratio: '3:2', result: fr.results.DR })).toBe(
      [
        'ATTAQUANTS (total 8) :',
        '  Heavy cavalry (att 6)',
        '  Archers (att 2)',
        'DÉFENSEURS (total 5) :',
        '  Phalanxes (déf 5)',
        'Rapport : 3:2 (colonne « 3-2 » de la table des résultats, colonne 6 sur 9, indice 5)',
        'Dé : 4 + 1 (1 Plateau at (4, 9) + 1 river crossing) = 5',
        'Résultat : DR — défenseur recule',
      ].join('\n'),
    );
  });
});

const RAM: RamReport = {
  attacker: 'Triremes',
  defender: 'Galleys',
  bonus: 2,
  unusedMovement: 1,
  successRange: '3-6',
  printedRange: '3-4',
  note: 'bonus',
  die: 5,
  hit: true,
};

describe('ram report', () => {
  it('keeps the English text of the old log', () => {
    expect(en.log.ramReport(RAM)).toBe(
      [
        'Ramming: Triremes vs Galleys, bonus +2 (1 unused movement point)',
        'Succeeds on: 3-6   (printed table row: 3-4 — bonus +2 extends the upper bound)',
        'Die: 5 -> SUNK!',
      ].join('\n'),
    );
  });

  it('pluralizes and words the three notes', () => {
    expect(en.log.ramReport({ ...RAM, unusedMovement: 3, note: 'plain', hit: false })).toContain('(3 unused movement points)');
    expect(en.log.ramReport({ ...RAM, note: 'plain', hit: false })).toContain('(printed table row: 3-4)\nDie: 5 -> missed');
    expect(en.log.ramReport({ ...RAM, note: 'everyFace' })).toContain("every roll hits");
  });

  it('is written in French, singular and plural', () => {
    expect(fr.log.ramReport(RAM)).toContain('(1 point de mouvement inutilisé)');
    expect(fr.log.ramReport({ ...RAM, unusedMovement: 2 })).toContain('(2 points de mouvement inutilisés)');
    expect(fr.log.ramReport(RAM)).toContain('Dé : 5 -> NAVIRE COULÉ !');
  });
});

const SHIP = { unit: 'Galleys', before: 3, after: 1, max: 4, forceBefore: 5, forceAfter: 2 };
const BOARDING: BoardingReport = {
  attacker: SHIP,
  defender: { ...SHIP, unit: 'Biremes', after: 0, forceAfter: 0 },
  column: '1-2',
  columnNumber: 2,
  columnCount: 7,
  columnIndex: 1,
  die: 4,
  side: 'defender',
  loss: 3,
  attackerSunk: false,
  defenderSunk: true,
};

describe('boarding report', () => {
  it('keeps the English text of the old log', () => {
    expect(en.log.boardingReport(BOARDING)).toBe(
      [
        'Boarding: Galleys (attack 5) vs Biremes (defense 5)',
        'CRT column: "1-2" (column 2 of 7, array index 1)',
        'Die: 4 -> defender loses 3 equipment',
        '  Biremes is SUNK!',
        '  Galleys (attacker): 3/4 -> 1/4 equipment (attack 5 -> 2)',
        '  Biremes (defender): 3/4 -> 0/4 equipment (defense 5 -> 0)',
      ].join('\n'),
    );
  });

  it('words a no-effect roll and the French side names', () => {
    expect(en.log.boardingReport({ ...BOARDING, side: null, defenderSunk: false })).toContain('Die: 4 -> no decisive effect');
    expect(fr.log.boardingReport(BOARDING)).toContain('Dé : 4 -> le défenseur perd 3 points d’équipage');
    expect(fr.log.boardingReport({ ...BOARDING, loss: 1 })).toContain('perd 1 point d’équipage');
    expect(fr.log.boardingReport(BOARDING)).toContain('Colonne de la table des résultats : « 1-2 »');
    expect(fr.log.boardingReport(BOARDING)).toContain('  L’unité Biremes est COULÉE !');
    expect(fr.log.boardingReport(BOARDING)).toContain('3/4 -> 1/4 d’équipage');
    expect(fr.log.boardingReport({ ...BOARDING, side: 'attacker' })).toContain('l’attaquant perd');
  });
});

describe('status line', () => {
  it('keeps the English wording and words the final round in French', () => {
    expect(en.board.status(3, 'Athens (W, yellow)', 'movement', false)).toBe('Turn 3 — Athens (W, yellow) — MOVEMENT phase');
    expect(en.board.status(3, 'Athens (W, yellow)', 'movement', true)).toBe(
      'Turn 3 — Athens (W, yellow) — MOVEMENT phase — FINAL ROUND',
    );
    expect(fr.board.status(3, 'Athènes (O, jaune)', 'combat', true)).toBe(
      'Tour 3 — Athènes (O, jaune) — phase de COMBAT — DERNIÈRE MANCHE',
    );
  });

  it('words the one-or-many push choice', () => {
    expect(en.log.nowhereToRetreat('Archers', 1)).toBe(
      'Archers has nowhere to retreat — one neighboring friendly unit can make room. Click one to push it.',
    );
    expect(en.log.nowhereToRetreat('Archers', 3)).toContain('3 neighboring friendly units can make room');
    expect(fr.log.nowhereToRetreat('Archers', 3)).toContain('3 unités amies voisines peuvent faire de la place');
  });
});
