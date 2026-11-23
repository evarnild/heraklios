import { describe, expect, it } from 'vitest';
import type { UnitFigure } from './boardView';
import { facingAngleRad } from './hexRender';
import { makeRunner, wrapAngle } from './unitMotions';
import type { MotionHost } from './unitMotions';

interface Fake extends UnitFigure {
  x: number;
  y: number;
  alpha: number;
  active: boolean;
  part: { rotation: number; setRotation(r: number): void } | null;
}

function fake(x = 0, y = 0, withPart = true): Fake {
  const part = withPart
    ? {
        rotation: 0,
        setRotation(r: number) {
          part!.rotation = r;
        },
      }
    : null;
  const f: Fake = {
    x,
    y,
    alpha: 1,
    active: true,
    part,
    get facingPart() {
      return f.part;
    },
    setPosition(nx, ny) {
      f.x = nx;
      f.y = ny;
    },
    setAlpha(a) {
      f.alpha = a;
    },
  };
  return f;
}

function host(figs: Record<string, Fake>, disposed: string[] = []): MotionHost {
  return {
    toScreen: (hex) => ({ x: hex.q * 100, y: hex.r * 100 }),
    unit: (id) => figs[id],
    dispose: (id) => void disposed.push(id),
  };
}

describe('makeRunner', () => {
  it('a slide is strictly between its ends half way, and exact at the end', () => {
    const f = fake(0, 0);
    const r = makeRunner(host({ a: f }), { kind: 'slide', unitId: 'a', to: { q: 2, r: 0 }, ms: 100 })!;
    r.update(50);
    expect(f.x).toBeCloseTo(100);
    expect(f.y).toBe(0);
    r.end();
    expect(f.x).toBe(200);
  });

  it('a lunge goes out part-way and ends exactly at its start', () => {
    const f = fake(10, 10);
    const r = makeRunner(host({ a: f }), { kind: 'lunge', unitId: 'a', toward: { q: 2, r: 0 }, ms: 100 })!;
    r.update(50);
    expect(f.x).toBeGreaterThan(10);
    expect(f.x).toBeLessThan(200);
    r.end();
    expect([f.x, f.y]).toEqual([10, 10]);
  });

  it('a shake ends exactly at its start', () => {
    const f = fake(5, 7);
    const r = makeRunner(host({ a: f }), { kind: 'shake', unitId: 'a', ms: 100 })!;
    r.update(20);
    expect(f.x).not.toBe(5);
    r.end();
    expect([f.x, f.y]).toEqual([5, 7]);
  });

  it('a turn rotates only the facing part, the short way, and keeps the position', () => {
    const f = fake(3, 4);
    f.part!.rotation = facingAngleRad(0);
    const r = makeRunner(host({ a: f }), { kind: 'turn', unitId: 'a', toFacing: 5, ms: 100 })!;
    r.update(100);
    expect(f.part!.rotation).toBeCloseTo(facingAngleRad(0) + Math.PI / 3);
    r.end();
    expect(f.part!.rotation).toBeCloseTo(facingAngleRad(5));
    expect([f.x, f.y]).toEqual([3, 4]);
  });

  it('a turn on a figure with no facing part gives no runner', () => {
    expect(makeRunner(host({ a: fake(0, 0, false) }), { kind: 'turn', unitId: 'a', toFacing: 1, ms: 100 })).toBeNull();
  });

  it('a fade goes from the current alpha to 0, then disposes once', () => {
    const f = fake();
    f.alpha = 0.6;
    const disposed: string[] = [];
    const r = makeRunner(host({ a: f }, disposed), { kind: 'fade', unitId: 'a', ms: 100 })!;
    r.update(50);
    expect(f.alpha).toBeCloseTo(0.3);
    r.end();
    expect(disposed).toEqual(['a']);
  });

  it('a missing or inactive unit gives no runner', () => {
    const dead = fake();
    dead.active = false;
    expect(makeRunner(host({}), { kind: 'shake', unitId: 'a', ms: 10 })).toBeNull();
    expect(makeRunner(host({ a: dead }), { kind: 'shake', unitId: 'a', ms: 10 })).toBeNull();
  });
});

describe('wrapAngle', () => {
  // Phaser's Angle.Wrap(angle) is Math.Wrap(angle, -PI, PI): min + ((((v - min) % range) + range) % range).
  const phaser = (v: number) => {
    const min = -Math.PI;
    const range = 2 * Math.PI;
    return min + ((((v - min) % range) + range) % range);
  };
  it.each([Math.PI, -Math.PI, 3 * Math.PI, (-3 * Math.PI) / 2, 0.5, -7])('matches Phaser for %f', (v) => {
    expect(wrapAngle(v)).toBeCloseTo(phaser(v));
    expect(wrapAngle(v)).toBeGreaterThanOrEqual(-Math.PI - 1e-9);
    expect(wrapAngle(v)).toBeLessThan(Math.PI + 1e-9);
  });
});
