import type { UnitActivity } from '../engine/unitStatus';

/**
 * §82 B7: what each phase marker looks like, as one pure table the live
 * check tunes. Shape plus colour (never colour alone): a solid dot, a half
 * filled dot or an empty ring, and for combat a glyph inside the dot.
 */
export type DotShape = 'solid' | 'half' | 'ring';
export type DotGlyph = 'sword' | 'tick' | 'cross';

export interface DotSpec {
  shape: DotShape;
  fill: number;
  glyph?: DotGlyph;
}

/** Dot radius (about 8 px across at zoom 1) and where the marks sit on a counter: opposite top corners. */
export const MARK = {
  radius: 4,
  outline: 0x15100a,
  glyphColor: 0xffffff,
  chargeColor: 0xffe04a,
  activity: { x: -11, y: -11 },
  charge: { x: 11, y: -11 },
} as const;

const GREEN = 0x3fcf5a;
const AMBER = 0xf0a020;
const GREY = 0x9a9a9a;
const RED = 0xe03030;

const DOTS: Record<UnitActivity, DotSpec> = {
  notMoved: { shape: 'solid', fill: GREEN },
  partlyMoved: { shape: 'half', fill: AMBER },
  done: { shape: 'ring', fill: GREY },
  canAttack: { shape: 'solid', fill: GREEN, glyph: 'sword' },
  hasAttacked: { shape: 'solid', fill: GREY, glyph: 'tick' },
  beenAttacked: { shape: 'solid', fill: RED, glyph: 'cross' },
};

export interface MarkSpec {
  dot: DotSpec | null;
  charge: boolean;
}

/** The shapes to draw for one unit's status and charge flag; nothing drawn is `{ dot: null, charge: false }`. */
export function markSpec(status: UnitActivity | undefined, charged: boolean): MarkSpec {
  return { dot: status ? DOTS[status] : null, charge: charged };
}
