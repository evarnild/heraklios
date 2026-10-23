<!-- generated-by: heraklios/spec@0.1.0 -->
# §50 spec — An auto mode carries one intent from acceptance to ship, stopping only for the owner's questions, the live check and the ship

Accepted intent: [intent.md](intent.md)

Written against `main` at `f63f530`.

## Sources that apply

| Source | What it settles |
| --- | --- |
| rulebook | nothing: SDLC tooling, no game rule |
| `intents/README.md` → "Who edits what" | a gate is recorded "on your request in the current conversation"; "A subagent … never records a gate"; what does not count (a standing instruction, a memory, a brief) |
| `REVIEW-POLICY.md` → "Merging" | a merge only "when the owner explicitly asks for that action in the current conversation"; the three preconditions |
| `REVIEW-POLICY.md` → "Live checks" | the owner runs the check; "An agent's browser run is evidence, not the gate" |
| `REVIEW-POLICY.md` → "Against rubber-stamping" | "Every fifth attested change … gets a full diff read after merge"; follow-ups counted per tier |
| `.claude/skills/spawn/SKILL.md` step 5 | `/spawn` already launches a background `heraklios-implementer` when the needed gate is recorded |
| `.claude/skills/review/SKILL.md` | delegate to `heraklios-reviewer`; "do not trust a sub-agent's either: re-run the commands whose results you quote" |
| `scripts/intent-check-lib.mjs:91` | `GATE_RE = /^(\d{4}-\d{2}-\d{2})( by-agent)?$/`: the only gate values accepted |
| `scripts/intent-check-lib.mjs:45-68` | `parseMetadata` keeps any `key: value`, so new keys need no parser change |
| `scripts/sdlc-scan.mjs:56` | the scan reads the review header's `verdict`, `tier`, `round`, `sampled` |
| owner's answers, 2026-10-23 | stop once at the spec; the re-check is a coordinator step; a skill plus background agents drives it; rework after a live check counts toward the three rounds |
| intent review rounds | §45 took 4 rounds, §46 3, §47 and §48 2 |

## Behaviour

**B1 — Starting a run.** The owner types `/auto <id>` in the coordinator
session for an intent whose `intent_accepted` is recorded. That message is
the run's authorisation, for that intent only.
- The coordinator records it in `metadata.yml` as `auto_authorized: <date>`,
  with the owner's words in a comment, the way a gate is recorded.
- A second `/auto <id>` resumes a stopped run and is recorded again.
- `/auto` with no id, or for an intent without `intent_accepted`, stops with
  the reason.

**B2 — The spec stop (feature only).**
- The run drafts the spec as `/spec` does, including its single question
  round. If questions remain, it asks them and waits.
- With the spec drafted, the run **stops once** for the owner's
  `spec_accepted`, recorded exactly as today: the owner's own date, or
  `by-agent` on their yes. The authorisation does not cover this gate.
- On the yes, the run continues by itself.
- A fix or refactor has no spec, so this stop doesn't exist for it.
- An adjustment or experiment has no plan; its run starts at B4.

**B3 — The plan.** The run drafts the plan as `/build-plan` does. If the
plan finds the spec incomplete (`/build-plan` step 3), the run stops; it
never decides a design point. Otherwise the coordinator records
`plan_approved: <date> by-agent`, with a comment naming the authorisation,
for example `# auto: owner "/auto 50" (auto_authorized 2026-10-24)`. The
`by-agent` form keeps `GATE_RE` unchanged. This is the only gate the
authorisation records.

**B4 — Build.** The run spawns the worktree (`npm run spawn -- <id>`) and
launches the background `heraklios-implementer`, as `/spawn` step 5 does
today.

**B5 — The review loop, at most three rounds.**
- When the implementer reports, the run delegates `/review` to
  `heraklios-reviewer`. The coordinator then does its **re-check (B6)** and
  commits `review.md` on the branch.
- `rework`, with every finding needing rework marked **mechanical** (B7):
  the run resumes the implementer with the findings, then reviews again.
- **The cap:** three review rounds per intent, counting every round of the
  run. A rework after a failed live check uses the same budget (B9).
- `attest` goes to the live-check stop (B8), or, when the check is
  `not-needed`, to the ship stop (B10).
- `escalate` always stops: the Reviewed tier needs the owner's diff read.
  **Amended 2026-10-23, owner's decision after review round 1 (F3):** after
  an `escalate` stop, the owner's next `/auto <id>` means "diff read". The
  run goes on to the live-check stop (B8) or the ship stop (B10), with no new
  review round.

**B6 — The coordinator's re-check.** Before writing each round's
`review.md`, the coordinator re-runs in the worktree:
- `npm run verify` and `npm run check:intent`;
- `npm run e2e` when the paths call for it;
- every mutant the review lists as **surviving**;
- every mutant the round's resolutions say a rework now **kills**.

It compares the counts with what the reviewer and implementer quoted: files,
tests, lint, e2e passes, and each mutant's result. Any mismatch stops the
run and is listed in the stop report. The results go under "Verified
myself" with "Coordinator, re-run", as now.

**B7 — Mechanical or decision.**
- Every finding that needs rework says either "Needs rework:" (mechanical:
  the fix is determined by the spec, plan or a test) or **"Needs decision:"**
  (the fix chooses between behaviours, or changes what the spec or plan
  says).
- A "Needs decision:" finding stops the run.
- The coordinator also stops the run when a mechanical fix would edit
  `spec.md` or `plan.md` above its Progress marker. Any amendment is the
  owner's, as §47's "main wins" and §49's spec fix were.

**B8 — The live-check stop.** On `live-check: owed`, the run stops with the
report's steps. The owner runs them.
- Pass: the owner says so, and `live_checked` is recorded as today.
- A defect: the owner describes it and says to rework. The run resumes the
  implementer with that description and continues the loop (B9).

**B9 — Running out of rounds.** If a round would be the fourth, the run
stops instead, with the open findings, and the intent continues by hand.
This includes rounds started by a live-check defect (owner's answer).

**B10 — The ship stop.** The run ends at a merge-ready branch: the verdict
`attest`, the live check recorded or not needed, and `npm run ship -- <id>
--dry-run` showing nothing in the way. It reports "ready: `/ship <id>`". It
never runs `/ship` itself.

**B11 — Other stops.** The run also stops on:
- a CRITICAL finding;
- a red `verify` or `check:intent` it cannot trace to a finding the
  implementer is fixing;
- an agent error or a stopped agent;
- the worktree held by a session the run didn't start;
- a fourth open intent session or run (`CLAUDE.md`, "about three").

**B12 — Every stop is visible.**
- On each stop, the coordinator writes `auto_round: <n>` and
  `auto_stopped: <reason>` into the branch's `metadata.yml` (on `main`
  before the branch exists) and commits it.
- **Amended 2026-10-23, owner's decision after review round 1:** the
  coordinator also writes and commits `auto_round: <n>` when each review
  round starts, so a session closed mid-round resumes at the right round
  (B13).
- `npm run sessions` and `npm run queue` show `auto · r<n> · <reason>` for
  that intent. Resuming clears `auto_stopped`.
- Each stop also sends a push notification naming the intent and the reason,
  when the session has that tool.

**B13 — The run lives in the coordinator session.** Closing that session
pauses the run. A later `/auto <id>` in a new session reads `auto_round` and
`auto_stopped` and resumes from the recorded state. The owner's new message
is the new request. **Amended 2026-10-23 (review round 1, F2/F3):**
"resumes from the recorded state" means by the stop reason, not "the first
step not done":
- a decision or an amendment: the implementer gets the owner's answer, then
  round n+1;
- a re-check mismatch: the re-check for round n is redone, with no new
  round;
- `escalate`: as B5's amendment says;
- a live check owed: back at B8;
- ready for `/ship`: the dry-run runs again and is reported.

**B14 — Counting.**
- The review header gains `run: auto | manual`.
- `npm run sdlc:scan` counts follow-up fixes and reverts by tier and by run
  kind.
- Sampling for auto runs is separate: every **third** attested auto-run
  change gets `sampled: yes`. Manual changes keep every fifth.

## Interpretations

- **"Only stops when there are questions, a live check and ship"**, with the
  owner's answer "stop once at the spec": the spec stop is the one approval
  stop the owner keeps. The plan is recorded under the authorisation, since
  a plan question means the spec is incomplete (`/build-plan` step 3), and
  that already stops the run.
- **"3 rounds"** means three review rounds per intent, counting the first
  review, and including rounds after a live-check defect (owner's answer).
- **The authorisation is a request "in the current conversation"**
  (`intents/README.md`) for exactly one gate, `plan_approved` of that
  intent. The B3 comment ties the recorded gate to it, so the owner's
  decision stays traceable. `intents/README.md` gets that sentence.

## Acceptance criteria

- **AC1 — metadata** (`scripts/intent-check-lib.test.mjs`, `scan-lib.test.mjs`):
  - `auto_authorized`, `auto_round` and `auto_stopped` parse;
  - `check:intent` accepts an `auto_authorized` date and rejects a malformed
    one, with the same rule as a gate;
  - a gate is still only a date or a date plus `by-agent` (B3).
- **AC2 — visibility** (`session-lib.test.mjs`, `queue-lib.test.mjs`):
  `npm run sessions` and `npm run queue` show `auto · r<n> · <reason>` for a
  metadata with those fields, and nothing for one without (B12).
- **AC3 — counting** (`scan-lib.test.mjs`, `sdlc-scan` output):
  - follow-ups split by `run:`;
  - the auto sampling rule picks the 3rd and 6th auto-run attested change
    and none of the manual ones (B14).
- **AC4 — the skill** (`.claude/skills/auto/SKILL.md`):
  - it states B1–B13 as steps;
  - `/review`'s skill and `REVIEW-POLICY.md` gain the "Needs decision:" form
    (B7) and the `run:` header line (B14);
  - `intents/README.md` gains the authorisation sentence;
  - the reviewer agent's brief asks it to classify findings.

  Checked by `/review` pass 1 against this spec (Reviewed tier: the diff is
  read).
- **AC5 — live check** (owed by rule 3: the skill's behaviour only shows in
  a real run): the owner runs `/auto` on one small real intent, ideally a
  fix with no spec, and watches:
  - it spawns, implements and reviews unprompted;
  - a stop appears in `npm run sessions` with its reason, and as a push
    notification;
  - it ends at "ready: `/ship <id>`";
  - the B6 re-check appears under "Verified myself";
  - closing and reopening the session, then `/auto <id>`, resumes it.
- **AC6** — `npm run verify` green, lint ≤ 21; `npm run check:intent` PASS.

## Non-functional

- **Engine/presentation split:** untouched; no game code changes.
- **Save format, undo, AI/harness:** untouched.
- **Policy surface:** `REVIEW-POLICY.md`, `intents/README.md`,
  `.claude/skills/**` and `.claude/agents/**` are Reviewed-tier paths, so
  this change is Reviewed: the owner reads the diff.
- **Scripts:** the pure parts (parsing, display, counting) go into the
  existing `*-lib.mjs` modules with tests. The run itself is skill
  instructions, not a script.
- **Safety:** the hard rules carried in briefs still apply:
  - never run `npm run ship` outside the owner's `/ship`;
  - never touch a real `saves/`;
  - never raise the lint cap;
  - restore mutants by copy;
  - never kill a process the run didn't start.

## Out of scope

- Auto-running `/ship`, `live_checked`, `intent_accepted` or
  `spec_accepted`.
- Drafting the intent inside `/auto`: a run starts from an accepted intent.
- A Workflow-script driver (owner's answer: skill plus background agents).
- A separate verifier agent (owner's answer: a coordinator step).
- Running when no coordinator session is open, such as cloud or scheduled
  runs.

## Assumptions I made

- **Field names** `auto_authorized`, `auto_round` and `auto_stopped`, and the
  `run:` header value `auto | manual`. The `run:` line is missing from old
  reviews, which then count as manual.
- **Sampling every third auto-run change**, counted separately from manual
  changes. That is the stricter rate proposed in conversation; the owner
  didn't choose it explicitly.
- **Push notification on each stop** where the tool exists. Otherwise
  `npm run sessions` is enough.
- **Re-check scope (B6):** survivors and the mutants a rework claims to
  kill, not every mutant a review ran. That is the set that caught real
  misses here: §48's M7 and §49's `follow` survivor.
- **A stop commits to the branch** (B12). The run already commits
  `review.md` there, and `npm run sessions` reads the branch's metadata.
