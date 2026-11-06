<!-- generated-by: heraklios/intent@0.1.5 -->
# §69 — /auto gets five review rounds and stops early when a run stops converging

**Type:** feature
**Originator:** the owner (2026-11-06): "Do you think a limit of 3 rounds is
good? I think 5 would be ok too". The coordinator proposed raising the cap to
five and adding a no-progress stop. The owner then said "draft intent".
**Source:** that conversation, and §50's spec (B5, B9).

## Problem

`/auto` stops a run after three review rounds, whether or not the run is
getting somewhere:

- **The cap is a fixed number.** It is defined in §50's spec, B5: "The cap:
  three review rounds per intent, counting every round of the run". It is
  enforced in four places:
  - `scripts/intent-check-lib.mjs:118`, `AUTO_MAX_ROUND = 3`, which
    `check:intent` uses to reject `auto_round` above 3 (`:232-233`);
  - `.claude/skills/auto/SKILL.md`, step 5, item 1: "If `n` would be 4,
    stop";
  - the orchestrator, which refuses an Auto click on `out of rounds`
    (`tools/orchestrator/orchestrator-lib.mjs:197`, `BY_HAND`);
  - `sdlc.md:113`: "At most three review rounds".
- **Converging runs get cut off.** Of the 11 intents with recorded `/auto`
  rounds, 2 ran out at round 3 (§52 and §55, both continued by hand), and §64
  is starting round 3 now. §64's round-2 findings were all test gaps that a
  round of rework closes, so stopping a run in that state protects nothing.
- **A run that isn't converging is only caught by the number.** What the cap
  is really for is a loop, where every review finds new problems as fast as
  rework fixes the old ones. A fixed count can't tell a loop from steady
  progress. Simply raising the number would let a real loop spend more rounds,
  each costing an Opus review plus the coordinator's re-check (20 to 40
  minutes, and memory pressure on this machine), before the owner hears.

## Outcome

- **The cap is five rounds.** These places agree on the new number:
  - `check:intent` accepts `auto_round` from 1 to 5;
  - `/auto` stops before a sixth round, with `out of rounds`;
  - `sdlc.md`, `CLAUDE.md` and `intents/README.md` say five;
  - §50's spec has the change recorded, as an amendment note with its reason.
- **A run that stops converging stops early,** with
  `auto_stopped: no progress, open findings below`. The trigger is decided in
  the spec. The starting proposal is either:
  - a round whose MEDIUM-or-higher findings are no fewer than the previous
    round's;
  - a finding the previous round's rework claimed to fix that comes back.

  The stop lists the open findings, as `out of rounds` does.
- **The orchestrator treats `no progress` like `out of rounds`.** Its Auto
  button refuses both, and a test pins each.
- **Existing runs keep working:** a recorded `auto_round` of 1 to 3 stays valid.

## Constraints

- **The owner's gates are unchanged.** The cap covers review rounds only.
  `spec_accepted`, `live_checked` and `/ship` stay the owner's, and the
  live-check rework still counts against the same budget (§50, B9).
- **It edits the same `/auto` skill as §61,** which is in build now. To avoid
  a merge conflict in `.claude/skills/auto/SKILL.md`, this waits for §61 to
  merge, or rebases onto it.
- **The path table makes this change Reviewed:** it touches `.claude/skills/**`
  and the `/auto` stop rules.
- **No game code changes.**
- **Live check:** none expected, since no runtime path changes. Review decides.

## Type-specific questions

### Feature
- **Users:** the owner and the coordinator. No player-facing change.
- **Rulebook basis:** digital-only, no print rule.
- **Known simplification it removes:** none.
- **Open design questions** (for `spec.md`):
  1. **The no-progress trigger.** The candidates are:
     - finding counts at MEDIUM or above not falling;
     - a "fixed" finding recurring;
     - both;
     - a total-severity score.

     Which findings count? Does a round whose only new findings are LOW still
     count as progress?
  2. **Earliest round for the no-progress stop:** round 2, the first with a
     previous round to compare with, or round 3?
  3. **Who decides "the same finding":** the coordinator, comparing `file:line`
     and the finding's text, or the reviewer, by marking a finding "recurs
     from round n"?
  4. **After `out of rounds` or `no progress`,** can the owner grant extra
     rounds with a message such as `/auto <id> +2`, or does the intent still
     continue by hand, as today?
  5. **Whether five is right, or four.** The data is 11 runs: 8 finished in 2
     rounds or fewer, and 2 hit 3.

## Assumptions I made

- **The type is feature, not adjustment.** The change touches more than five
  files, and the no-progress stop has open design questions.
- **The id is 69, not 68.** The `npm run queue -- --next-id` command offers
  68, but §61's intent records 68 as folded into §61 and not reused.
- **The run data was read from `intents/*/metadata.yml` on `main` at
  `5365536`,** taking each intent's last recorded `auto_round` and
  `auto_stopped`. A run's earlier stops aren't visible this way.
- **§64 keeps today's cap.** Its round 3 runs under the current rule; nothing
  here applies until this intent merges.
