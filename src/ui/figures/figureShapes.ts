import type { UnitType } from '../../data/units';

/**
 * The Drawn view's unit figures as plain data, in unit-local coordinates
 * within a radius of 1 (x to the right, y down). Land figures stand upright;
 * a galley's bow points along +x, so rotating by `facingAngleRad` aims it.
 * The view only draws what is returned here.
 *
 * `tone` picks the colour: `body` is the owner's colour, `dark` the ink
 * outline colour and `light` a pale steel/wood.
 */
export type Tone = 'body' | 'dark' | 'light';

export type Primitive =
  | { kind: 'polygon'; tone: Tone; points: readonly (readonly [number, number])[] }
  | { kind: 'circle'; tone: Tone; x: number; y: number; r: number }
  | { kind: 'line'; tone: Tone; x1: number; y1: number; x2: number; y2: number; width: number };

export interface Figure {
  primitives: readonly Primitive[];
  /** Rows of oars on each side of a galley (1, 2, 3 or 5); absent for land units. */
  oarBanks?: number;
}

type Pt = readonly [number, number];

const poly = (tone: Tone, ...points: Pt[]): Primitive => ({ kind: 'polygon', tone, points });
const circ = (tone: Tone, x: number, y: number, r: number): Primitive => ({ kind: 'circle', tone, x, y, r });
const line = (tone: Tone, x1: number, y1: number, x2: number, y2: number, width = 1): Primitive => ({
  kind: 'line',
  tone,
  x1,
  y1,
  x2,
  y2,
  width,
});
/** A polyline as consecutive lines. */
const path = (tone: Tone, width: number, ...pts: Pt[]): Primitive[] =>
  pts.slice(1).map((p, i) => line(tone, pts[i]![0], pts[i]![1], p[0], p[1], width));

function footman(): Primitive[] {
  return [
    poly('body', [-0.28, -0.3], [0.28, -0.3], [0.34, 0.4], [-0.34, 0.4]),
    circ('light', 0, -0.52, 0.18),
    line('dark', -0.2, 0.4, -0.22, 0.8, 2),
    line('dark', 0.2, 0.4, 0.22, 0.8, 2),
    line('dark', 0.5, -0.8, 0.5, 0.6, 1.5),
  ];
}

function heavyFootman(): Primitive[] {
  return [
    poly('body', [-0.42, -0.3], [0.42, -0.3], [0.5, 0.4], [-0.5, 0.4]),
    circ('light', 0, -0.52, 0.2),
    poly('dark', [-0.2, -0.62], [0, -0.85], [0.2, -0.62]),
    circ('light', -0.4, 0.1, 0.35),
    circ('dark', -0.4, 0.1, 0.1),
    line('dark', -0.25, 0.4, -0.27, 0.8, 3),
    line('dark', 0.25, 0.4, 0.27, 0.8, 3),
    line('dark', 0.6, -0.75, 0.6, 0.6, 2),
  ];
}

function archerFootman(): Primitive[] {
  return [
    poly('body', [-0.3, -0.3], [0.18, -0.3], [0.22, 0.4], [-0.3, 0.4]),
    circ('light', -0.05, -0.52, 0.17),
    line('dark', -0.15, 0.4, -0.17, 0.8, 2),
    line('dark', 0.1, 0.4, 0.12, 0.8, 2),
    ...path('dark', 2, [0.35, -0.7], [0.55, -0.35], [0.6, 0], [0.55, 0.35], [0.35, 0.7]),
    line('light', 0.35, -0.7, 0.35, 0.7, 1),
  ];
}

function phalanx(): Primitive[] {
  const spears: Primitive[] = [];
  for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) {
    spears.push(line('dark', x, -0.6, x, 0.1, 1.5), poly('light', [x - 0.06, -0.6], [x + 0.06, -0.6], [x, -0.75]));
  }
  return [...spears, poly('body', [-0.75, 0.1], [0.75, 0.1], [0.75, 0.5], [-0.75, 0.5]), line('dark', -0.75, 0.3, 0.75, 0.3, 1)];
}

function bowman(): Primitive[] {
  return [
    poly('body', [-0.55, -0.2], [-0.05, -0.2], [0, 0.45], [-0.6, 0.45]),
    circ('light', -0.3, -0.45, 0.17),
    ...path('dark', 2.5, [0.2, -0.8], [0.5, -0.4], [0.6, 0], [0.5, 0.4], [0.2, 0.8]),
    line('light', 0.2, -0.8, 0.2, 0.8, 1),
    line('dark', -0.2, 0, 0.7, 0, 1.5),
    poly('dark', [0.7, -0.07], [0.7, 0.07], [0.85, 0]),
  ];
}

function horse(): Primitive[] {
  return [
    poly('body', [-0.65, 0], [-0.5, -0.3], [0.3, -0.3], [0.45, -0.55], [0.7, -0.55], [0.75, -0.4], [0.5, -0.2], [0.4, 0.3], [-0.5, 0.3]),
    line('dark', -0.5, 0.3, -0.55, 0.7, 2),
    line('dark', -0.3, 0.3, -0.25, 0.7, 2),
    line('dark', 0.3, 0.3, 0.35, 0.7, 2),
    line('dark', 0.4, 0.3, 0.5, 0.65, 2),
  ];
}

function lightCavalry(): Primitive[] {
  return [
    ...horse(),
    circ('light', -0.05, -0.7, 0.15),
    poly('dark', [-0.2, -0.55], [0.1, -0.55], [0.12, -0.3], [-0.22, -0.3]),
    line('dark', -0.4, 0.5, 0.6, -0.7, 1.5),
  ];
}

function heavyCavalry(): Primitive[] {
  return [
    ...horse(),
    poly('light', [-0.45, -0.3], [0.3, -0.3], [0.38, 0.1], [-0.5, 0.1]),
    circ('light', -0.05, -0.7, 0.17),
    poly('dark', [-0.2, -0.78], [-0.05, -0.92], [0.1, -0.78]),
    poly('dark', [-0.22, -0.55], [0.12, -0.55], [0.15, -0.3], [-0.25, -0.3]),
    circ('light', -0.35, -0.25, 0.2),
    line('dark', -0.4, 0.5, 0.6, -0.7, 2.5),
  ];
}

function lightChariot(): Primitive[] {
  return [
    poly('body', [-0.6, -0.4], [0.1, -0.4], [0.1, 0.1], [-0.6, 0.1]),
    circ('light', -0.25, 0.35, 0.3),
    circ('dark', -0.25, 0.35, 0.07),
    line('dark', -0.25, 0.05, -0.25, 0.65, 1),
    line('dark', -0.55, 0.35, 0.05, 0.35, 1),
    circ('light', -0.25, -0.55, 0.14),
    line('dark', 0.1, -0.05, 0.8, -0.05, 2),
    poly('body', [0.45, -0.3], [0.75, -0.3], [0.8, 0.1], [0.45, 0.1]),
  ];
}

function heavyChariot(): Primitive[] {
  return [
    poly('body', [-0.7, -0.5], [0.05, -0.5], [0.05, 0.15], [-0.7, 0.15]),
    circ('light', -0.35, 0.4, 0.38),
    circ('dark', -0.35, 0.4, 0.08),
    line('dark', -0.35, 0.02, -0.35, 0.78, 1.5),
    line('dark', -0.73, 0.4, 0.03, 0.4, 1.5),
    line('dark', -0.7, 0.4, -0.8, 0.5, 2),
    circ('light', -0.4, -0.68, 0.15),
    circ('light', -0.1, -0.68, 0.15),
    line('dark', 0.05, -0.1, 0.8, -0.1, 2.5),
    poly('body', [0.4, -0.45], [0.7, -0.45], [0.75, -0.05], [0.4, -0.05]),
    poly('body', [0.4, -0.02], [0.7, -0.02], [0.75, 0.38], [0.4, 0.38]),
  ];
}

function elephant(): Primitive[] {
  return [
    poly('body', [-0.75, -0.1], [-0.55, -0.5], [0.1, -0.55], [0.35, -0.3], [0.45, 0.2], [0.3, 0.45], [-0.6, 0.45], [-0.75, 0.2]),
    circ('body', 0.5, -0.15, 0.25),
    ...path('body', 5, [0.65, -0.05], [0.8, 0.3], [0.7, 0.55]),
    line('light', 0.6, 0.05, 0.85, 0.15, 2),
    circ('dark', 0.55, -0.22, 0.04),
    line('dark', -0.5, 0.45, -0.5, 0.75, 3),
    line('dark', -0.2, 0.45, -0.2, 0.75, 3),
    line('dark', 0.1, 0.45, 0.1, 0.75, 3),
    line('dark', 0.3, 0.45, 0.3, 0.75, 3),
    poly('dark', [-0.25, -0.55], [0.2, -0.55], [0.2, -0.85], [-0.25, -0.85]),
  ];
}

/** A galley: a pointed hull, bow on +x, and `banks` rows of oars on each side. */
function galley(banks: number): Primitive[] {
  const out: Primitive[] = [
    poly('body', [0.95, 0], [0.35, 0.28], [-0.7, 0.3], [-0.85, 0.15], [-0.85, -0.15], [-0.7, -0.3], [0.35, -0.28]),
    line('dark', -0.7, 0, 0.5, 0, 1),
    poly('light', [0.35, -0.08], [0.35, 0.08], [0.55, 0]),
  ];
  for (let bank = 0; bank < banks; bank++) {
    const reach = 0.1 + 0.08 * bank;
    for (let i = 0; i < 4; i++) {
      const x = -0.5 + 0.22 * i + 0.04 * bank;
      out.push(line('light', x, 0.3, x - 0.1, 0.3 + reach, 1.4), line('light', x, -0.3, x - 0.1, -0.3 - reach, 1.4));
    }
  }
  return out;
}

const FIGURES: Readonly<Record<string, Figure>> = {
  fantassins: { primitives: footman() },
  'fantassins-lourds': { primitives: heavyFootman() },
  'fantassins-archers': { primitives: archerFootman() },
  phalanges: { primitives: phalanx() },
  archers: { primitives: bowman() },
  'cavalerie-legere': { primitives: lightCavalry() },
  'cavalerie-lourde': { primitives: heavyCavalry() },
  'chars-legers': { primitives: lightChariot() },
  'chars-lourds': { primitives: heavyChariot() },
  elephants: { primitives: elephant() },
  galeres: { primitives: galley(1), oarBanks: 1 },
  biremes: { primitives: galley(2), oarBanks: 2 },
  triremes: { primitives: galley(3), oarBanks: 3 },
  quintiremes: { primitives: galley(5), oarBanks: 5 },
};

/** The figure for a unit type id. An unknown id gets a plain marker, never nothing. */
export function figureFor(typeId: string): Figure {
  return FIGURES[typeId] ?? { primitives: [circ('body', 0, 0, 0.5)] };
}

/** A figure's base: round, square, diamond or shield for owners 0-3, so the
 * players differ by more than hue (§64 B10). */
export function baseShape(owner: number): Primitive {
  switch (((owner % 4) + 4) % 4) {
    case 0:
      return circ('body', 0, 0, 1);
    case 1:
      return poly('body', [-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]);
    case 2:
      return poly('body', [0, -1], [1, 0], [0, 1], [-1, 0]);
    default:
      return poly('body', [-0.7, -0.7], [0.7, -0.7], [0.7, 0.1], [0, 0.95], [-0.7, 0.1]);
  }
}

/** The print counter's numbers, "attack (rangedAttack) range / defense movement"
 * (`data/units.ts`), the parenthesised part only for a unit with a range. */
export function counterBadge(type: UnitType): string {
  const attack = type.range > 0 ? `${type.attack} (${type.rangedAttack}) ${type.range}` : `${type.attack}`;
  return `${attack} / ${type.defense} ${type.movement}`;
}
