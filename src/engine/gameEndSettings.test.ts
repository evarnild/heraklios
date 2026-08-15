import { describe, it, expect } from 'vitest';
import {
  CLOCK_LIMIT_PRESETS_MS,
  ROUND_LIMIT_PRESETS,
  clockLimitLabel,
  formatRemainingClock,
  nextClockLimitMs,
  nextRoundLimit,
  roundLimitLabel,
} from './gameEndSettings';

describe('nextClockLimitMs', () => {
  it('cycles Off -> 30 min -> 1 h -> 2 h -> Off', () => {
    expect(nextClockLimitMs(null)).toBe(30 * 60_000);
    expect(nextClockLimitMs(30 * 60_000)).toBe(60 * 60_000);
    expect(nextClockLimitMs(60 * 60_000)).toBe(120 * 60_000);
    expect(nextClockLimitMs(120 * 60_000)).toBeNull();
  });

  it('falls back to the first preset for a value not in the list', () => {
    expect(nextClockLimitMs(999)).toBe(CLOCK_LIMIT_PRESETS_MS[0]);
  });
});

describe('nextRoundLimit', () => {
  it('cycles Off -> 6 -> 8 -> 12 -> Off', () => {
    expect(nextRoundLimit(null)).toBe(6);
    expect(nextRoundLimit(6)).toBe(8);
    expect(nextRoundLimit(8)).toBe(12);
    expect(nextRoundLimit(12)).toBeNull();
  });

  it('falls back to the first preset for a value not in the list', () => {
    expect(nextRoundLimit(999)).toBe(ROUND_LIMIT_PRESETS[0]);
  });
});

describe('clockLimitLabel', () => {
  it('labels every preset', () => {
    expect(clockLimitLabel(null)).toBe('Off');
    expect(clockLimitLabel(30 * 60_000)).toBe('30 min');
    expect(clockLimitLabel(60 * 60_000)).toBe('1 h');
    expect(clockLimitLabel(120 * 60_000)).toBe('2 h');
  });
});

describe('roundLimitLabel', () => {
  it('labels every preset', () => {
    expect(roundLimitLabel(null)).toBe('Off');
    expect(roundLimitLabel(6)).toBe('6 rounds');
    expect(roundLimitLabel(8)).toBe('8 rounds');
    expect(roundLimitLabel(12)).toBe('12 rounds');
  });
});

describe('formatRemainingClock', () => {
  it('formats under an hour as M:SS', () => {
    expect(formatRemainingClock(5 * 60_000 + 9_000)).toBe('5:09');
  });

  it('formats an hour or more as H:MM:SS', () => {
    expect(formatRemainingClock(60 * 60_000 + 2 * 60_000 + 3_000)).toBe('1:02:03');
  });

  it('rounds up rather than down, so it reads 0:00 only once the limit is truly reached', () => {
    expect(formatRemainingClock(500)).toBe('0:01');
  });

  it('clamps a negative input to 0:00 rather than showing a negative time', () => {
    expect(formatRemainingClock(-5_000)).toBe('0:00');
  });

  it('formats exactly 0 as 0:00', () => {
    expect(formatRemainingClock(0)).toBe('0:00');
  });
});
