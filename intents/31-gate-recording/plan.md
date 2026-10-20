<!-- generated-by: heraklios/intent@0.1.1 -->
# §31 plan — Who records a gate, and how

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Make the gate rule the owner set on 2026-10-20 (an agent records a gate
on request; a "yes" is enough) the one written rule. Give agent-recorded
gates a parseable `by-agent` marker, read through one shared parser by
every script that reads a gate. Make bad gate values loud: a FAIL in
`check:intent`, a "Metadata problems" section in `sdlc:scan`. Then
re-mark the existing gates the record shows an agent typed (spec B1–B11).

## Spec change this plan needs — approve with the plan

1. **B6 has a third reader the spec doesn't name.** `npm run sessions`'
   gate column (`scripts/session-lib.mjs:183-185`, `isRecorded`) tests
   `GATE_DATE_RE` by hand, just like `check:intent`. Without this change,
   `npm run sessions` would show every `by-agent` gate as missing (`-`).
   Proposed: B6's "every check that reads a gate goes through one shared
   function" includes `session-lib.mjs`, and `GATE_DATE_RE` stops being
   exported. I'll amend `spec.md` B6 in the first commit.

## Risks

- **§31's own branch versus its own rule.** Until subtask 1 lands,
  `check:intent` reads `2026-10-20 by-agent` as "not recorded". So B9's
  re-marking (including §31's own gates) happens only after the parser
  change, in a later commit. The plan gate is recorded as a bare date.
- **Tests that pass whatever the code does** (§26–§32 reviews). Every
  behavioural line gets a named test in "Tests" below. `/review` pass 4
  mutates each one.
- **A stricter `check:intent` breaking branches in flight.** B7 turns a
  malformed gate from "not recorded" into a FAIL. It only reads the
  checked branch's own intent, and today no `metadata.yml` holds a
  malformed value (verified below), so nothing in flight breaks.
- **`sdlc:scan` has no tests today**, and logic added inline would stay
  untested. The new checks go in a new `scripts/scan-lib.mjs`, unit-tested;
  `sdlc-scan.mjs` only wires them in.
- **Option injection through `merged:`.** The scan passes the value to
  `git`, so a value starting with `-` would be read as an option. Check it
  against `^[0-9a-f]{7,40}$` first. Anything else is a problem and never
  reaches git.
- **The lint cap (21).** The new module and tests must add no warning.
  `intent-check-lib.test.mjs` is 333 lines today, and test files already
  carry the size overrides.
- **Doc drift across six documents** (B10), the failure §32's round 1
  found. AC6's grep is run before hand-over, not left to review.

## Verified against the codebase

Re-read on `main` at `eb2c4ce`:

- `scripts/intent-check-lib.mjs:16-22` — `TYPE_RULES[*].gates`
  (`intent_accepted`, `spec_accepted`, `plan_approved` by type).
- `scripts/intent-check-lib.mjs:45-69` `parseMetadata`, `:72-86`
  `stripComment` — a `#` comment is dropped, so `2026-10-20 by-agent    # …`
  parses to `2026-10-20 by-agent`. An empty value parses to `[]`.
- `scripts/intent-check-lib.mjs:88-89` — `export const GATE_DATE_RE =
  /^\d{4}-\d{2}-\d{2}$/`.
- `scripts/intent-check-lib.mjs:146-156` — the gates-before-code loop:
  not a date → a note while only artefacts change, an error once `src/`
  changes.
- `scripts/intent-check-lib.mjs:171-186` `checkLiveCheck` — the one place
  a malformed gate (`live_checked`) is already an error.
- `scripts/session-lib.mjs:5` imports `GATE_DATE_RE`; `:173-185`
  `gateSummary` / `isRecorded`; tested at `session-lib.test.mjs:242-245`.
- `scripts/sdlc-scan.mjs:12` imports `parseMetadata`; `:40-60` builds
  `intents[]` (`merged` as a raw string); `:88-95` `mergedInWindow` catches
  the git failure and returns `false`; `:130-160` the text/JSON report.
- `vitest.config.ts` include covers `scripts/**/*.test.mjs`, so a new
  `scripts/scan-lib.test.mjs` runs under `npm test`.
- `package.json:12` — `eslint . --max-warnings 21`.
- Gate values on `main` today: every recorded gate is a bare
  `YYYY-MM-DD`; no malformed value; `merged:` holds a hash in §26, §27,
  §28, §30 and §32 (§32 corrected in `eb2c4ce`).
- Documents B10 changes: `intents/README.md` "Gates" / "Who edits what"
  (`:60-95`); `REVIEW-POLICY.md` → "Live checks" "**Who records it.**";
  `CLAUDE.md` → "How work flows"; `sdlc.md:22`, `:32`, `:75`;
  `.claude/skills/intent/SKILL.md:6` (version 0.1.1), `:16-17`, `:76`;
  `.claude/skills/review/SKILL.md:6` (version 0.1.3), `:90`;
  `.claude/agents/heraklios-implementer.md:36`;
  `.codex/agents/heraklios-implementer.toml:9`;
  `intents/_templates/metadata.yml` gate comment.
- Highest § used: §32.

## Subtasks

Branch `feat/31-gate-recording` from `main`, through `npm run spawn -- 31`
(worktree `../heraklios-wt/31-gate-recording`, port 5231, unused here:
nothing under `src/`).

1. **Shared gate parser.** Amend `spec.md` B6 (the spec change above). In
   `intent-check-lib.mjs`, add `parseGate(value)` →
   `{ state: 'empty' } | { state: 'recorded', date, by: 'owner' | 'agent' } |
   { state: 'malformed', value }` and `GATE_FIELDS` (the four gate keys).
   `GATE_DATE_RE` becomes module-private. The gates-before-code loop,
   `checkLiveCheck` and `session-lib.mjs`'s `isRecorded` all use
   `parseGate`. Tests (AC1) first.
2. **`check:intent` FAILs a malformed gate** (B7, AC2). Every key in
   `GATE_FIELDS` present in `metadata.yml` is checked, not just the type's
   gates: malformed → error naming the field and the two accepted forms,
   whether or not code changed. The live-check error text merges into it.
3. **Scan checks and shares** (B7, B8, AC3, AC4). New
   `scripts/scan-lib.mjs`:
   - `metadataProblems(intents, isCommit)` → `[{ id, field, value, why }]`
     for an unresolvable or non-hex `merged:` and any malformed gate value;
     `isCommit` is injected so tests need no git.
   - `gateShares(intents)` → `{ [field]: { owner, agent } }`.

   `sdlc-scan.mjs` wires them in: the "Metadata problems" section printed
   first ("none" when empty), `problems` and `gateShares` in the JSON, a
   share line per gate, and `mergedInWindow` reusing the same `isCommit`.
   Exit code stays 0.
4. **Re-mark history** (B9, AC5) — only after subtasks 1–3 are committed.
   Add `by-agent` to the gates in B9's table: §26, §27, §30, §31 (both
   gates, plus `plan_approved`) and §32 (four gates). §30 also gets
   `# typed in Claude's probe commit 6de3853; no request on record`. §28 is
   unchanged; no dates change. Run `npm run sdlc:scan` and check AC3/AC4's
   figures by hand.
5. **Documents** (B10, B11, AC6). Write the rule in full in
   `intents/README.md` → "Who edits what", and add the one-sentence
   pointers listed in B10. `/intent` → 0.1.2 and `/review` → 0.1.4, version
   and stamp line. Run AC6's grep and paste its output into Progress.
6. **Hand over.** `npm run verify`, `npm run check:intent`, `npm run
   sdlc:scan` (paste the problems and share sections), Progress,
   `status: in-review`.

## Tests

| Behaviour | Test | Fails if mutated |
| --- | --- | --- |
| B6 bare date → owner | `parseGate('2026-10-20')` → recorded, owner | the `by` default flips |
| B6 token → agent | `parseGate('2026-10-20 by-agent')` → recorded, agent | the token regex is dropped or loosened |
| B6 empty | `parseGate([])`, `parseGate(undefined)` → empty | empty is read as malformed |
| B6 malformed | `yes`, `TBD`, `2026-1-2`, `2026-10-20 by-claude`, `2026-10-20by-agent`, `by-agent` → malformed | the regex loses an anchor or the space |
| B6 gates-before-code | `checkChange` with all gates `by-agent` + `src/` diff → no error | the loop still uses the bare-date regex |
| B7 malformed FAIL | `plan_approved: yes` with no code change → error naming `plan_approved` | the malformed branch falls back to a note |
| B7 live_checked | existing `live checks` tests stay green; `live_checked: 2026-10-20 by-agent` + `owed` → no error | `checkLiveCheck` keeps its own regex |
| B6 sessions | `gateSummary` with `by-agent` gates → `I·S·P` | `isRecorded` keeps `GATE_DATE_RE` |
| B7 scan merged | `metadataProblems` with `merged: '2026-10-20'` → one problem (non-hex); with `merged: 'abc1234'` and `isCommit → false` → one problem (unresolvable); with `isCommit → true` → none | either check removed |
| B7 scan gates | a malformed `intent_accepted` → one problem | gate values not checked |
| B8 shares | three intents (bare, `by-agent`, empty) → `{owner:1, agent:1}` for that field | empty counted, or agent counted as owner |
| AC4 on real data | manual: `npm run sdlc:scan` after B9 → `intent_accepted` owner 1 / agent 5; `live_checked` owner 1 / agent 1 | recorded in Progress |

AC4's figures in the spec count §31 among the agent-recorded
`intent_accepted` gates (5 agent: §26, §27, §30, §31, §32). The manual run
confirms the real numbers and Progress records them. If they differ from
the spec, the spec gets corrected, not the data.

## Validation

- `npm run verify` green; lint warnings ≤ 21; Vitest count up by the new
  `parseGate`, `checkChange`, `gateSummary` and `scan-lib` tests only.
- `npm run check:intent` PASS on the branch (with its own gates
  `by-agent` after subtask 4).
- `npm run sdlc:scan`: "Metadata problems: none" on the branch, and §32
  counted in "Quality per review tier".
- Manual browser check: none. No `src/` change, so no live check is owed
  by path.

## Assumptions I made

- `parseGate`, `GATE_FIELDS`, `scan-lib.mjs`, `metadataProblems` and
  `gateShares` are working names; the implementer may rename them in
  subtask 1 and say so in Progress.
- A non-hex `merged:` is a problem even when `git` could resolve it as a
  ref name (a branch called `main`, say): the template asks for a hash.
- `/intent`'s version goes 0.1.1 → 0.1.2 and `/review`'s 0.1.3 → 0.1.4
  (B11), each with its stamp line. `/grid` and `/spawn` are unchanged.
- The spawned session can record §31's own gates on your "yes" (spec
  B2), once the plan is approved.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->

### 2026-10-20 — all subtasks

- Commits: parser + FAIL on malformed gates; `scan-lib.mjs` and scan wiring; documents and §31's own gates; B9 re-marking of §26, §27, §30, §32 (on the owner's "go ahead").
- `npm run verify` green (633 tests; scripts tests 113, up by the `parseGate`, `checkChange`, `gateSummary` and `scan-lib` tests); lint cap unchanged at 21. `check:intent` PASS.
- Divergences: the old "gates must hold a date" tests now expect the "must be empty, a date…" error for malformed values (B7); an empty gate keeps the "Code changed before the gate" error. `sdlc.md:75` ("Approve and merge — your gate") left as is: it is the change-approval gate, unchanged by the spec.
- AC3/AC4 manual `npm run sdlc:scan`: Metadata problems: none. Gates (owner / agent): intent_accepted 1 / 5; spec_accepted 1 / 2; plan_approved 1 / 4; live_checked 1 / 1. Matches B9's table.
- AC6 grep (`never record a gate|Who records it|every gate in`, outside intents/3x and plan-history): only `REVIEW-POLICY.md:96` "Who records it", new wording.
