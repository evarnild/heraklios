// The values behind the Board's multi-line reports (a land combat, a ram, a
// boarding). The scene gathers them from the engine's results; each language's
// table writes the report around them.

export interface ForceLine {
  unit: string;
  force: number;
}

export interface CombatReport {
  attackers: ForceLine[];
  defenders: ForceLine[];
  attackTotal: number;
  defenseTotal: number;
  /** The ratio as played, e.g. "3:1". */
  ratio: string;
  /** The printed CRT column, e.g. "3-1", with its place in the table. */
  crtColumn: string;
  columnNumber: number;
  columnCount: number;
  columnIndex: number;
  dieRaw: number;
  /** Total die modifier; 0 means none (no parts shown). */
  modifier: number;
  /** What made the modifier, each already worded (terrain, river). */
  modifierParts: string[];
  dieModified: number;
  /** The die as used when it was clamped to 1-6, else null. */
  dieUsed: number | null;
  /** AE / AR / DE / DR / EX, or whatever the engine returned. */
  result: string;
  /** The attack force an exchange must sacrifice, only while that choice is pending. */
  exchangeThreshold: number | null;
}

export interface RamReport {
  attacker: string;
  defender: string;
  bonus: number;
  unusedMovement: number;
  /** The die faces that sink the target, e.g. "2-6". */
  successRange: string;
  /** The printed table row, e.g. "2-4". */
  printedRange: string;
  /** How the bonus changed the printed row: not at all, extended it, or made every face hit. */
  note: 'plain' | 'bonus' | 'everyFace';
  die: number;
  hit: boolean;
}

export interface EquipmentChange {
  unit: string;
  before: number;
  after: number;
  max: number;
  /** Attack (attacker) or defense (defender) strength before and after the loss. */
  forceBefore: number;
  forceAfter: number;
}

export interface BoardingReport {
  attacker: EquipmentChange;
  defender: EquipmentChange;
  /** The printed CRT column and its place in the table. */
  column: string;
  columnNumber: number;
  columnCount: number;
  columnIndex: number;
  die: number;
  /** Who lost equipment, or null for no decisive effect. */
  side: 'attacker' | 'defender' | null;
  loss: number;
  attackerSunk: boolean;
  defenderSunk: boolean;
}
