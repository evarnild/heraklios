<!-- generated-by: heraklios/review@0.1.4 -->
# §39 review — /spawn launches the implementer subagent in the worktree itself

verdict: escalate
tier: reviewed
reviewed-commit: e7998b7273c2a4a76230d4496003c7b23ed8498a
round: 2
sampled: no
live-check: owed

Tier set by the path table: `.claude/skills/**` and `.claude/agents/**` are
Reviewed. The intent is an adjustment and would be Attested on its own;
nothing lowers a tier, so you read the diff.

Round 2 covers `e7998b7`, which closes the three round-1 LOWs. It adds a
fourth file (`.claude/agents/heraklios-implementer.md`) to the three the
intent named; the adjustment bound is ≤5 files, so no re-declaration.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass — the agent-file edit is outside the three files the intent named, but it is a direct consequence of the launch (round-1 LOW) and stays inside the ≤5-file / ≤60-line bound |
| 2 | Type check | pass (apart from the owed live check, see below) |
| 3 | Rulebook fidelity | not run — no rule code, no `docs/research/` involved |
| 4 | Tests prove the rule | not run — no behavioural code; prose only, nothing a mutant could break |
| 5 | Engine/presentation boundary and conventions | pass — no `src/` change |
| 6 | Numbers in prose | pass — "about three" and port 5239 unchanged; 55-line count lives only in `check:intent` output |
| 7 | Documentation | pass — `SKILL.md`, `CLAUDE.md`, `sdlc.md` and the agent file now agree; `README.md` correctly untouched |
| 8 | Guardrails and hygiene | pass — lint 21 warnings = the cap, 0 errors; no dependency; no `innerHTML`/`eval` |
| 9 | Repository-specific footguns | not run — drift, AI tiers and map editor not touched |

## Type check
```
type-check: FAIL (intent 39, adjustment)
  error: A live check is owed and not recorded. ...
  note:  4 file(s), 55 line(s) changed outside intents/.
```
The only error is the owed live check this report sets (`live-check: owed`),
which is the owner's to clear, not rework. Size is within the adjustment
bounds (≤5 files, ≤60 lines, no rule code).

## Findings
None new. Round-1 findings all resolved (see history).

## Not checked
- **The launch path as written in `SKILL.md`.** The implementer was launched
  in this conversation by hand with an equivalent prompt, not by a coordinator
  following the new step 6 from a fresh session.
- **The fallback branch** (gate missing → hand-over text) has not been run.
- **The `npm run sessions` display while an implementer is running.** I saw the
  row only after it finished; the CLAUDE.md wording is now limited to what the
  hook code supports (`session-lib.mjs:159` files events under
  `CLAUDE_PROJECT_DIR`), which I read myself this round.
- **Concurrency count.** "Launched implementers count toward the limit" relies
  on the coordinator remembering them; nothing enforces it.
- **Mutations** (pass 4): none exist for prose.

## Live check
- owed: rule 3 — the launch path, the fallback and the live `npm run sessions`
  display above are only visible in a real coordinator session.
- steps: in the main checkout (clean) run `git checkout --detach
  adjust/39-spawn-launches-implementer`, start `claude` there, then:
  1. Run `/spawn <id>` twice, on two intents: one whose needed gate is
     recorded (a plan-approved fix, or an accepted adjustment) and one whose
     gate is missing (an accepted feature with no `plan_approved`). The first
     should launch a background implementer; the second should not launch,
     should name the missing gate, and should give the `cd "<path>" && claude`
     hand-over.
  2. While the first runs, `npm run sessions` in a second terminal.
  3. Afterwards `npm run spawn -- <id> --remove` for any worktree you do not
     want, then `git switch main`.
- you should see: the branch chosen by the gate (launch vs hand-over), a report
  with path, branch, port and gates, the worktree row filling in
  `ahead`/`dirty` while the coordinator row shows only its own state, and on
  completion a result summary with an offer of `/review` — not an automatic one.

## Verified myself vs. taken on trust
- At `e7998b7`: `npm run verify` → exit 0, 44 test files, 692 tests passed,
  lint 21 warnings (= cap), build green. `npm run check:intent` → the single
  error above.
- Read the full diff of the four files. Read `scripts/session-event.mjs` and
  `session-lib.mjs:137-159` for the `CLAUDE_PROJECT_DIR` claim.
- `main` has two commits past the fork (`c431fc1`, `8160eec`, §38 plan files
  only): no overlap, `--no-ff` merges cleanly, `reviewed-commit` stays an
  ancestor.
- Taken on trust: the implementer's description of the `npm run sessions`
  columns while running; `npm run e2e` not run (no `src/scenes`, `src/ui`,
  `src/main.ts` or `e2e/` change).

# Round 1 (history)

- verdict: escalate
- tier: reviewed
- reviewed-commit: 4fd413056d881b6d582e6fe64cb4f017589e70d8
- live-check: owed

Findings and their resolution:
- **LOW** `.claude/agents/heraklios-implementer.md:10` — rule 1 said "branch
  from `main`", contradicting the launch where the branch already exists.
  Resolved in `e7998b7`: the rule now says to work on the existing branch when
  the prompt says it is checked out.
- **LOW** `.claude/skills/spawn/SKILL.md:36` — step 6 did not say a
  `<date> by-agent` gate counts as recorded. Resolved in `e7998b7`: "A bare
  date and `<date> by-agent` both count as recorded; anything else does not."
- **LOW** `CLAUDE.md` — the sessions-display claim went beyond what was
  confirmed. Resolved in `e7998b7`: reworded to what the hook code supports.
