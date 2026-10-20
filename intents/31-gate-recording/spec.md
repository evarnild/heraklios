<!-- generated-by: heraklios/intent@0.1.1 -->
# §31 spec — Who records a gate, and how

Accepted intent: [intent.md](intent.md)

The spec decides **what** gets built. No rulebook side: its sources are
the process documents it amends, the two scripts that read `metadata.yml`,
and the gate history in `intents/*/metadata.yml`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `intent.md` → Outcome | the core rule, decided by the owner on 2026-10-20: an agent records a gate on request; a "yes" is enough; a "yes" to a message proposing several gates records all of them |
| `REVIEW-POLICY.md` → "Merging" | §28's reading of "explicitly asks": a request in the current conversation, naming the action; "go ahead" in reply to a proposal counts; a standing instruction, memory or `CLAUDE.local.md` brief does not |
| `intents/README.md` → "Gates", "Who edits what" | "**You** write or accept … every gate in `metadata.yml`"; "you are the human at each" |
| `REVIEW-POLICY.md` → "Live checks" | "**Who records it.** You, after doing the steps" |
| `.claude/skills/intent/SKILL.md:16-17`, `:76` | "you never record a gate yourself"; "**Leave every gate empty.**" |
| `.claude/skills/review/SKILL.md:90` | "you never write `live_checked:`" |
| `.claude/agents/heraklios-implementer.md:36`, `.codex/agents/heraklios-implementer.toml:9` | "Never record a gate." |
| `sdlc.md:22`, `:32`, `:75` | "record `intent_accepted` … gate 1, yours"; "You record `plan_approved`"; "Approve and merge — your gate" |
| `CLAUDE.md` → "How work flows" | "The owner runs the live check and records `live_checked: <date>`" |
| `intents/_templates/metadata.yml` | "Gates: the date you passed each one"; `merged:` is "merge commit hash" |
| `scripts/intent-check-lib.mjs` `parseMetadata`, `stripComment`, `GATE_DATE_RE` | the flat parser: `#` comments are stripped, so a comment can't be a marker; a gate counts only when its value matches `^\d{4}-\d{2}-\d{2}$` |
| `scripts/sdlc-scan.mjs:88-95` `mergedInWindow` | an unresolvable `merged:` is caught and returns `false`: the silent drop the intent describes |
| `intents/{26,27,28,30,32}/metadata.yml` and their commits | who actually typed each existing gate (table in B9) |

## Behaviour

### The rule

- **B1 — Who may record a gate.** A gate field is `intent_accepted`,
  `spec_accepted`, `plan_approved` or `live_checked`. The owner writes it
  directly, or an agent writes it **on the owner's request in the current
  conversation**. A request is either:
  - an explicit instruction naming the gate ("accept §31", "record the
    live check"), or
  - a "yes" (or "go ahead", "ok", …) in reply to the agent's own message
    that proposed recording it.

  A "yes" to a message that proposed several gates, or a gate plus other
  actions, records every gate that message named. It covers only what
  the proposal named: nothing more, and no later gate.
- **B2 — What does not count.** The same exclusions as §28's merge rule
  apply: a standing instruction from an earlier session, a memory, a
  `CLAUDE.local.md` brief, an unprompted "yes" that answers no proposal,
  and a request in another session. A subagent (`heraklios-implementer`,
  `heraklios-reviewer`, any `Agent`-tool worker) never records a gate,
  because the owner's request is not in its conversation. A spawned
  session (`npm run spawn`) is a conversation with the owner, so B1
  applies there.
- **B3 — What the gate still means.** The decision is the owner's, whoever
  types the date. For `live_checked:`, the owner runs the check. An agent
  records it only after the owner says they ran it. An agent's own browser
  run, or a passing `npm run e2e`, is never the check (that exception
  stays `/review`'s `not-needed`, per "When the smoke suite stands in").
- **B4 — `merged:` is not a gate.** It is bookkeeping written after a
  merge. The approval it records is the review verdict plus the owner's
  merge request, which `REVIEW-POLICY.md` → "Merging" already governs.
  B1–B3 don't apply to it. B7 (value checks) does.

### The marker

- **B5 — One fixed form.** An agent-recorded gate carries the token
  `by-agent` after the date, on the same line:
  ```
  intent_accepted: 2026-10-20 by-agent    # optional free comment, ignored by scripts
  ```
  An owner-written gate stays a bare date, so the owner's path costs
  nothing new. The token is part of the value, not a comment, so
  `parseMetadata` keeps it. Free comments after it remain allowed and are
  never parsed.
- **B6 — Parsing.** A gate value is valid when it matches
  `^\d{4}-\d{2}-\d{2}( by-agent)?$`. Scripts read two facts from it: the
  date, and who recorded it (`owner` for a bare date, `agent` with the
  token). `check:intent` counts both forms as recorded. Every check that
  reads a gate goes through one shared function in
  `scripts/intent-check-lib.mjs`: the gates-before-code check,
  `live_checked`'s owed check, and `npm run sessions`' gate column
  (`session-lib.mjs`). Nothing matches the date pattern by hand any
  more, and `GATE_DATE_RE` is no longer exported.

### Value checks

- **B7 — Bad values are reported, never dropped.**
  - On the branch, `check:intent` already FAILs on a malformed
    `live_checked:`. It now FAILs the same way on any malformed gate value
    (anything other than empty, a date, or a date plus `by-agent`), naming
    the field and the accepted forms. A gate holding `yes`, `TBD` or
    `2026-10-20 by-claude` is a FAIL, not "not recorded".
  - On `main`, `sdlc:scan` checks every intent's `metadata.yml`:
    `merged:` must resolve to a commit (`git rev-parse --verify
    <value>^{commit}`), and every gate value must pass B6. Each problem
    is listed, with intent and field, in a new **"Metadata problems"**
    section printed first, and in the JSON as `problems`. An intent whose
    `merged:` doesn't resolve is still left out of "Quality per review
    tier", but now visibly. The scan's exit code stays 0, so `/grid` still
    runs; the problems section is the signal.
- **B8 — Agent-recorded share.** `sdlc:scan` adds a line per gate field:
  how many recorded values are `owner` and how many `agent`, over all
  intents, in the text report and the JSON. It's a figure to read, not a
  threshold. Nothing fails on it.

### History

- **B9 — Existing gates are re-marked by what the record shows.** Who
  typed each existing gate, from its comments and commits:

  | Intent | Gates | Typed by | Evidence | Becomes |
  | --- | --- | --- | --- | --- |
  | §26 | `intent_accepted`, `plan_approved` | agent | comment block "Approved in conversation with Claude" | `by-agent`; comment kept |
  | §27 | `intent_accepted`, `plan_approved` | agent | comment block "Recorded by Claude from conversation … Eric said 'yes please'" | `by-agent`; comment kept |
  | §28 | `intent_accepted`, `spec_accepted`, `plan_approved`, `live_checked` | owner | commit `585682f` "gates recorded by Eric" | unchanged |
  | §30 | `intent_accepted` | agent | added in Claude's probe commit `6de3853` on `exp/30-browser-test-probe`; no recorded request | `by-agent`, plus a comment: no request on record |
  | §31 | `intent_accepted`, `spec_accepted`, and `plan_approved` once recorded | agent | comments "owner's 'yes' to the proposal in chat" | `by-agent`; comments kept. Recorded as bare dates on purpose: until B6 lands, `check:intent` reads a `by-agent` value as not recorded, and §31's own branch would fail its gates-before-code check |
  | §32 | `intent_accepted`, `spec_accepted`, `plan_approved`, `live_checked` | agent | end-of-line comments "recorded by Claude on the owner's … request" | `by-agent`; comments kept |

  The marker records who typed the date, which the record shows. It
  doesn't re-judge whether each request met B1, which didn't exist yet.
  No date changes.

### Documents

- **B10 — One statement of the rule, pointed to everywhere.**
  `intents/README.md` → "Who edits what" holds B1–B5 in full and replaces
  "**You** write or accept … every gate". Every other document states it
  in a sentence and links there:
  - `REVIEW-POLICY.md` → "Live checks" → "Who records it": you, or an
    agent on your request (B1), after you ran it.
  - `CLAUDE.md` → "How work flows": the live-check bullet, plus one new
    bullet for gates.
  - `sdlc.md:22`, `:32`, `:75`: "yours" becomes "your decision; you or
    the agent you ask records it".
  - `.claude/skills/intent/SKILL.md`: "you never record a gate yourself"
    becomes "you record a gate only per B1, with `by-agent`". Step 4's
    "Leave every gate empty" stays for drafting. Step 5's closing line
    offers to record the gate on a "yes".
  - `.claude/skills/review/SKILL.md:90`: "you never write `live_checked:`"
    gets "unless the owner asks you to, after running it (B1, B3)".
  - Both reviewer agents: unchanged. They never say who records a gate.
    Their "a browser run of your own is evidence, never the owner's live
    check" stays true under B3, and as subagents they never record one
    (B2).
  - Both implementer agents: "Never record a gate" stays, with the reason
    (B2: a subagent has no request in its conversation).
  - `intents/_templates/metadata.yml`: the gate comment names both forms
    and the `by-agent` token.
- **B11 — Skill versions.** `/intent` and `/review` bump their patch
  version and stamp, as §32 did for `/review`.

## Interpretations

- **"A 'yes' is enough"** is read as a yes *to a proposal*. An unprompted
  "yes" names no gate, so it can't be a request (B2). §28 draws the same
  line for merges, and the intent's assumption says so.
- **The marker is a value token, not a comment.** The intent asks for a
  form "a script can count". `stripComment` removes `# …`, and changing
  that would make every free comment in every `metadata.yml` meaningful.
  A token after the date stays one line, is easy to type, and leaves the
  owner's bare-date path unchanged.
- **Only agent recording is marked.** Marking the owner's gates too
  (`by-owner`) would add a token to the path the intent says must stay
  cheap. Absence means "owner", which is what every existing bare date
  already means.
- **`merged:` stays out of the rule** (B4). The intent leaves it open, and
  `REVIEW-POLICY.md` → "Merging" already says who may merge and when. A
  second rule for the field that records the merge would duplicate it.
- **Scan warns rather than fails** (B7). `sdlc:scan` is a report feeding
  `/grid`. A non-zero exit would block the grid without blocking anything
  that matters, while a problems section printed first can't be missed.
  `check:intent`, which is a gate, does FAIL.

## Acceptance criteria

- **AC1** — `parseGate` (or whatever B6's shared function is called)
  returns `{ date, by: 'owner' }` for `2026-10-20`, `{ date, by: 'agent' }`
  for `2026-10-20 by-agent`, "empty" for an empty value or `[]`, and
  "malformed" for `yes`, `TBD`, `2026-10-20 by-claude`, `2026-1-2`.
  (test: `scripts/intent-check-lib.test.mjs`)
- **AC2** — `check:intent` passes a branch whose gates are all `by-agent`,
  and FAILs a branch with a malformed `plan_approved:`, naming the field.
  (test: `scripts/check-intent.test.mjs` / `intent-check-lib.test.mjs`)
- **AC3** — `sdlc:scan` lists an intent whose `merged:` is `2026-10-20` in
  "Metadata problems" and in JSON `problems`, and still exits 0. With
  `merged: a66d4d4` it lists nothing and counts §32 in "Quality per review
  tier". (test: the scan's logic factored into a tested module; plus one
  manual run recorded in Progress)
- **AC4** — `sdlc:scan` reports owner/agent counts per gate field. On
  `main` after B9, they match B9's table: `intent_accepted` 1 owner and 5
  agent (§26, §27, §30, §31, §32); `live_checked` 1 owner (§28) and 1
  agent (§32). (test plus manual run)
- **AC5** — B9 applied: `git diff` on the six `metadata.yml` files
  changes only gate values (adds `by-agent`) and the one §30 comment. No
  date changes.
- **AC6** — B10 consistent. No document still says the owner alone
  records a gate. `grep -rn "never record a gate\|Who records it\|every
  gate in"` returns only the new wording and the implementers' "never",
  with its reason. (`/review` pass 7)
- **AC7** — `npm run verify` green; lint cap unchanged at 21 or lower.

## Non-functional

- **Engine/presentation split:** not touched. No `src/` change at all.
- **Save format, undo boundaries, AI / harness:** unchanged.
- **Scripts:** `intent-check-lib.mjs` gains the shared gate parser. The
  scan's new checks live in a tested module, not inline in
  `sdlc-scan.mjs`, which has no tests today.
- **Live check:** none owed by path. No `src/scenes`, `src/ui`, `src/main.ts`,
  HTML, `vite.config.ts` or `.claude/settings.json` change.
- **Tier:** Reviewed (`REVIEW-POLICY.md`, `.claude/skills/**`,
  `.claude/agents/**`), as `metadata.yml` already says.

## Out of scope

- Enforcing B1 mechanically. No script can see the conversation, so the
  marker records what happened and the rule stays a written rule.
- `review.md`'s verdict and the "approve the change" gate: unchanged.
- The two manual gates outside `metadata.yml` (release push, triage).
- Rewording or re-dating any existing gate beyond B9's token.
- `/grid` and `docs/sdlc-grid.md` changes. The grid can read B8's figure
  at its next refresh; §29 (grid live-check counts) is separate.

## Assumptions I made

- `by-agent` as the exact token: one word, lowercase, no spaces, and
  never in a free comment, so it can't be mistaken for one.
  `by:agent` or `(agent)` would work as well; the plan can rename it before
  code exists.
- `ok`, `go ahead` and similar count as a "yes" (B1). The owner's word was
  "yes", and §28 already accepts "go ahead".
- A spawned session may record gates under B1 (B2). Today
  `intents/README.md` lets it draft a missing spec or plan, then "stop for
  you to accept it". With B1 you can accept by saying "yes" in that same
  session.
- §30's gate is re-marked `by-agent` on the commit evidence alone, with a
  comment that no request is on record. The alternative is to leave it
  bare, which would claim you typed it.
