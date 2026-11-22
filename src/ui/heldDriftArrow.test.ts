import { describe, expect, it } from 'vitest';
import { HeldDriftArrow } from './heldDriftArrow';

function setup(animating: boolean) {
  const state = { animating, drawn: [] as number[], erased: 0 };
  const held = new HeldDriftArrow<number>(
    () => state.animating,
    (a) => state.drawn.push(a.facing),
    () => state.erased++,
  );
  return { state, held };
}
const arrow = (facing: number) => ({ hex: 1, facing, colorHex: '#fff' });

describe('HeldDriftArrow (B9)', () => {
  it('draws at once when nothing animates', () => {
    const { state, held } = setup(false);
    held.set(arrow(2));
    expect(state.drawn).toEqual([2]);
  });

  it('holds while animating and draws once on release', () => {
    const { state, held } = setup(true);
    held.set(arrow(3));
    expect(state.drawn).toEqual([]);
    held.release();
    held.release();
    expect(state.drawn).toEqual([3]);
  });

  it('a clear while held erases, and release then draws nothing', () => {
    const { state, held } = setup(true);
    held.set(arrow(3));
    held.clear();
    held.release();
    expect(state.erased).toBe(1);
    expect(state.drawn).toEqual([]);
  });

  it('two sets while held keep the latest', () => {
    const { state, held } = setup(true);
    held.set(arrow(1));
    held.set(arrow(4));
    held.release();
    expect(state.drawn).toEqual([4]);
  });
});
