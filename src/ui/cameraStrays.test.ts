import { describe, expect, it } from 'vitest';
import { cameraStrays } from './cameraStrays';

const MAIN = 1;
const UI = 2;
const obj = (cameraFilter: number, type = 'Graphics', depth = 12) => ({ cameraFilter, type, depth });

describe('cameraStrays', () => {
  it('does not report an object ignored by the HUD camera only', () => {
    expect(cameraStrays([obj(UI)], MAIN, UI)).toEqual([]);
  });
  it('does not report an object ignored by the main camera only', () => {
    expect(cameraStrays([obj(MAIN)], MAIN, UI)).toEqual([]);
  });
  it('reports an object ignored by neither camera', () => {
    expect(cameraStrays([obj(0)], MAIN, UI)).toHaveLength(1);
  });
  it('does not report an object ignored by both cameras', () => {
    expect(cameraStrays([obj(MAIN | UI)], MAIN, UI)).toEqual([]);
  });
  it('returns each stray with its type and depth', () => {
    const list = [obj(UI), obj(0, 'Graphics', 12), obj(MAIN), obj(0, 'Text', 13)];
    expect(cameraStrays(list, MAIN, UI)).toEqual([{ type: 'Graphics', depth: 12 }, { type: 'Text', depth: 13 }]);
  });
  it('ignores bits of other cameras', () => {
    expect(cameraStrays([obj(4)], MAIN, UI)).toHaveLength(1);
    expect(cameraStrays([obj(4 | UI)], MAIN, UI)).toEqual([]);
  });
});
