import { describe, expect, it } from 'vitest';
import { panBounds } from './panBounds';

const board = { x: 40, y: 10, width: 1386, height: 600 };
const PAD = 200;
const old = { x: 40 - PAD, y: 10 - PAD, width: 1386 + 2 * PAD, height: 600 + 2 * PAD };

describe('panBounds (§88 B5)', () => {
  // Board room = canvas - 300; Placement room = the canvas.
  const cases: Array<[number, number, string]> = [
    [800, 1100, 'Board 1100'],
    [1300, 1600, 'Board 1600'],
    [1786, 2086, 'Board 2086 (room exactly board + 2 x 200)'],
    [2100, 2400, 'Board 2400'],
    [3140, 3440, 'Board 3440'],
    [1100, 1100, 'Placement 1100'],
    [1600, 1600, 'Placement 1600'],
    [2086, 2086, 'Placement 2086'],
    [2400, 2400, 'Placement 2400'],
    [3440, 3440, 'Placement 3440'],
  ];
  for (const [room, , name] of cases) {
    it(`${name}: room ${room}`, () => {
      const b = panBounds(board, room, PAD);
      expect(b.y).toBe(old.y);
      expect(b.height).toBe(old.height);
      if (room <= board.width + 2 * PAD) {
        expect(b).toEqual(old);
      } else {
        expect(b.width).toBe(room);
        expect(b.x + b.width / 2).toBe(board.x + board.width / 2);
      }
    });
  }

  it('is the old bounds at exactly board + 2 x padding and wider just above it', () => {
    expect(panBounds(board, 1786, PAD)).toEqual(old);
    expect(panBounds(board, 1787, PAD).width).toBe(1787);
  });
});
