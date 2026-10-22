import { describe, expect, it } from 'vitest';
import type { Unit } from '../engine/state';
import { hexToPixel } from './hexRender';
import { landUnitsCentre, nearestHex } from './viewCentre';

let seq = 0;
function mk(over: Partial<Unit> & Pick<Unit, 'position'>): Unit {
  return {
    id: `u${seq++}`,
    owner: 0,
    typeId: 'fantassins',
    movementLeft: 0,
    facing: 0,
    defendedThisPhase: false,
    charged: false,
    destroyed: false,
    ...over,
  } as Unit;
}

describe('landUnitsCentre', () => {
  it('one land unit: its own point', () => {
    const p = { q: 4, r: 3 };
    expect(landUnitsCentre([mk({ position: p })], 0)).toEqual(hexToPixel(p));
  });

  it('two land units: the midpoint', () => {
    const a = { q: 2, r: 2 };
    const b = { q: 6, r: 4 };
    const c = landUnitsCentre([mk({ position: a }), mk({ position: b })], 0)!;
    expect(c.x).toBeCloseTo((hexToPixel(a).x + hexToPixel(b).x) / 2);
    expect(c.y).toBeCloseTo((hexToPixel(a).y + hexToPixel(b).y) / 2);
  });

  it('three land units: the mean, not the box centre', () => {
    const hs = [{ q: 0, r: 0 }, { q: 0, r: 0 }, { q: 9, r: 0 }];
    const c = landUnitsCentre(hs.map((position) => mk({ position })), 0)!;
    expect(c.x).toBeCloseTo((0 + 0 + hexToPixel(hs[2]!).x) / 3);
    expect(c.y).toBeCloseTo((0 + 0 + hexToPixel(hs[2]!).y) / 3);
  });

  it('ignores ships, destroyed units and other players', () => {
    const keep = { q: 3, r: 3 };
    const far = { q: 20, r: 10 };
    const units = [
      mk({ position: keep }),
      mk({ position: far, typeId: 'triremes' }),
      mk({ position: far, destroyed: true }),
      mk({ position: far, owner: 1 }),
    ];
    expect(landUnitsCentre(units, 0)).toEqual(hexToPixel(keep));
  });

  it('no land unit: null', () => {
    expect(landUnitsCentre([], 0)).toBeNull();
    expect(landUnitsCentre([mk({ position: { q: 1, r: 1 }, typeId: 'galeres' })], 0)).toBeNull();
    expect(landUnitsCentre([mk({ position: { q: 1, r: 1 }, owner: 1 })], 0)).toBeNull();
  });
});

describe('nearestHex', () => {
  it('round-trips a hex centre', () => {
    const h = { q: 7, r: 5 };
    expect(nearestHex(hexToPixel(h))).toEqual(h);
  });
});
