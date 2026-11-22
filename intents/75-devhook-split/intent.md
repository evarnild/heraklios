<!-- generated-by: heraklios/intent@0.1.5 -->
# §75 — The dev hook is built from small groups, so a new reader is one plain line

**Type:** refactor
**Originator:** the owner (2026-11-22): "draft an intent to split
installDevHook". It follows the owner's decision (a) on §74's review finding F2,
and §66's KonMari proposal.
**Source:**
- `intents/66-board-animations/review.md` → "KonMari check", where the owner
  accepted a packed line;
- `intents/66-board-animations/konmari.md`, which proposed the refactor
  intent;
- `intents/74-unit-hover-stats/review.md` → F2.

## Problem

`installDevHook` (`src/ui/devHook.ts:186-271` on `main` at `813e69c`) builds
the whole `window.__heraklios` test hook in one function. It now sits exactly
at the guardrail's 80-line limit. The limit is `max-lines-per-function`, set
to `max: 80, skipBlankLines, skipComments` at `eslint.config.js:77`.

Two features in a row have had to cheat that limit to add one reader each:
- **§66** put `animationSpeed` and `unitCanvas` on one line (`devHook.ts:265`
  today). The owner accepted it, and it is recorded in §66's review.
- **§74** put `tooltipText` on the same line as `landscapeBuilds`. The owner
  accepted it on 2026-11-22: "(a)".

Splitting either line makes the function 81 or 82 lines, and lint then goes
over its cap. So every e2e scenario that needs a new reader runs into the same
wall. The guardrail is being met by layout rather than by structure, which is
the thing the size rules are there to prevent (`docs/architecture.md`,
principle 13).

## Outcome

- `installDevHook` is split into a few small builders, each well under the
  limit. The readers are grouped by what they inspect, for example: scenes and
  buttons; the board state and its pending choices; the map, camera and views;
  panels and logs.
- Every reader sits on its own line. No line in `devHook.ts` packs two hook
  entries, and the two packing comments are gone.
- `window.__heraklios` exposes exactly the same members, with the same
  behaviour, as before. Every e2e scenario passes unchanged.
- The lint warning count does not rise. If the split removes a warning, the cap
  is lowered in the same commit.

## Constraints

- **Behaviour held constant.** The dev hook is dev-only: it never appears in a
  production build, and the e2e global setup checks that. Its contract is the
  set of member names and what each returns. A test asserts that the member set
  is identical before and after. Its tests are `npm run e2e` and the existing
  `src/ui/devHook*.test.ts` files, if any.
- **No new dependency, and no `eslint-disable`.** Lint is not loosened, and the
  limit stays at 80.
- **`devHook.ts` (386 lines today) must not pass 500 lines.** If the builders
  need their own module, they go next to it in `src/ui/`.
- **Blocked by §74.** §74 adds the second packed line, and this intent unpacks
  both. Building this before §74 merges would conflict with it or miss its line.
- **Out of scope:**
  - new readers;
  - changes to what any reader returns;
  - the scenes' own size ceilings.

## Type-specific questions

### Refactor
- **What is restructured:** `src/ui/devHook.ts`'s `installDevHook`, and
  possibly a sibling module for the builders.
- **How behaviour is held constant:**
  - a characterisation check that the hook's member names are the same list
    before and after;
  - `npm run e2e` unchanged and green;
  - `npm run verify` green, with lint not rising.
- **Why now:**
  - two intents in a row (§66, §74) had to pack lines to add one reader each;
  - §73 (the Board scene on the session) will need new readers for its e2e
    scenarios: advance, exchange, and a drift with a trample.

## Assumptions I made

- **The type is a refactor:** no player-visible behaviour, and the hook's
  contract is unchanged.
- **`review_tier` is left empty.** The path table gives Attested (`src/ui/**`).
  A live check is owed by rule 1 on paths, but the smoke suite can stand in
  ("When the smoke suite stands in"), because the hook is exercised by every
  e2e scenario and the change is neither new nor visual. The review decides
  that.
- **`blocked_by: 74`**, as the reason under Constraints says. §73's e2e needs
  are a reason to do this soon, not a blocker.
- **The id is 75,** from `npm run queue -- --next-id`.
