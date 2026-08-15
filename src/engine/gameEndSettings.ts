/**
 * Presets for plan.md §9.2.1's Modes A (clock) and B (round limit), plus the
 * cycling/formatting helpers `MenuScene` and `BoardScene` share for them —
 * the same "small pure list + cycle-to-next + label" shape `seatControl.ts`
 * already uses for the per-seat Human/AI button, chosen instead of a free
 * text input per plan.md §9.2.2 point 4 ("the Menu has no text input, and
 * building one for this would be the largest single piece of work in the
 * task").
 */

/** Whole-game clock presets, in milliseconds — index 0 (`null`) is "off".
 * `MenuScene`'s cycling button walks this list; `null` is deliberately first
 * so a fresh session (or a save from before this feature) reads as "off"
 * without a special case. */
export const CLOCK_LIMIT_PRESETS_MS: readonly (number | null)[] = [
  null,
  30 * 60_000,
  60 * 60_000,
  120 * 60_000,
];

/** Round-limit presets — index 0 (`null`) is "off", same convention as
 * `CLOCK_LIMIT_PRESETS_MS`. */
export const ROUND_LIMIT_PRESETS: readonly (number | null)[] = [null, 6, 8, 12];

/** Next value in `CLOCK_LIMIT_PRESETS_MS`, wrapping — falls back to the first
 * preset if `current` isn't one (e.g. a hand-edited save), same defensive
 * shape `nextSeatControl` uses. */
export function nextClockLimitMs(current: number | null): number | null {
  const index = CLOCK_LIMIT_PRESETS_MS.indexOf(current);
  return CLOCK_LIMIT_PRESETS_MS[(index + 1) % CLOCK_LIMIT_PRESETS_MS.length] ?? null;
}

/** Next value in `ROUND_LIMIT_PRESETS`, wrapping. */
export function nextRoundLimit(current: number | null): number | null {
  const index = ROUND_LIMIT_PRESETS.indexOf(current);
  return ROUND_LIMIT_PRESETS[(index + 1) % ROUND_LIMIT_PRESETS.length] ?? null;
}

/** "Off" / "30 min" / "1 h" / "2 h" — the Menu button's own label. */
export function clockLimitLabel(ms: number | null): string {
  if (ms === null) return 'Off';
  const minutes = ms / 60_000;
  return minutes < 60 ? `${minutes} min` : `${minutes / 60} h`;
}

/** "Off" / "6 rounds" / "8 rounds" / "12 rounds". */
export function roundLimitLabel(rounds: number | null): string {
  return rounds === null ? 'Off' : `${rounds} rounds`;
}

/**
 * "H:MM:SS" (or "MM:SS" under an hour) for the Board's remaining-clock
 * display — `Math.ceil`, not `floor`/`round`, so the label reads "0:00" only
 * on the exact frame the limit is reached rather than one tick early, and
 * counts down to it rather than up past it.
 */
export function formatRemainingClock(remainingMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => `${n}`.padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
