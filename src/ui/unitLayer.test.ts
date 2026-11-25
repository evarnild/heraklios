import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnitDrawing, ViewHost } from './boardView';
import { setAnimationSpeed, resetAnimationSpeedForTests } from './animationSpeed';
import { facingAngleRad } from './hexRender';
import { jointFigure, UnitLayer } from './unitLayer';
import type { LayerFigure } from './unitLayer';

const rest = vi.hoisted(() => ({ alpha: 1 }));
vi.mock('./boardView', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./boardView')>()),
  unitAlpha: () => rest.alpha,
}));

interface Part {
  rotation: number;
  setRotation(r: number): void;
}

class FakeFigure implements LayerFigure {
  x = 0;
  y = 0;
  alpha = 1;
  active = true;
  destroyed = false;
  alphaCalls: number[] = [];
  marks: Array<[string | undefined, boolean]> = [];
  setStatus(status: string | undefined, charged: boolean): void {
    this.marks.push([status, charged]);
  }
  part: Part = {
    rotation: 0,
    setRotation: (r) => {
      this.part.rotation = r;
    },
  };
  get facingPart(): Part {
    return this.part;
  }
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
  setAlpha(a: number): void {
    this.alpha = a;
    this.alphaCalls.push(a);
  }
  objects(): never[] {
    return [this as never];
  }
  destroy(): void {
    this.destroyed = true;
    this.active = false;
  }
}

interface Counter {
  config: { onUpdate: (t: { getValue(): number }) => void; onComplete: () => void; duration: number };
  stopped: boolean;
}

function setup() {
  const counters: Counter[] = [];
  const scene = {
    children: { bringToTop: vi.fn(), queueDepthSort: vi.fn() },
    tweens: {
      addCounter: (config: Counter['config']) => {
        const c: Counter = { config, stopped: false };
        counters.push(c);
        return { stop: () => void (c.stopped = true), getValue: () => 0 };
      },
    },
    events: { once: vi.fn() },
  };
  const host = {
    scene,
    toScreen: (h: { q: number; r: number }) => ({ x: h.q * 100, y: h.r * 100 }),
    ignoreOnUiCamera: vi.fn(),
  } as unknown as ViewHost;
  const onDrained = vi.fn();
  const layer = new UnitLayer<FakeFigure>(
    host,
    (u: UnitDrawing) => {
      const f = new FakeFigure();
      const at = host.toScreen(u.position);
      f.setPosition(at.x, at.y);
      return f;
    },
    onDrained,
  );
  /** Drives the newest step: part-way (the counter value in ms) or to its end. */
  const advance = (value: number | 'end') => {
    const c = counters[counters.length - 1]!;
    if (value === 'end') c.config.onComplete();
    else c.config.onUpdate({ getValue: () => value });
  };
  return { layer, counters, scene, onDrained, advance };
}

const d = (id: string, q: number, r: number, facing?: number, typeId = 'fantassins'): UnitDrawing => ({
  id,
  typeId,
  owner: 0,
  position: { q, r },
  facing,
});

let t: ReturnType<typeof setup>;
beforeEach(() => {
  resetAnimationSpeedForTests();
  setAnimationSpeed('normal');
  rest.alpha = 1;
  t = setup();
});
afterEach(() => {
  t.layer.destroy();
  resetAnimationSpeedForTests();
});

describe('UnitLayer', () => {
  it('a move at Normal animates, and finishAnimations lands it (B1, B11)', () => {
    t.layer.setUnits([d('a', 1, 1)], 'snap');
    const fig = t.layer.figures().get('a')!;
    t.layer.setUnits([d('a', 3, 1)]);
    expect(t.counters).toHaveLength(1);
    expect(t.layer.animating).toBe(true);
    expect(fig.x).toBe(100);
    t.advance(90);
    expect(fig.x).toBeGreaterThan(100);
    expect(fig.x).toBeLessThan(300);
    t.layer.finishAnimations();
    expect(fig.x).toBe(300);
    expect(t.layer.animating).toBe(false);
    expect(t.onDrained).toHaveBeenCalledTimes(1);
  });

  it('Off draws at once with no tween, and snap finishes a running animation (B11)', () => {
    setAnimationSpeed('off');
    t.layer.setUnits([d('a', 1, 1)], 'snap');
    t.layer.setUnits([d('a', 3, 1)]);
    expect(t.counters).toHaveLength(0);
    expect(t.layer.figures().get('a')!.x).toBe(300);
    setAnimationSpeed('normal');
    t.layer.setUnits([d('a', 4, 1)]);
    expect(t.layer.animating).toBe(true);
    t.layer.setUnits([d('a', 5, 1)], 'snap');
    expect(t.layer.animating).toBe(false);
    expect(t.layer.figures().get('a')!.x).toBe(500);
  });

  it('an added unit and a recreated unit show at once (B5)', () => {
    t.layer.setUnits([d('a', 1, 1)]);
    expect(t.counters).toHaveLength(0);
    expect(t.layer.figures().get('a')!.x).toBe(100);
    const first = t.layer.figures().get('a')!;
    t.layer.setUnits([d('a', 2, 1, undefined, 'cavaliers')]);
    expect(t.counters).toHaveLength(0);
    expect(first.destroyed).toBe(true);
    expect(t.layer.figures().get('a')!.x).toBe(200);
  });

  it('a removed unit fades, stays listed during the fade and is destroyed after', () => {
    t.layer.setUnits([d('a', 1, 1)], 'snap');
    const fig = t.layer.figures().get('a')!;
    t.layer.setUnits([]);
    expect(t.counters).toHaveLength(1);
    expect(t.layer.objects()).toContain(fig);
    expect(fig.destroyed).toBe(false);
    t.advance(150);
    expect(fig.alpha).toBeCloseTo(0.5);
    t.advance('end');
    expect(fig.destroyed).toBe(true);
    expect(t.layer.objects()).not.toContain(fig);
  });

  it('equal drawings play nothing and do not settle a moving figure (§66 B8)', () => {
    t.layer.setUnits([d('a', 1, 1)], 'snap');
    t.layer.setUnits([d('a', 3, 1)]);
    const fig = t.layer.figures().get('a')!;
    t.advance(90);
    const x = fig.x;
    t.layer.setUnits([d('a', 3, 1)]);
    expect(t.counters).toHaveLength(1);
    expect(fig.x).toBe(x);
  });

  it('settle restores the unit resting alpha, not 1, and make is followed by it', () => {
    rest.alpha = 0.6;
    t.layer.setUnits([d('a', 1, 1)], 'snap');
    const fig = t.layer.figures().get('a')!;
    expect(fig.alphaCalls[0]).toBe(0.6);
    fig.setAlpha(0.2);
    t.layer.setUnits([d('a', 2, 1)], 'snap');
    expect(fig.alpha).toBe(0.6);
    expect(fig.alphaCalls).not.toContain(1);
  });

  it('settle turns the facing part to the drawing', () => {
    t.layer.setUnits([d('s', 1, 1, 0)], 'snap');
    t.layer.setUnits([d('s', 1, 1, 2)], 'snap');
    expect(t.layer.figures().get('s')!.part.rotation).toBeCloseTo(facingAngleRad(2));
  });

  it('settled() resolves on drain, on finish and on destroy', async () => {
    t.layer.setUnits([d('a', 1, 1)], 'snap');
    t.layer.setUnits([d('a', 2, 1)]);
    const drained = t.layer.animationsSettled();
    t.advance('end');
    await drained;

    t.layer.setUnits([d('a', 3, 1)]);
    const finished = t.layer.animationsSettled();
    t.layer.finishAnimations();
    await finished;

    t.layer.setUnits([d('a', 4, 1)]);
    const destroyed = t.layer.animationsSettled();
    t.layer.destroy();
    await destroyed;
  });
});

type Fake = Record<string, number | boolean | ((...a: number[]) => void)>;

function obj(): Fake {
  const o: Fake = { x: 0, y: 0, alpha: 1, active: true, destroyed: false, rotated: 0, rotation: 0 };
  o.setPosition = (x: number, y: number) => {
    o.x = x;
    o.y = y;
  };
  o.setAlpha = (a: number) => {
    o.alpha = a;
  };
  o.setRotation = (r: number) => {
    o.rotation = r;
    o.rotated = (o.rotated as number) + 1;
  };
  o.destroy = () => {
    o.destroyed = true;
  };
  return o;
}

describe('jointFigure', () => {
  it('moves and fades both, turns only the follower, destroys both', () => {
    const lead = obj();
    const follower = obj();
    const f = jointFigure(lead as never, follower as never);
    f.setPosition(5, 6);
    f.setAlpha(0.4);
    expect([lead.x, lead.y, follower.x, follower.y]).toEqual([5, 6, 5, 6]);
    expect([lead.alpha, follower.alpha]).toEqual([0.4, 0.4]);
    expect(f.facingPart).toBe(follower);
    f.facingPart!.setRotation(1);
    expect(lead.rotated).toBe(0);
    expect(follower.rotation).toBe(1);
    expect(f.objects()).toEqual([lead, follower]);
    f.destroy();
    expect([lead.destroyed, follower.destroyed]).toEqual([true, true]);
  });

  it('a status badge moves, fades and is destroyed with the figure, and never turns (§82 AC6)', () => {
    const lead = obj();
    const follower = obj();
    const badge = obj();
    const f = jointFigure(lead as never, follower as never, badge as never);
    f.setPosition(5, 6);
    f.setAlpha(0.4);
    expect([badge.x, badge.y, badge.alpha]).toEqual([5, 6, 0.4]);
    expect(f.facingPart).toBe(follower);
    f.facingPart!.setRotation(1);
    expect(badge.rotated).toBe(0);
    expect(f.objects()).toEqual([lead, follower, badge]);
    f.destroy();
    expect(badge.destroyed).toBe(true);
  });

  it('with no follower there is no facing part', () => {
    const lead = obj();
    const f = jointFigure(lead as never, null);
    f.setPosition(1, 2);
    expect(f.facingPart).toBeNull();
    expect(f.objects()).toEqual([lead]);
  });

  it('shows a status-only change at once, also while another unit animates, and not an unchanged one (§82 AC6)', () => {
    t.layer.setUnits([d('a', 1, 1), d('b', 5, 1)], 'snap');
    const a = t.layer.figures().get('a')!;
    const b = t.layer.figures().get('b')!;
    expect(a.marks).toEqual([[undefined, false]]);
    t.layer.setUnits([{ ...d('a', 1, 1), status: 'notMoved' }, d('b', 7, 1)]);
    expect(t.layer.animating).toBe(true);
    expect(a.marks).toEqual([[undefined, false], ['notMoved', false]]);
    expect(b.marks).toHaveLength(1);
    t.layer.setUnits([{ ...d('a', 1, 1), status: 'notMoved' }, d('b', 7, 1)]);
    expect(a.marks).toHaveLength(2);
    t.layer.finishAnimations();
  });

  it('sets the mark at build, on a new figure and on a recreated one (§82)', () => {
    t.layer.setUnits([{ ...d('a', 1, 1), status: 'done', charged: true }], 'snap');
    expect(t.layer.figures().get('a')!.marks).toEqual([['done', true]]);
    t.layer.setUnits([{ ...d('a', 1, 1, undefined, 'cavalerie-legere'), status: 'done', charged: true }], 'snap');
    expect(t.layer.figures().get('a')!.marks).toEqual([['done', true]]);
  });
});
