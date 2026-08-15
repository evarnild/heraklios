import { describe, expect, it } from 'vitest';
import {
  SEAT_CONTROLS,
  aiDifficultyOf,
  createSeatAgent,
  isAiSeat,
  isSeatControl,
  nextSeatControl,
  normalizeSeatControls,
  seatControlLabel,
  type SeatControl,
} from './seatControl';
import { HeuristicAgent } from './heuristicAgent';

describe('isSeatControl', () => {
  it('accepts every declared control and nothing else', () => {
    for (const control of SEAT_CONTROLS) expect(isSeatControl(control)).toBe(true);
    for (const bogus of ['ai', 'AI-EV', 'ai-lookahead', '', 0, null, undefined, {}, ['human']]) {
      expect(isSeatControl(bogus)).toBe(false);
    }
  });
});

describe('aiDifficultyOf / isAiSeat', () => {
  it('maps each control to its HeuristicAgent tier', () => {
    expect(aiDifficultyOf('human')).toBeNull();
    expect(aiDifficultyOf('ai-random')).toBe('random');
    expect(aiDifficultyOf('ai-greedy')).toBe('greedy');
    expect(aiDifficultyOf('ai-ev')).toBe('ev');
  });

  it('treats exactly the non-human controls as AI seats', () => {
    expect(isAiSeat('human')).toBe(false);
    for (const control of SEAT_CONTROLS.filter((c) => c !== 'human')) {
      expect(isAiSeat(control)).toBe(true);
    }
  });
});

describe('nextSeatControl', () => {
  it('cycles through every control and returns to the start', () => {
    const seen: SeatControl[] = [];
    let control: SeatControl = 'human';
    for (let i = 0; i < SEAT_CONTROLS.length; i++) {
      seen.push(control);
      control = nextSeatControl(control);
    }
    expect(seen).toEqual([...SEAT_CONTROLS]);
    expect(control).toBe('human'); // wrapped
  });
});

describe('seatControlLabel', () => {
  it('gives every control a distinct, non-empty label', () => {
    const labels = SEAT_CONTROLS.map(seatControlLabel);
    expect(new Set(labels).size).toBe(SEAT_CONTROLS.length);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
  });
});

describe('createSeatAgent', () => {
  it('returns null for a human seat', () => {
    expect(createSeatAgent('human')).toBeNull();
  });

  it('builds a HeuristicAgent for every AI seat', () => {
    for (const control of SEAT_CONTROLS.filter((c) => c !== 'human')) {
      expect(createSeatAgent(control)).toBeInstanceOf(HeuristicAgent);
    }
  });

  it('passes the injected rng through, so an AI seat can be made reproducible', () => {
    // The `'random'` tier is the one that actually consumes `rng` on every
    // decision (the scored tiers only use it to break ties), so it's the tier
    // that proves the injection reached the agent rather than being dropped.
    let calls = 0;
    const rng = () => {
      calls++;
      return 0.5;
    };
    const agent = createSeatAgent('ai-random', rng)!;
    agent.chooseNextAction({ phase: 'movement' } as never, [{ kind: 'endPhase' }, { kind: 'endPhase' }]);
    expect(calls).toBeGreaterThan(0);
  });
});

describe('normalizeSeatControls', () => {
  it('keeps valid entries and pads to the requested length with human', () => {
    expect(normalizeSeatControls(['ai-ev', 'human'], 4)).toEqual(['ai-ev', 'human', 'human', 'human']);
  });

  it('truncates a longer array', () => {
    expect(normalizeSeatControls(['ai-ev', 'ai-ev', 'ai-ev', 'ai-ev'], 2)).toEqual(['ai-ev', 'ai-ev']);
  });

  it('replaces individual junk entries with human rather than rejecting the whole array', () => {
    expect(normalizeSeatControls(['ai-ev', 'ai-lookahead', null, 7], 4)).toEqual([
      'ai-ev',
      'human',
      'human',
      'human',
    ]);
  });

  it('defaults everything to human for a non-array (a pre-Stage-4 save has no such field)', () => {
    expect(normalizeSeatControls(undefined, 3)).toEqual(['human', 'human', 'human']);
    expect(normalizeSeatControls('ai-ev', 2)).toEqual(['human', 'human']);
  });
});
