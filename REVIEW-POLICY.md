# Review policy

How a change to heraklios gets reviewed before it merges into `main`. The
`/review` skill and the `heraklios-reviewer` agent both run exactly these
passes; changing this file is itself a **Reviewed**-tier change.

Merges are local (`git merge` on `main`, then push). There is no PR: the
review report lives in `intents/<id>-<slug>/review.md` and is updated in place
as the change evolves. Its verdict line is what you act on.

## Tiers

Effort matches what a mistake would cost. Three inputs decide the tier, in
order — **nothing lowers a tier automatically**; only editing this file does.

1. **Paths** (table below) set the default — the highest tier any touched path asks for.
2. **The intent** can raise it: `review_tier:` in `metadata.yml`, and any
   *feature* that implements a new rulebook rule starts at Reviewed.
3. **The report** can raise it: any CRITICAL/HIGH finding, or a "Not checked"
   item that bears on rule correctness, escalates to Reviewed.

You may escalate by hand at any time without a reason.

| Tier | What happens | What you do | Paths / changes |
| --- | --- | --- | --- |
| **Automated** | `npm run verify` + `npm run check:intent` green → merge | nothing beyond merging | `intents/**` artefacts only; `docs/**` except `docs/research/**`; `README.md` wording that changes no documented rule |
| **Attested** | `/review` runs every pass and writes `review.md` | read the report, not the diff; if you agree with its scope, merge | `src/ui/**`, `src/scenes/**`, `src/map-editor/**`, `src/engine/**` not listed below, tests-only changes, `scripts/**`, build config |
| **Reviewed** | same report, plus you read the diff | full read, then merge | save format (`src/engine/saveGame.ts`, `src/ui/saveStorage.ts`); undo (`src/engine/history.ts`); rule tables (`src/data/combatTable.ts`, `navalRamming.ts`, `navalBoarding.ts`, `units.ts`, `terrain.ts`); `src/data/map.ts`; `docs/research/**`; this file; lint guardrails — an `eslint.config.js` change that loosens a rule, a `package.json` `lint` script change that raises or removes `--max-warnings`, a new `eslint-disable` comment in `src/`; `.claude/agents/**`, `.codex/agents/**`, `.claude/skills/**`; `.claude/settings.json` (its hooks run on every session) |

**Approving means:** "I read what the checker did, I accept its scope —
including the Not-checked list — and I take responsibility for this change."
If in doubt, read the code; nothing stops you. The AI missing something is
not a defence.

### Prerequisites — why Attested is available here at all

- a context file the checker reads (`CLAUDE.md`);
- a meaningful test suite (engine/data, plus the fuzz harness) run by one
  command (`npm run verify`);
- this written policy.

If `npm run verify` stops running the tests, or a module loses its tests,
the Attested tier is suspended for those paths until it is restored.

`src/scenes/**`, `src/ui/**` and `src/map-editor/**` have no test suite.
They stay Attested because a **live check** (below) stands in for it: a
change there cannot merge until you have run it. Reading the diff would not
show that it runs, so moving them to Reviewed would not close the gap.

### Against rubber-stamping

- **Sampling.** Every fifth attested change (1 in 5 — volume here is low, so
  1 in 20 would never fire) gets a full diff read after merge. Mark it
  `sampled: yes` in its `review.md`. Anything you find that the checker
  missed is a defect in the checker: add a pass or a rule here, or move the
  path to Reviewed.
- **Quality per tier.** `npm run sdlc:scan` (and so `/grid`) counts, per
  tier, follow-up fixes — fix intents whose `follows_up:` names the
  intent whose change caused the defect, which `/intent` sets when the cause
  is known — and
  reverts whose subject names the reverted `§`. If attested changes need
  follow-ups more often than reviewed ones, the boundary is wrong — move it.
- **Time-to-approve is not tracked.** Fast approval is not the goal.

## Live checks

Some behaviour only shows when the thing runs. A **live check** is you
running it — the game in the browser, a hook in a real session — and
recording that you did, before the merge.

- **When one is owed.** `/review` sets `live-check: owed` when any of:
  1. the diff touches `src/scenes/**`, `src/ui/**`, `src/map-editor/**`,
     `index.html`, `map-editor.html` or `vite.config.ts`;
  2. the diff touches `.claude/settings.json` (hooks run in every session);
  3. a "Not checked" item is runtime behaviour only a live run can show —
     browser behaviour, hooks, a real `npm ci`, a dev-server path. The
     report names which item.

  Otherwise `live-check: not-needed`. A change to `src/engine/**` or
  `src/data/**` alone is never owed by rule 1, but can be by rule 3.
- **What the report says.** When owed, `## Live check` lists concrete
  steps: the command (`npm run dev`, or the worktree's port), the test-mode
  shortcut or seed to start from, what to do, what you should see. When not
  needed, one line saying why.
- **Who records it.** You, after doing the steps: `live_checked: <date>` in
  `metadata.yml`, like the other gates. If it finds a defect, leave the date
  empty and send the change back to rework (or open a fix intent if the
  defect is out of scope).
- **An agent's browser run is evidence, not the gate.** The reviewer or
  implementer may drive the browser and list what it saw under "Verified
  myself". That never fills `live_checked:`: the point is a check by someone
  other than the model that wrote and reviewed the code.
- **Enforced.** `npm run check:intent` fails while the current review says
  `owed` and `live_checked:` holds no date. The verdict is unaffected:
  `attest`, `escalate` and `rework` mean what they did.

## Merging

An agent merges into `main`, pushes, deletes a branch or removes a worktree
**only when the owner explicitly asks for that action in the current
conversation**, never on its own initiative. A request covers the change it
names and does not carry over to the next one. "Go ahead" in reply to a
summary that proposed the merge counts; a standing instruction from an
earlier session, a memory or a `CLAUDE.local.md` brief does not.

Asked to merge, it first checks, and refuses naming the one that failed:

1. the current `review.md` verdict is `attest` or `escalate`, and its
   `reviewed-commit` is the branch's HEAD (no unreviewed commits on top);
2. `npm run check:intent <branch>` reports PASS, or ROUTE with the reason
   already stated in `review.md`;
3. no live check is owed without `live_checked:` recorded (`check:intent`
   covers this).

Then it merges with `--no-ff`, runs `npm run verify` on `main`, and does the
bookkeeping: `merged:` and `status: done` in `metadata.yml`, the `plan.md`
row to Shipped.

## Passes

Each pass reports `pass`, `findings`, or `not run` (with why).

1. **Intent and plan match.** The diff does what `intent.md`'s outcome and
   `plan.md`'s subtasks say, nothing more. Unplanned scope is a finding.
   Refactoring mixed into a feature is a finding (guidelines §1.5).
2. **Type check.** `npm run check:intent` — paste its output. `ROUTE` needs a
   stated reason or a re-declared type.
3. **Rulebook fidelity.** Every rule behaviour checked against
   `docs/research/`, quoting the passage. Re-read the source yourself; don't
   trust a citation. Compare the French original where the transcription may
   be OCR-damaged. A quote silently tidied while cited is a finding. A rule
   fitted to the one worked example rather than the general sentence is the
   failure §18 made twice — look for it.
4. **Tests prove the rule, not only pass.** Enumerate mutations from the
   diff, one per changed behavioural line; revert each, run the full suite,
   confirm something fails. Guard the harness (assert the file actually
   changed). Report killed/survived per line. Fixes must carry a test that
   failed before the fix.
5. **Engine/presentation boundary and conventions** (`CLAUDE.md`): rule logic
   in `src/engine`/`src/data` with tests; `GameState` mutations push history
   first; die rolls and phase changes stay undo boundaries; `GameState` shape
   changes update `saveGame.ts` + `saveStorage.ts` + `SAVE_VERSION`; every
   ambiguous-rule interpretation has a code comment.
6. **Numbers in prose.** Every measurement in `plan.md`, `plan-history.md`,
   `README.md`, intent artefacts and test comments is reproducible.
7. **Documentation.** `README.md` documents new behaviour in its existing
   style; an implemented "Known simplification" has moved out of that list;
   `CLAUDE.md` still describes the architecture accurately.
8. **Guardrails and hygiene.** `npm run lint` passes and the warning cap did
   not rise; no new dependency without a line in the intent's `plan.md` saying why; no
   save-file or user-supplied text reaches `innerHTML` or `eval`.
9. **Repository-specific footguns.** Drift state machine: every frame
   transition *returns* rather than falling through (§21's recurring bug).
   AI tiers: headless and AI-vs-AI play stay byte-identical where the change
   is meant to be presentation-only. Map editor: generated `map.ts` was
   regenerated, not hand-edited.

**Finding vs nit.** A finding is something that is wrong, unproven, or will
mislead the next person: a rule deviation, a surviving mutant, a stale
number, a missing interpretation comment. Style preferences, naming taste and
"could be shorter" are nits — leave them out, or one line at the end.

**Skip.** `src/data/map.ts` contents (generated), `docs/markers_cells/**`,
`public/markers/**`, `tools/map-extract/**` unless the change is about them.

Severities: **CRITICAL** (corrupts saves or games, crashes), **HIGH** (wrong
rule, unproven rule behaviour), **MEDIUM** (correct but fragile, misleading
docs), **LOW** (doc staleness, minor).

## The report — `intents/<id>-<slug>/review.md`

Structured so `/grid` can count verdicts without a separate store.

```markdown
<!-- generated-by: heraklios/review@<version> -->
# §<id> review — <title>

verdict: attest | escalate | rework
tier: automated | attested | reviewed
reviewed-commit: <hash>
round: <n>
sampled: no
live-check: owed | not-needed

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass |
| … | … | findings (2) |

## Type check
<output of npm run check:intent>

## Findings
- **HIGH** `src/engine/foo.ts:42` — <what is wrong>. Needs rework: <minimal fix>.
- **LOW** `README.md:12` — <…>. Worth a look.

## Not checked
- <what this run could not assess, and why — be specific; this list is the
  harness backlog>

## Live check
- owed: <rule 1, 2 or 3 from "Live checks", and which Not-checked item>
- steps: <command and port> → <test-mode shortcut or seed> → <what to do>
- you should see: <the observable result>
<!-- or, when not needed: "not needed — <why>" -->

## Verified myself vs. taken on trust
- <which commands actually ran, with results>
```

`verdict: attest` means "no findings needing rework — approve if you agree".
`rework` lists what must change; the implementer fixes it and `/review` runs
again (`round` increments and the file is updated in place: the current
round's header and report go at the top, earlier rounds move below a
`# Round N (history)` heading with their header fields turned into list
items, so the scan reads only the current verdict; each round's findings
stay listed with their resolution). `escalate` routes to
the Reviewed tier.
