<!-- generated-by: heraklios/spec@0.1.0 -->
# §71 spec — Record which intents must merge before another can be built (blocked_by)

Accepted intent: [intent.md](intent.md)

Written against `main` at `b549330`.

The behaviour is ported from product-advice-agent §18
(`../product-advice-agent`, commits `cc764da..3041c48`). Where this spec
quotes the source, it quotes `3041c48`. Everything below that is not in the
source is marked **(heraklios)**, with the reason.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `product-advice-agent:scripts/blockers-lib.mjs` | The pure logic, ported as is: `parseBlockers(metadata, selfId)`, `isMerged(meta)`, `blockerState(id, mainMetaOf, exists)`, `openChain(id, graph, isOpen)`, `findCycles(graph)`. |
| `product-advice-agent:scripts/queue-lib.mjs` (`blockerReport`, `blockedText`, `queueLine`, `formatQueue`, `queueData`) | The queue's text and JSON. |
| `product-advice-agent:scripts/intent-check-lib.mjs` (`checkBlockers`) and `check-intent.mjs` | The check:intent FAIL, with state read from `main` by the CLI. |
| `product-advice-agent:scripts/session-io.mjs` (`readBlockers`) and `spawn-intent.mjs` (`refuseIfBlocked`) | The spawn refusal and its messages. |
| `product-advice-agent:.claude/skills/{auto,build-plan,intent,spawn,spec}/SKILL.md`, `intents/README.md`, `intents/_templates/metadata.yml` | The wording the skills and docs gain. |
| `scripts/queue-lib.mjs:88-101` | heraklios's `queueData(entries)` today: groups only, no `problems`. |
| `tools/orchestrator/state.mjs:76-81` | The orchestrator reads `queue --json` and builds rows with `Object.entries(queue).flatMap(([group, list]) => list.map(…))`, so every top-level key is assumed to be a group of rows. |
| `tools/orchestrator/orchestrator-lib.mjs:212-231` | `autoLaunch(autoStopped, id)`: a stop that is not in `NEEDS_ANSWER` or `BY_HAND` falls through to "Click only if you have cleared that cause". |
| `tools/orchestrator/actions.mjs:38-39` | The spawn button runs `spawn-intent.mjs` through `script(…)`. |
| `intents/65-board-view-seam/metadata.yml:12`, `intents/64-vector-view/metadata.yml:12` | §65 and §64, the only prerequisites named in prose today, are merged (`209600f`, `bb782e3`). |

## Behaviour

**The record**

- **B1.** `metadata.yml` may carry a `blocked_by:` list, one item per line,
  `- <id>    <reason>`. An item means "this intent cannot be built correctly
  until that intent is merged". Related work stays in `links:`.
- **B2.** `blocked_by` is not a gate. Any agent drafting or revising an
  intent, spec or plan may write it without the owner's yes. It never
  changes, or blocks the recording of, a gate.
- **B3.** Parsing (`parseBlockers`):
  - an id that is not all digits is a **problem** (and not an item);
  - the intent's own id is a **problem**;
  - an item without a reason is valid, with a **note**;
  - ids are compared as numbers (`07` is `7`).
- **B4.** A blocker's state (`blockerState`):
  - **cleared** when `main`'s `metadata.yml` for it has a non-empty
    `merged:`, whatever any branch copy says;
  - **open** when `main` has that intent without `merged:`, or only a branch
    (or the main checkout's working tree) has it;
  - **unknown** when no intent with that id exists anywhere.
- **B5.** An intent with no `blocked_by:` key, or an empty list, behaves
  exactly as today in every script.

**It holds back building, not drafting**

- **B6. `npm run spawn -- <id>`** refuses, before creating anything (no
  worktree, no branch, no `npm ci`), when:
  - a direct blocker is open: `§<id> is blocked by §<n> (<reason>), not
    merged into main. Ship §<n> first.` (`<n>` the lowest open id; "no
    reason given" when there is none);
  - a blocker is unknown: `§<id> has a broken blocked_by record: §<n> is on
    no branch. Fix blocked_by in its metadata.yml.`;
  - the record has a problem: `§<id> has a broken blocked_by record:
    <problem>`.

  It exits non-zero. There is no override flag; `--base` is not one. An
  intent whose worktree already exists, and `--remove`, are unaffected.
- **B7. `npm run check:intent`** FAILs a branch whose intent has an open
  direct blocker (`§<id> is blocked by §<n>, which is not merged into
  main (<reason>).`), an unknown blocker, or a problem in the record. A note
  (no reason) is printed but does not fail. Blocker state is read from
  `main`, never from the branch.
- **B8. `/auto`** drafts the spec and the plan as before, then, at step 4
  before spawning, reads `blocked_by`:
  - with an open direct blocker it stops with `auto_stopped: blocked by <n>`
    (the lowest open direct id) and reports every open blocker with its
    reason;
  - with a broken record it stops with `auto_stopped: blocked_by record
    broken`;
  - its resume table gains: once every blocker is cleared or the record is
    fixed, step 4 (spawn); no new round.
- **B9. `/spawn`** relays the script's refusal and stops. A dependency is
  never a reason for `--base`; `--base` is added only when the owner asks
  for a stacked branch.

**The queue shows it**

- **B10. `npm run queue`** appends `blocked by §a, §b (§c, §d)` to an
  intent's line: its open direct blockers ascending, then in brackets the
  open ones reached through them, breadth first, each once, never itself.
  Nothing is appended when no direct blocker is open.
- **B11.** Under a final **Problems** heading it lists each broken record
  (`§<id>: <problem>`), each unknown blocker (`§<id>: blocked_by names
  §<n>, which is on no branch.`) and each cycle once (`blocked_by cycle:
  §15 -> §17 -> §15.`, starting at its smallest id). No heading when there
  are none.
- **B12. `npm run queue -- --json`** gives each entry `blocked_by: [{id,
  reason}]` (ids as numbers) and `blocked_by_open: [<direct…>,
  <further…>]`, and the top level gains `problems: [<line>…]`.

**The orchestrator (heraklios)**

The source has no orchestrator; these rules are heraklios's own.

- **B13.** The dashboard's rows are built from the queue's groups only. The
  new top-level `problems` key is not a group: it never becomes rows, and
  when non-empty its lines show once above the intent list.
- **B14.** A row with a non-empty `blocked_by_open` shows `blocked by §a,
  §b (§c)` (the same text as B10), with each open blocker's reason on hover
  where the row's own `blocked_by` has it.
- **B15.** The spawn button stays enabled: its click runs the script, and
  the script's refusal (B6) is shown as the action's error, as any other
  script failure is today. The orchestrator holds no blocker rule of its
  own.
- **B16.** The Auto button resumes `blocked by <n>` and `blocked_by record
  broken` (neither needs an answer the click cannot carry). Its confirm says
  the run spawns only if every blocker is merged into `main`, or the record
  is fixed, and otherwise stops again.

**The words**

- **B17.** The skills say it: `/intent` records `blocked_by` for each hard
  prerequisite (asking in its question round when the material hints at
  one) and says what it recorded; `/spec` and `/build-plan` add one they
  find and say so in their report; `/spawn` per B9; `/auto` per B8.
- **B18.** `intents/README.md` ("Layout" and "Who edits what"), the metadata
  template (a commented `blocked_by:` block after `links:`), `CLAUDE.md`
  ("How work flows" and "Parallel sessions") and `sdlc.md` describe it.

## Interpretations

No rulebook passage is involved. Three port decisions, each a comment at its
site:

- **I1. Vitest, not node:test.** The source's tests use `node:test`,
  `scripts/expect.mjs` and `each()`. heraklios's script tests run on Vitest,
  so each is converted to Vitest with `it.each`, keeping every case and
  assertion. `expect.mjs` is not added.
- **I2. No backfill.** The source's `30911f1` backfilled §14, §15 and §17
  and `blockers-backfill.test.mjs` pins them. Here every prose prerequisite
  (§64, §65) is merged, so a record would be cleared at once. Neither the
  records nor that test are ported.
- **I3. `queue --json` gains a non-group key** (B12, as the source does).
  heraklios's orchestrator iterates every key as a group (`state.mjs:81`),
  so it is changed to skip `problems` (B13), rather than the JSON changing
  shape from the source.

## Acceptance criteria

- **AC1 (B3, B4).** `scripts/blockers-lib.test.mjs`: every source case,
  in Vitest — parse (digits, self, missing reason, leading zeros, empty and
  absent key), `isMerged` (empty `[]`, blank), `blockerState` (main merged,
  main not merged, branch-only, nowhere, branch says merged but main
  doesn't), `openChain` (ordering, further breadth-first, no self, cleared
  links skipped), `findCycles` (each once, canonical start).
- **AC2 (B7).** `scripts/intent-check-lib.test.mjs` and
  `scripts/check-intent.test.mjs`: open → FAIL with the message; cleared →
  PASS; unknown → FAIL; non-digit and self → FAIL; no reason → note only;
  no key → result unchanged from today (the existing cases stay green
  untouched).
- **AC3 (B10-B12).** `scripts/queue-lib.test.mjs` and
  `scripts/queue.test.mjs`: the line suffix with direct and further ids,
  nothing when all are cleared, the Problems block (broken, unknown, cycle),
  the JSON fields and top-level `problems`, an intent that exists only on a
  branch counted as open.
- **AC4 (B6).** `scripts/spawn-intent.test.mjs`: each refusal message and a
  non-zero exit with no worktree or branch created, against a temporary git
  repository; a cleared blocker spawns as before.
- **AC5 (B13-B16).** `tools/orchestrator/*.test.mjs`: the rows ignore
  `problems` and the page state carries it; a row's blocked text; `autoLaunch`
  allows `blocked by 3` and `blocked_by record broken` with the B16 confirm.
- **AC6 (B5).** `npm run verify` green, and `npm run queue` output on
  today's `main` is unchanged apart from intents that declare `blocked_by`
  (none today). `npm run check:intent` on §66's and §70's branches gives the
  same verdict as before.
- **AC7 (B8, B9, B17, B18).** The review reads the skill and doc changes
  against the source's wording (pass 1).
- **AC8 (B13-B16).** Live check (owner): with a scratch intent that declares
  an open `blocked_by`, the orchestrator row shows it, spawn shows the
  refusal and creates nothing, Auto's confirm says what B16 says; a scratch
  cycle shows under the page's problems line.

## Non-functional

- **Engine/presentation split:** not involved; no `src/` change.
- **Save format:** unchanged.
- **Undo boundaries:** unchanged.
- **AI / harness:** unchanged.
- **Where the logic lives:** `scripts/blockers-lib.mjs` is pure (no git, no
  fs). Reading `main` stays in `check-intent.mjs`, `queue.mjs` and
  `session-io.mjs`. The orchestrator only displays and relays.
- **Tier:** Reviewed (`.claude/skills/**`). Live check owed for B13-B16
  (`REVIEW-POLICY.md` → "Live checks", rule 3).

## Out of scope

- The load check counting finished experiments (store-sales-forecast §12).
- §69's round cap; the five-session limit.
- `npm run sessions` showing blockers.
- Backfilled records (I2).
- Disabling the spawn button for a blocked row (B15).

## Assumptions I made

- **The orchestrator display stays in this intent** (the intent's open
  question, the owner's proposal): its data is already in `queue --json`.
- **Spawn stays enabled in the orchestrator** (B15) so that the only
  refusal is the script's, as the intent says ("it refuses through the
  scripts, with no rule of its own").
- **The page's problems line** (B13) is the least the page can do with the
  new key; without it a cycle would be invisible there.
- **Running intents are unaffected** (B5, AC6): §66 and §70 declare no
  `blocked_by`, so their branches, check:intent verdicts and the running
  `/auto 66` see no change. If this merges while §66 is mid-run, §66's
  `/auto` skill text changes under it only at step 4, which §66 has passed.
