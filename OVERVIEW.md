# Héraklios overview

A short orientation, edited rarely and by the owner. It replaces the root
plan file that carried a hand-kept queue (§47); nothing here tracks status.

- **The queue** (what is in flight, queued, shipped, stopped, with type,
  status, gates and merge hash) is generated: `npm run queue`. It reads
  each `intents/<id>-<slug>/metadata.yml` (from the intent's branch while
  that branch is unmerged, else from `main`). `npm run queue -- --next-id`
  prints the id a new intent takes. Nobody edits a queue by hand.
- **Work items since §26** live in `intents/<id>-<slug>/`, see
  [`intents/README.md`](intents/README.md). A new idea is a draft intent
  (`/intent`), which the queue lists under Queued. Sections §1–§25 keep their
  old form in `plan-history.md`; nothing is migrated retroactively.
- **The runbook** (agent workflow, launch hazards, the `node_modules` and
  `npx tsc` warnings) is [`docs/runbook.md`](docs/runbook.md), sections 1 and 4.
- **Code comments that say `plan.md §N`** predate this file: that section is
  in [`plan-history.md`](plan-history.md) under the same number.

### Archiving to `plan-history.md`

Finished work's postmortems live in [`plan-history.md`](plan-history.md).
When a pre-§26 style section is done (shipped and its postmortem written, or
abandoned), cut the whole `## N. ...` section (and its `###` subsections)
and append it to the end of `plan-history.md` verbatim, keeping its section
number so links elsewhere (commit messages, agent files, the History Map
below) don't point at the wrong content. Archiving is a cut, not an edit:
fix stale facts before moving it, never after. Then add or update a line in
the History Map below.

## Current Snapshot


**Shipped:** Feature A (cavalry charges + phalanx), AI Stage 1 (headless
action layer), AI Stage 2a (fuzz harness), start-a-new-game-anytime, move
through friendly units, combat reporting detail, cascading push
([§12](plan-history.md#12-cascading-push-when-a-unit-cannot-retreat), merged `3c766d6`),
[§9.1](plan-history.md#91-post-combat-advance-ignores-terrain-restrictions) advance
terrain (merged `6172f2f`), Stage 2b drift extraction
([§6.7](plan-history.md#67-the-elephant-problem-stage-2-split), merged `7544a96`), and AI
Stage 3 — the `HeuristicAgent`
([§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred), merged `a2a1329`),
[§15](plan-history.md#15-live-defect-ranged-attacks-resolve-at-zero-attack-force)'s ranged
attack force (merged `272bcf0`), Stage 2c — elephants in the harness
([§6.7](plan-history.md#67-the-elephant-problem-stage-2-split), merged `0e54b59`), which
completes Stage 2 and fixed a live defect in hotseat play on the way (a
drifting elephant could enter marsh), and
[§13](plan-history.md#13-hex-coordinate-tooltip)'s hex coordinate tooltip (merged
`62892c3`), **Stage 4 — the AI's seat UI and save format v2 (merged
`556fbf8`), which finally gives the computer opponent a seat**
([§6.12](plan-history.md#612-stage-4-outcome)), **[§9.2](plan-history.md#92-endgamebytimelimit-is-never-called) —
the endgame: clock limit, round limit, and the Board's "End game" button
(merged `836c70f`, +4 MEDIUM review findings fixed, +a mid-merge design
revision — see [§9.2.4](plan-history.md#924-outcome))**, which closed the plan's last open
live defect, and **[§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means) —
per-hex "A"/"B"/"C" labels on the advance/exchange prompts (merged
`ceb106a`)**, presentation-only, and **[§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred)
Stage 3b — the shallow-lookahead fourth `HeuristicAgent` tier, labelled
"AI — cautious" (merged `f4573d3`, after six rounds of adversarial review
— two early rounds found and fixed real behavioral bugs, the last three
found none — see [§6.18](plan-history.md#618-stage-3b-sixth-review-outcome--pass)
for the full record and why the review cycle stopped there)**, which
completes plan-history.md's Stage 3 AI roadmap.
and **[§18](plan-history.md#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it)
— the ramming bonus fix**, which closed the plan's last open live defect: a
bonus now *extends* the printed success range instead of narrowing it, per
the rulebook's own general sentence rather than the one worked example the
old reading had been fitted to (see
[§18.5](plan-history.md#185-outcome) for the outcome and the four review
findings on top of it), and **[§17](plan-history.md#17-manual-step-by-step-naval-movement)
— manual step-by-step naval movement** (merged `3dee4e8`), replacing
destination-click naval movement with hex-by-hex manual control and
reworked Turn-button glyphs, after a FAIL/fix/PASS review cycle (one HIGH
defect: a forward click could silently auto-rotate the ship onto a
differently-faced ramming contact and overcharge movement — see
[§17.6](plan-history.md#176-outcome) for the outcome and the review
findings), and **[§20](plan-history.md#20-live-defect-a-unit-that-starts-its-move-already-inside-an-enemy-zoc-cant-move-at-all)
— the enemy-ZOC exit fix** (fixed `9d7b38a`, reviewed PASS, pushed to
`origin/main`), which lets a unit that starts in enemy ZOC leave that
specific ZOC instead of being frozen outright, and **[§23](plan-history.md#23-live-defect-elephant-drift-hides-the-combat-report)
— the elephant drift combat-log fix**, which keeps the original attack's
force/ratio/die/result report visible when an elephant is forced to drift
and gives drift-trample combats the same full combat report, and
**[§22](plan-history.md#22-naval-movement-show-remaining-range-and-let-a-distant-hex-auto-path-there-alongside-manual-stepping)
— naval movement range indicator + click-to-autopath** (merged `b02a96c`,
1 MEDIUM review finding fixed), which adds a remaining-movement-points badge
and a click-to-autopath option on every reachable hex alongside §17's manual
single-step click, without touching or reopening it, and
**[§21](plan-history.md#21-elephant-drift-pause-between-steps-and-show-the-drift-direction-on-the-map)
— elephant drift pause + direction arrow** (merged `1d6666f`, four rounds of
adversarial review, all chasing the same underlying "fall through instead
of returning" bug class out of `engine/drift.ts`'s frame-stack state
machine — see [§21.4](plan-history.md#214-outcome) for the full round-by-round
record), which pauses a human seat's own drift cascade step by step behind
a "Continue" affordance while staying a byte-identical no-op for headless/
AI-vs-AI play, and
**[§25](plan-history.md#25-live-defect-save-load-panel-labels-overlap-action-buttons)
— Save / Load panel label overlap**, which bounds long save descriptions so
they cannot draw underneath the row's action buttons, and, implemented in
parallel and merged together, **[§24](plan-history.md#24-turn-status-should-name-the-side-and-unit-color)
— turn status side + color** (merged `74a169a`, reviewed PASS, no findings),
which adds the seat's map edge and unit-color name to the turn banner, and
**[§19](plan-history.md#19-the-lookahead-tier-is-blind-to-ramming-and-that-now-costs-measurably-more)
— pricing ramming in the lookahead tier's reply-threat probe** (merged
`10a7c21`, reviewed PASS with one open MEDIUM finding — see below), which
closes most, but not provably all, of the AI-tuning gap §18 opened.

## Shipped before §26

Static: these items predate `metadata.yml`, so the generated queue cannot
show them, and the list never changes again. Everything since §26 is in
`npm run queue`.

| Item | Merge |
| --- | --- |
| Feature A — cavalry charges + phalanx | `3b086d1` |
| [§6.3](plan-history.md#63-committed-scope-stages-12) Stage 1 — headless action layer | `9cb7ed7` |
| [§7](plan-history.md#7-start-a-new-game-at-any-time) start a new game at any time | `30c23e7` |
| [§6.3](plan-history.md#63-committed-scope-stages-12) Stage 2a — fuzz harness (+2 engine bugs it found) | `469f84a` |
| [§8](plan-history.md#8-bug-units-cannot-move-through-friendly-units) move through friendly units | `e87c55c` |
| [§11](plan-history.md#11-combat-reporting-detail) combat reporting detail | `12e1bf6` |
| [§12](plan-history.md#12-cascading-push-when-a-unit-cannot-retreat) cascading push | `3c766d6` |
| [§9.1](plan-history.md#91-post-combat-advance-ignores-terrain-restrictions) advance terrain | `6172f2f` |
| [§6.7](plan-history.md#67-the-elephant-problem-stage-2-split) Stage 2b — drift extraction | `7544a96` |
| [§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred) Stage 3 — `HeuristicAgent` (+1 engine defect it found) | `a2a1329` |
| [§15](plan-history.md#15-live-defect-ranged-attacks-resolve-at-zero-attack-force) ranged attack force (+1 wedged-board defect, +2 review findings) | `272bcf0` |
| [§6.7](plan-history.md#67-the-elephant-problem-stage-2-split) Stage 2c — elephants in the harness (+1 live marsh defect, +1 HIGH/3 MEDIUM review findings) | `0e54b59` |
| [§13](plan-history.md#13-hex-coordinate-tooltip) hex coordinate tooltip | `62892c3` |
| [§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred) Stage 4 — AI seat UI + save format v2 (+3 review defects) | `556fbf8` |
| [§9.2](plan-history.md#92-endgamebytimelimit-is-never-called) endgame: clock, round limit, End game button (+4 MEDIUM review defects, +a mid-merge design revision) | `836c70f` |
| [§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means) label the units a choice dialog means | `ceb106a` |
| [§6.4](plan-history.md#64-stage-3-shipped-stage-4-deferred) Stage 3b — shallow lookahead tier (6 review rounds; see [§6.18](plan-history.md#618-stage-3b-sixth-review-outcome--pass)) | `f4573d3` |
| [§18](plan-history.md#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it) ramming bonus extends the table (+4 review findings, +1 follow-up: [§19](plan-history.md#19-the-lookahead-tier-is-blind-to-ramming-and-that-now-costs-measurably-more)) | see [§18.5](plan-history.md#185-outcome) |
| [§17](plan-history.md#17-manual-step-by-step-naval-movement) manual step-by-step naval movement (FAIL/fix/PASS; 1 HIGH + 2 MEDIUM fixed, 4 LOW doc follow-ups still owed) | `3dee4e8` |
| [§20](plan-history.md#20-live-defect-a-unit-that-starts-its-move-already-inside-an-enemy-zoc-cant-move-at-all) enemy-ZOC exit fix | `9d7b38a` |
| [§23](plan-history.md#23-live-defect-elephant-drift-hides-the-combat-report) elephant drift combat-log fix | see [§23.4](plan-history.md#234-outcome) |
| [§22](plan-history.md#22-naval-movement-show-remaining-range-and-let-a-distant-hex-auto-path-there-alongside-manual-stepping) naval range indicator + click-to-autopath (+1 MEDIUM review finding fixed) | `b02a96c` |
| [§21](plan-history.md#21-elephant-drift-pause-between-steps-and-show-the-drift-direction-on-the-map) elephant drift pause + direction arrow (4 review rounds; see [§21.4](plan-history.md#214-outcome)) | `1d6666f` |
| [§25](plan-history.md#25-live-defect-save-load-panel-labels-overlap-action-buttons) save/load labels overlap buttons | see [§25.4](plan-history.md#254-outcome) |
| [§24](plan-history.md#24-turn-status-should-name-the-side-and-unit-color) turn status side + color | `74a169a` |
| [§19](plan-history.md#19-the-lookahead-tier-is-blind-to-ramming-and-that-now-costs-measurably-more) lookahead tier prices ramming threats (1 open MEDIUM follow-up; see [§19.5](plan-history.md#195-outcome)) | `10a7c21` |

## Carried over

Two open items, from the old Backlog Map. Neither is an intent yet; the owner
turns one into a draft intent with `/intent` when he picks it up.

- **Follow-up:** [§19.5](plan-history.md#195-outcome)'s open MEDIUM finding —
  `enemyRamThreatAgainstUnit` prices a ram threat using the enemy ship's
  current `movementLeft` rather than its full per-turn allowance, so it
  misses threats from ships that already spent movement earlier in the round.
  Minimal fix: clone with full movement before probing, or document the
  staleness explicitly. Small enough to fold into whoever's next in
  `heuristicAgent.ts`.
- **Owed:** a manual browser pass over §16's per-hex choice labels, §17's
  naval movement controls, §22's range indicator/click-to-autopath, §21's
  drift pause/direction arrow, §24's status banner wording, §25's long-save
  panel layout, and Stage 4's still-outstanding one
  ([§6.12](plan-history.md#612-stage-4-outcome)). Also owed: §17's 4 LOW
  doc-staleness findings (`README.md:456-457`, `src/scenes/BoardScene.ts:1344`,
  `README.md:461`, `src/scenes/BoardScene.ts:1338-1339` describe pre-`cfe5e75`
  click/highlight behavior; doc-only, see
  [§17.6](plan-history.md#176-outcome)'s correction note).

## History Map

Full history — every shipped feature's design brief, postmortem, and
review findings — now lives in **[`plan-history.md`](plan-history.md)**.
This map is just a fast index into it:

- **Feature A archive:** [§2.1](plan-history.md#21-feature-a-launch-goal), [§3](plan-history.md#3-feature-cavalry-charges--the-phalanx-restriction),
  and [§5](plan-history.md#5-outcome). It remains there as the first full implement/review
  run and as evidence for adversarial review.
- **AI foundation history:** [§6.6](plan-history.md#66-stage-1-outcome),
  [§6.8](plan-history.md#68-stage-2a-outcome), [§6.9](plan-history.md#69-stage-3-outcome),
  [§6.11](plan-history.md#611-stage-2c-outcome), [§6.12](plan-history.md#612-stage-4-outcome),
  [§6.13](plan-history.md#613-stage-3b-outcome),
  [§6.14](plan-history.md#614-stage-3b-second-review-outcome),
  [§6.15](plan-history.md#615-stage-3b-third-review-outcome),
  [§6.16](plan-history.md#616-stage-3b-fourth-review-outcome),
  [§6.17](plan-history.md#617-stage-3b-fifth-review-outcome), and
  [§6.18](plan-history.md#618-stage-3b-sixth-review-outcome--pass) — Stage
  3b's full review history, five fails then a PASS, shipped `f4573d3`.
- **Shipped feature notes:** [§7](plan-history.md#7-start-a-new-game-at-any-time),
  [§8](plan-history.md#8-bug-units-cannot-move-through-friendly-units),
  [§9](plan-history.md#9-live-defects-found-by-stage-2a) (endgame + advance-terrain defects),
  [§11](plan-history.md#11-combat-reporting-detail),
  [§12](plan-history.md#12-cascading-push-when-a-unit-cannot-retreat),
  [§13](plan-history.md#13-hex-coordinate-tooltip),
  [§14](plan-history.md#14-decomposing-boardscenets-for-parallel-work) (proposed, never started),
  [§15](plan-history.md#15-live-defect-ranged-attacks-resolve-at-zero-attack-force),
  [§16](plan-history.md#16-identify-which-unit-a-choice-dialog-means),
  [§18](plan-history.md#18-live-defect-ramming-bonus-narrows-the-table-instead-of-extending-it)
  (the ramming bonus — read [§18.4](plan-history.md#184-why-this-got-missed-and-why-it-took-three-tries-to-find)
  and [§18.5](plan-history.md#185-outcome) together: the same "fitted to the
  one example available" failure, once in the original bug and once in the
  fix's own postmortem), and
  [§17](plan-history.md#17-manual-step-by-step-naval-movement) (manual
  step-by-step naval movement — [§17.6](plan-history.md#176-outcome) has
  the FAIL/fix/PASS review cycle and a process note on a worktree-lock
  snag worth reading before the next multi-round fix cycle), and
  [§20](plan-history.md#20-live-defect-a-unit-that-starts-its-move-already-inside-an-enemy-zoc-cant-move-at-all)
  (enemy-ZOC exit fix, shipped `9d7b38a`, reviewed PASS in the coordinating
  Codex session), and
  [§23](plan-history.md#23-live-defect-elephant-drift-hides-the-combat-report)
  (elephant drift combat-log fix), and
  [§22](plan-history.md#22-naval-movement-show-remaining-range-and-let-a-distant-hex-auto-path-there-alongside-manual-stepping)
  (naval range indicator + click-to-autopath, shipped `b02a96c` — read
  [§22.6](plan-history.md#226-outcome) for the review round that moved the
  click-guard logic out of `BoardScene.ts` and into testable engine code),
  and [§21](plan-history.md#21-elephant-drift-pause-between-steps-and-show-the-drift-direction-on-the-map)
  (elephant drift pause + direction arrow, shipped `1d6666f` — read
  [§21.4](plan-history.md#214-outcome) for all four review rounds; the same
  "fall through instead of returning" bug recurred three times before a
  self-audit plus an independent from-scratch mutation-site enumeration
  finally closed it out), and
  [§25](plan-history.md#25-live-defect-save-load-panel-labels-overlap-action-buttons)
  (Save / Load panel label overlap, fixed `cc29f1f`, reviewed PASS; see
  [§25.4](plan-history.md#254-outcome) for the residual manual visual-check
  note), and
  [§24](plan-history.md#24-turn-status-should-name-the-side-and-unit-color)
  (turn status side + color, shipped `74a169a`, reviewed PASS with no
  findings), and
  [§19](plan-history.md#19-the-lookahead-tier-is-blind-to-ramming-and-that-now-costs-measurably-more)
  (lookahead tier prices ramming threats, shipped `10a7c21` — read
  [§19.5](plan-history.md#195-outcome) for the review's open MEDIUM finding:
  the new ram-threat term reads a stale `movementLeft`, so it undercounts
  threats from enemy ships that already spent movement earlier in the
  round). §19 and §24 were implemented and reviewed in parallel by
  independent agent pairs, then merged back to back with no conflicts.

> **Line citations were re-verified against `main` on 2026-08-07** (at
> `3b15577`), after ~440 lines of drift in `BoardScene.ts` had rotted most of
> them. `tsc --noEmit` clean, `vitest run` 272 passed / 1 skipped (the
> permanent Stage-2b elephant skip). Anything cited in `plan-history.md` is
> accurate as of that commit and will rot again — see
> [§14.1](plan-history.md#141-first-a-correction-the-constraint-is-partly-self-imposed) item 3.

