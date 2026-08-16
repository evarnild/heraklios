import type { DrivingAgent } from './agent';
import { HeuristicAgent, type Difficulty } from './heuristicAgent';

/**
 * Who plays a seat: the player at the keyboard, or one of the four
 * `HeuristicAgent` difficulty tiers (plan.md §6.4's Stage 4).
 *
 * Deliberately a FLAT string union rather than `'human' | { ai: Difficulty }`.
 * Three things read this value and each is simpler for it: the Menu cycles
 * through the options with `nextSeatControl`, the save file stores it as
 * a plain JSON string that `isSeatControl` validates in one comparison (see
 * `saveGame.ts`'s `SAVE_VERSION` 2 note), and `BoardScene` asks nothing more
 * of it than "is this seat a bot, and if so which agent." An object shape
 * would buy per-seat weight tuning, which nothing wants yet — and
 * `HeuristicAgentOptions.weights` is still there when something does.
 *
 * Lives in `engine/` rather than `ui/session.ts` (which holds the rest of the
 * Menu's setup) for the same reason `saveGame.ts` does: the save file has to
 * validate it, and `engine/` may not import from `ui/`.
 */
export type SeatControl = 'human' | 'ai-random' | 'ai-greedy' | 'ai-ev' | 'ai-lookahead';

/** Every `SeatControl`, in the order the Menu cycles through them. */
export const SEAT_CONTROLS: readonly SeatControl[] = ['human', 'ai-random', 'ai-greedy', 'ai-ev', 'ai-lookahead'];

export function isSeatControl(value: unknown): value is SeatControl {
  return typeof value === 'string' && (SEAT_CONTROLS as readonly string[]).includes(value);
}

/** The `HeuristicAgent` tier this control maps to, or `null` for a human
 * seat — the single place the `'ai-*'` prefix is decoded. */
export function aiDifficultyOf(control: SeatControl): Difficulty | null {
  switch (control) {
    case 'human':
      return null;
    case 'ai-random':
      return 'random';
    case 'ai-greedy':
      return 'greedy';
    case 'ai-ev':
      return 'ev';
    case 'ai-lookahead':
      return 'lookahead';
  }
}

export function isAiSeat(control: SeatControl): boolean {
  return aiDifficultyOf(control) !== null;
}

/**
 * Short label for the Menu button and the Board's status line. The first
 * three difficulty names describe *strength*, not the implementation tier —
 * a player picking an opponent cares that "easy" is easy, not that it
 * delegates to `RandomAgent` (see `heuristicAgent.ts`'s `'random'` tier,
 * which really is that same agent).
 *
 * `'ai-lookahead'` is deliberately labelled "cautious," not "expert": it
 * shares `'ai-ev'`'s exact combat logic and only adds a bounded threat check
 * to its movement choices, and measurement (`heuristicSoak.test.ts`,
 * plan.md §6.14) could not establish that this makes it reliably STRONGER
 * than `'ai-ev'` in aggregate — the earlier "expert" label asserted an
 * ordering the tier doesn't actually back up. It IS a real, different, more
 * defensively-minded playstyle (verified by targeted tests, not aggregate
 * material), which is what the label now claims instead.
 */
export function seatControlLabel(control: SeatControl): string {
  switch (control) {
    case 'human':
      return 'Human';
    case 'ai-random':
      return 'AI — easy';
    case 'ai-greedy':
      return 'AI — normal';
    case 'ai-ev':
      return 'AI — hard';
    case 'ai-lookahead':
      return 'AI — cautious';
  }
}

/** Next option in the cycle, wrapping — what a click on the Menu's per-seat
 * button selects. */
export function nextSeatControl(control: SeatControl): SeatControl {
  const index = SEAT_CONTROLS.indexOf(control);
  return SEAT_CONTROLS[(index + 1) % SEAT_CONTROLS.length]!;
}

/**
 * The agent that plays this seat, or `null` for a human one (whose decisions
 * come from `BoardScene`'s own prompts instead — the scene implements
 * `PlayerAgent`, so the two are interchangeable at every mid-resolution
 * decision point; see `BoardScene.agentFor`).
 *
 * `rng` follows the project's usual injection convention (`shuffleSeatOrder`,
 * `RandomAgent`, `HeuristicAgentOptions.rng`): supplying a seeded generator
 * makes even the `'ai-random'` tier reproducible, and omitting it falls back
 * to `Math.random` — which is what the game itself does, since a bot that
 * plays the same game identically every time is a worse opponent, not a
 * better one.
 */
export function createSeatAgent(control: SeatControl, rng?: () => number): DrivingAgent | null {
  const difficulty = aiDifficultyOf(control);
  if (difficulty === null) return null;
  return new HeuristicAgent({ difficulty, rng });
}

/**
 * Coerces anything (a parsed save file's field, a short/absent session array)
 * into exactly `count` valid controls, defaulting every unusable entry to
 * `'human'`.
 *
 * "Default to human" is the safe direction and the one every caller wants: a
 * save written before Stage 4 existed has no `seatControls` at all and was,
 * by definition, an all-human hotseat game — so filling it with `'human'`
 * reproduces that game exactly (see `saveGame.ts`'s migration). The reverse
 * default would silently hand a player's own army to a bot.
 */
export function normalizeSeatControls(value: unknown, count: number): SeatControl[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: count }, (_, i) => (isSeatControl(source[i]) ? source[i] : 'human'));
}
