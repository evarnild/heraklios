<!-- generated-by: heraklios/intent@0.1.1 -->
# §28 spec — Live checks for untested behaviour, and the agent-merge rule

Accepted intent: [intent.md](intent.md)

The spec decides **what** gets built. This one has no rulebook side; its
sources are the process documents it amends.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `CLAUDE.md:61`, `CLAUDE.md:91` | today's merge rule: "done by the owner, never by an agent" |
| `sdlc.md:66-68` | today's contradicting line: "You can ask Claude to do the merge" |
| `REVIEW-POLICY.md` → Tiers, Prerequisites | Attested allowed only where a meaningful test suite exists; scenes/ui/map-editor are Attested by path |
| `REVIEW-POLICY.md` → "The report" | the `review.md` header fields `/grid` and `check:intent` parse |
| `intents/README.md` → Gates | gates are dated fields in `metadata.yml`, recorded by the owner |
| `intents/27-parallel-sessions/review.md` → Not checked | the worked example: "hooks firing in a real session" was owed and done outside the process |
| `src/ui/testMode.ts` | the Menu shortcuts that put a populated board up without an army build — what a live check uses |

## Behaviour

### The merge rule

- **B1 — One rule, stated the same everywhere.** An agent merges into
  `main`, pushes, deletes a branch or removes a worktree (`npm run spawn --
  <id> --remove`) **only when the owner explicitly asks for that action in
  the current conversation**. A request covers the change it names; it does
  not carry over to the next change. Never on the agent's own initiative.
  `CLAUDE.md`, `sdlc.md`, `AGENTS.md` and the implementer/reviewer agent
  definitions (Claude and Codex) say this, in the same words where they say
  anything about merging.
- **B2 — Preconditions an agent checks before merging on request.** It
  refuses, and says which one failed, unless all hold:
  1. `review.md`'s current verdict is `attest` or `escalate`, and its
     `reviewed-commit` is the branch's current HEAD (no unreviewed commits on
     top);
  2. `npm run check:intent <branch>` reports PASS (or ROUTE with the reason
     already stated in `review.md`);
  3. if a live check is owed (B3), `live_checked:` is recorded (B5).

  After merging it runs `npm run verify` on `main` and does the bookkeeping
  (`merged:`, `status: done`, the `plan.md` row), as for §26 and §27.

### Live checks

- **B3 — When a live check is owed.** `/review` sets it owed when any of:
  1. the diff touches `src/scenes/**`, `src/ui/**`, `src/map-editor/**`,
     `index.html`, `map-editor.html` or `vite.config.ts` (behaviour no test
     exercises);
  2. the diff touches `.claude/settings.json` (hooks run in every session);
  3. a "Not checked" item is runtime behaviour that only a live run can show
     — browser behaviour, hooks, a real `npm ci`, a dev-server path. The
     reviewer names which item.

  Otherwise it is `not-needed`. A change under `src/engine/**` or
  `src/data/**` alone is never owed by rule (1); it can still be owed by
  rule (3).
- **B4 — The review says what to check.** `review.md` gets a header field
  `live-check: owed | not-needed` next to `verdict:`, and a `## Live check`
  section after "Not checked". When owed, the section lists concrete steps:
  the command (`npm run dev`, or the worktree's port), the test-mode
  shortcut or seed to start from, what to do, and what you should see.
  When not needed, one line saying why.
- **B5 — The owner records it, as a gate.** `metadata.yml` gets a field
  `live_checked:`, a YYYY-MM-DD date, in the same place and format as the
  other gates. Only the owner records it, after doing the steps. If the
  check finds a defect, the date stays empty and the change goes back to
  rework (or the defect becomes a new fix intent if it is out of scope).
- **B6 — An agent's browser run is evidence, not the gate.** The reviewer or
  implementer may drive the browser (test mode, screenshots, console) and
  list what it saw under "Verified myself". That never fills
  `live_checked:`.
- **B7 — `check:intent` enforces it.** When the intent folder has a
  `review.md` whose current header says `live-check: owed`, and
  `live_checked:` is not a valid date, `check:intent` FAILs with a message
  naming the `## Live check` section. No `review.md` yet, or
  `live-check: not-needed`, adds nothing. A `live_checked:` value that is set
  but not a date FAILs, the same as the other gates.
- **B8 — The verdict is unchanged.** `attest`, `escalate` and `rework` keep
  their meanings. A live check is a separate, owner-held condition before
  merge, not a fourth verdict. `/review`'s closing message to the owner adds
  "live check owed: <one-line summary>" when it is.

### Documents

- **B9 — `REVIEW-POLICY.md`.** The report format gains the
  `live-check:` field and the `## Live check` section. "Prerequisites" says
  that for paths without tests (scenes, ui, map editor), the live check
  stands in for the missing suite, which is why they stay Attested. A new
  short subsection, "Live checks", states B3–B8.
- **B10 — `sdlc.md`, `CLAUDE.md`, `intents/README.md`.** `sdlc.md` step 5–6
  shows the live check between the review and the merge, and the merge
  paragraph states B1. `intents/README.md`'s Gates table gains the
  `live_checked` row. The metadata template gains `live_checked:` with a
  comment. `CLAUDE.md` "How work flows" states B1 and points to the policy.
- **B11 — Skill and agent.** The `/review` skill and the reviewer agents
  (Claude and Codex) apply B3, B4 and B6. Version bump: review skill to
  0.1.2, so stamped reports show which rule produced them.

## Interpretations

- **"Explicitly asks"** means a message in this conversation that names the
  action ("merge", "push", "remove the worktree") for this change. "Go ahead"
  after a summary that proposed the merge counts; a standing instruction from
  a past session, a memory, or a `CLAUDE.local.md` brief does not.
- **Scenes stay Attested.** Moving them to Reviewed would add a diff read, but
  reading a scene diff doesn't show that it runs either. The live check is the
  evidence those paths lack, so it is what we require.
- **The owner does the live check.** The point of it is a check made by
  someone other than the model that wrote and reviewed the code. An agent's
  browser run shares the model's blind spots and can't judge "does this play
  right".

## Acceptance criteria

- **AC1** — `grep -rn -i "never by an agent"` finds nothing; every file that
  states the merge rule states B1. (manual check in `/review`, pass 7)
- **AC2** — `check:intent` FAILs a branch whose `review.md` says
  `live-check: owed` and whose `live_checked:` is empty.
  (test: `scripts/intent-check-lib.test.mjs`)
- **AC3** — `check:intent` passes the same branch once `live_checked:` holds a
  date, and fails it if the value is not a date. (test: same file)
- **AC4** — `check:intent` adds nothing when there is no `review.md`, or when
  it says `live-check: not-needed`. (test: same file)
- **AC5** — Only the current round's header is read: a `live-check: owed` in a
  `# Round N (history)` block doesn't count. (test: same file)
- **AC6** — `REVIEW-POLICY.md`, `sdlc.md`, `intents/README.md`, the metadata
  template, the review skill and both reviewer agent definitions describe
  B3–B8 consistently. (manual check in `/review`, pass 7)
- **AC7** — `npm run verify` green; lint warning cap not raised.
- **AC8** — Live check for this change itself: run `/review` on a scratch
  branch that touches `src/ui/` and confirm the report says
  `live-check: owed` with concrete steps. (owner, before merge)

## Non-functional

- **Engine/presentation split:** no `src/` change at all.
- **Save format:** unchanged.
- **Undo boundaries:** unchanged.
- **AI / harness:** unchanged.
- **Scripts:** the only code change is `check:intent` (B7), in
  `scripts/intent-check-lib.mjs`, with tests. Flat-text parsing, no YAML
  dependency.

## Out of scope

- `sdlc:scan` and `/grid` counting live checks (owed, done, defects found).
  Worth adding once there are a few, as its own adjustment.
- A browser-test harness (Playwright or similar) for scenes.
- Who records the *other* gates, and how. The intent didn't ask for it; it
  stays as `intents/README.md` says today.
- Changing tiers for any path.

## Assumptions I made

- The header field is `live-check:` (hyphen, like `reviewed-commit:`), and
  the metadata field is `live_checked:` (underscore, like the other gates).
- `check:intent` reads `review.md` from the same place it reads the other
  intent files (the branch, or the working tree), so no new git plumbing.
- B1 also covers deleting a branch and removing a worktree, because both are
  hard to reverse. That answers the intent's last open question.
- No migration: §26 and §27's `review.md` files have no `live-check:` field,
  which reads as "nothing owed".
