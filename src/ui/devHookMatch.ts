/**
 * The pure half of the dev-only test hook's button lookup (`devHook.ts`,
 * intents/32-e2e-smoke-suite spec B4): given the visible, interactive text
 * buttons on screen, pick the one a browser test asked for by label.
 * Separate from the Phaser display-list walk so it can be unit-tested.
 */
export interface ButtonCandidate {
  label: string;
  /** Canvas pixel of the button's centre. */
  x: number;
  y: number;
}

/** Candidates whose label matches exactly, in reading order: top-to-bottom, then left-to-right. */
export function matchingButtons(candidates: readonly ButtonCandidate[], label: string): ButtonCandidate[] {
  return candidates.filter((c) => c.label === label).sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * The button to click. Without `index`, exactly one may match — a duplicate
 * label (`'Turn'` ×2, `'Save'` per slot) must be disambiguated by the caller,
 * never silently resolved to the first. With `index`, the n-th match in
 * reading order.
 */
export function pickButton(candidates: readonly ButtonCandidate[], label: string, index?: number): { x: number; y: number } {
  const found = matchingButtons(candidates, label);
  if (index === undefined) {
    if (found.length !== 1) {
      throw new Error(`Expected exactly one button "${label}", found ${found.length}. Pass an index to pick one.`);
    }
    return { x: found[0]!.x, y: found[0]!.y };
  }
  const hit = found[index];
  if (!Number.isInteger(index) || index < 0 || !hit) {
    throw new Error(`No button "${label}" at index ${index}; ${found.length} match.`);
  }
  return { x: hit.x, y: hit.y };
}
