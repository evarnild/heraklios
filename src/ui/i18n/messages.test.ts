import { describe, expect, it } from 'vitest';
import { messagesFor, type Language } from './index';
import type { BoardingReport, CombatReport, RamReport } from './reports';

const COMBAT: CombatReport = {
  attackers: [{ unit: 'Alpha', force: 4 }],
  defenders: [{ unit: 'Beta', force: 3 }],
  attackTotal: 4,
  defenseTotal: 3,
  ratio: '1:1',
  crtColumn: '1-1',
  columnNumber: 5,
  columnCount: 9,
  columnIndex: 4,
  dieRaw: 3,
  modifier: 1,
  modifierParts: ['1 Alpha'],
  dieModified: 4,
  dieUsed: 4,
  result: 'EX',
  exchangeThreshold: 3,
};
const RAM: RamReport = {
  attacker: 'Alpha',
  defender: 'Beta',
  bonus: 1,
  unusedMovement: 2,
  successRange: '2-6',
  printedRange: '2-5',
  note: 'bonus',
  die: 3,
  hit: true,
};
const SHIP = { unit: 'Alpha', before: 3, after: 0, max: 4, forceBefore: 5, forceAfter: 0 };
const BOARDING: BoardingReport = {
  attacker: SHIP,
  defender: { ...SHIP, unit: 'Beta' },
  column: '1-1',
  columnNumber: 2,
  columnCount: 7,
  columnIndex: 1,
  die: 4,
  side: 'defender',
  loss: 2,
  attackerSunk: true,
  defenderSunk: true,
};

/** Functions that take a report object rather than plain values. */
const REPORT_SAMPLES: Record<string, unknown> = {
  'log.combatReport': COMBAT,
  'log.ramReport': RAM,
  'log.boardingReport': BOARDING,
};

/** Functions whose values are lists of names. */
const LIST_PARAMS = new Set(['gameOver.draw', 'log.removedFromCombat', 'log.exchangeSacrificed']);

/** Messages that are legitimately the same in both languages. */
const SAME_IN_BOTH = new Set([
  'languageNames.en',
  'languageNames.fr',
  'units.archers',
  'phases.combat',
  'edges.E',
  'edges.N',
  'edges.S',
  'menu.minutes',
  'menu.hours',
  'board.seat',
  'board.scoreHeader',
  'board.scorePoints',
  'board.seatWithControl',
  'tooltip.owner',
  'board.tables',
  'rules.terrainHeaders.terrain',
  'rules.modifierFlat',
  'rules.nobody',
]);

/** Every leaf message of a table, functions called with sample values. */
function flatten(value: unknown, path: string, out: Map<string, string>): void {
  if (typeof value === 'string') {
    out.set(path, value);
  } else if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => string;
    const report = REPORT_SAMPLES[path];
    out.set(path, report ? fn(report) : fn(...Array.from({ length: fn.length }, () => (LIST_PARAMS.has(path) ? ['Alpha', 'Beta'] : 'Alpha'))));
  } else if (Array.isArray(value)) {
    value.forEach((child, i) => flatten(child, `${path}.${i}`, out));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flatten(child, path ? `${path}.${key}` : key, out);
  }
}

function table(lang: Language): Map<string, string> {
  const out = new Map<string, string>();
  flatten(messagesFor(lang), '', out);
  return out;
}

describe('list wording', () => {
  it('says none when an exchange sacrifices nothing', () => {
    expect(messagesFor('en').log.exchangeSacrificed([])).toBe('Exchange: defender(s) destroyed; sacrificed none.');
    expect(messagesFor('fr').log.exchangeSacrificed([])).toBe('Échange : défenseur(s) détruit(s) ; sacrifié(s) : aucun.');
  });

  it('joins a draw between three or more players', () => {
    expect(messagesFor('en').gameOver.draw(['A', 'B', 'C'])).toBe('Draw between A, B and C!');
    expect(messagesFor('fr').gameOver.draw(['A', 'B', 'C', 'D'])).toBe('Égalité entre A, B, C et D !');
  });
});

describe('End-phase warning text (§83)', () => {
  it('counts the unmoved units in both languages', () => {
    expect(messagesFor('en').board.unmovedCount(1)).toBe('1 unit has not moved yet.');
    expect(messagesFor('en').board.unmovedCount(3)).toBe('3 units have not moved yet.');
    expect(messagesFor('fr').board.unmovedCount(1)).toBe('1 unité n’a pas encore bougé.');
    expect(messagesFor('fr').board.unmovedCount(3)).toBe('3 unités n’ont pas encore bougé.');
  });

  it('draws the switch-off box ticked and unticked', () => {
    expect(messagesFor('en').board.warnOff(true)).toBe("☒ Don't warn me again this game");
    expect(messagesFor('en').board.warnOff(false)).toBe("☐ Don't warn me again this game");
    expect(messagesFor('fr').board.warnOff(true)).toBe('☒ Ne plus m’avertir pendant cette partie');
  });

  it('words the pending-choice refusals as a choice, not a retreat or drift', () => {
    for (const lang of ['en', 'fr'] as Language[]) {
      const log = messagesFor(lang).log;
      for (const text of [log.resolvePendingSave, log.resolvePendingEnd, log.resolvePendingUndo, log.resolvePendingRedo, log.resolvePendingAttack, log.resolvePendingPhase]) {
        expect(text).toMatch(lang === 'en' ? /choice/ : /choix/);
        expect(text).not.toMatch(/retreat|drift|retraite|dérive/);
      }
    }
  });
});

describe('message tables', () => {
  it('have the same messages in both languages', () => {
    expect([...table('fr').keys()]).toEqual([...table('en').keys()]);
  });

  it.each(['en', 'fr'] as Language[])('have no empty message in %s', (lang) => {
    for (const [path, text] of table(lang)) expect(text.trim(), `${lang} ${path}`).not.toBe('');
  });

  it('translate every message except the listed ones', () => {
    const en = table('en');
    const fr = table('fr');
    const untranslated = [...en].filter(([path, text]) => !SAME_IN_BOTH.has(path) && fr.get(path) === text).map(([path]) => path);
    expect(untranslated).toEqual([]);
  });
});
