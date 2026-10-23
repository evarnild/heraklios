<!-- generated-by: heraklios/review@0.1.4 -->
# §50 review — An auto mode carries one intent from acceptance to ship, stopping only for the owner's questions, the live check and the ship

verdict: rework
tier: reviewed
reviewed-commit: 69ee2ca
round: 1
sampled: no
run: manual
live-check: owed

**Tier:** set by input 1, the paths: `REVIEW-POLICY.md`,
`.claude/skills/**` and `.claude/agents/**` are Reviewed. So the best
verdict is `escalate`, and the owner reads the diff.

**Sampled: no.** Only attested changes are sampled.

**`run: manual`** is the branch's new header line: the change was driven by
hand. Main's policy has no such line, and the branch's scan reads a missing
one as manual.

Passes run by the `heraklios-reviewer` agent against `main`'s policy, with
the branch's policy read as part of the diff. The coordinator re-ran the
results marked under "Verified myself".

**No sentence widens a gate.** The authorisation is limited to "that intent's
`plan_approved`, and no other gate", "not a standing instruction"
(`intents/README.md:106-118`). "What does not count" and "Merging" are
unchanged. The rework below is about consistency, resume behaviour, one open
decision and untested glue.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (3): F1 contradiction with `CLAUDE.md`/`/spawn`, F2 resume, F3 open decision after `escalate` |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run: SDLC tooling, no game rule |
| 4 | Tests prove the rule, not only pass | findings (1): F4. All 32 lib mutants are killed; 3 script-glue mutants survive. |
| 5 | Boundary and conventions | pass. No `src/`, `e2e/` or `package.json` change. `GATE_RE` and `GATE_FIELDS` are unchanged, and `auto_authorized` reuses `parseGate`. |
| 6 | Numbers in prose | pass. 57 files, 977 tests and lint 21 reproduce; the tier-counting move is byte-identical in scan output and JSON. |
| 7 | Documentation | findings (1): F6, stop lists in `CLAUDE.md`/`sdlc.md` incomplete |
| 8 | Guardrails and hygiene | pass. Lint 21 with the cap 21; no new dependency. |
| 9 | Repository-specific footguns | pass, none apply |

## Type check
```
type-check: PASS (intent 50, feature)
  note:  16 file(s), 754 line(s) changed outside intents/.
```

## Findings
- **MEDIUM (F1)** `CLAUDE.md:143-144`, `.claude/skills/spawn/SKILL.md:49-51`:
  both still say the coordinator offers `/review` and "never runs it
  unprompted". `/auto` runs `/review` and rework unprompted (spec B5). A
  coordinator mid-run that reads `CLAUDE.md` gets two rules that
  contradict. Needs rework: qualify both sentences with "outside an
  `/auto <id>` run (`.claude/skills/auto/SKILL.md`)", and keep "records a
  gate or merges" as it is.
- **MEDIUM (F2)** `.claude/skills/auto/SKILL.md:69-70`: a resume picks up "at
  the first step whose work is not done". After a `decision needed`, a
  re-check mismatch or an agent error, that step is the review loop. So the
  resumed run reviews the unchanged branch, without first handing the
  implementer the owner's answer, and burns a round. B13 asks for a resume
  from the recorded state. Needs rework: a short table keyed on
  `auto_stopped`. For example:
  - decision or amendment → resume the implementer with the owner's answer,
    then round n+1;
  - re-check mismatch → redo the re-check for round n without counting a
    round;
  - live check owed → the live-check step;
  - ready for `/ship` → re-run the dry-run and report.
- **MEDIUM (F3)** `.claude/skills/auto/SKILL.md:130-133`, spec B5: `escalate`
  "always stops", but nothing says what follows once the owner has read the
  diff. Every Reviewed-tier intent ends at `escalate`. Under the current
  resume rule, such an intent would never reach the live-check or ship
  stop: `/auto <id>` would just review again. **Needs decision:** after an
  `escalate` stop, does `/auto <id>` mean "diff read, go on to the
  live-check or ship stop" (no new round), or does the intent continue by
  hand? Either answer needs a spec amendment (B5, B13).
- **MEDIUM (F4)** `scripts/sdlc-scan.mjs:58`, `:66-77`, `scripts/sessions.mjs:53`:
  new inline glue with no test. That is the risk the plan named for
  `sdlc-scan.mjs`. Three mutants survive the full suite:
  - **MS1:** `run: field('run')` dropped, so every auto review counts as
    manual and auto sampling falls to 1 in 5. Re-run by the coordinator:
    977 passed.
  - **MS3:** `--exclude` ignored, so an intent's earlier round counts as
    another change.
  - **MS2:** the `auto` field dropped from a sessions row. Lower risk: the
    same pattern as `gates`.

  Needs rework: move the review-header read and the `--sample-due` /
  `--exclude` argument handling into `scan-lib.mjs`, with tests that kill MS1
  and MS3.
- **MEDIUM (F5)** `scripts/ship.mjs:134` throws "main has no remote named
  origin to push to" before the dry-run path. The sandbox has no remote, so
  the live check can't reach AC5's "ready: `/ship <id>`": it would stop at
  "ship dry-run blocked". The plan's "no remote … `/auto` never pushes
  anyway" (Validation) missed it. Re-read by the coordinator at
  `ship.mjs:128-140`. Worth a look: the live check's step 0 below adds a
  local bare `origin` to the sandbox. No code change is needed.
- **LOW (F6)** `CLAUDE.md:79-82`, `sdlc.md:115-118`: the stop lists omit
  `escalate`, the most common stop for policy and SDLC intents.
  `CLAUDE.md` also omits out-of-rounds, an amendment, a held worktree and
  a re-check mismatch. Needs rework: add them.
- **LOW** `scripts/sdlc-scan.mjs:58`: the `run:` read takes `(\S+)`, so a
  review that copies the template literally (`run: auto | manual`) counts as
  auto. `--sample-due` with no value falls through to the full report with
  exit 0 (`:67`). Worth a look, and cheap once F4 moves this into
  `scan-lib.mjs`.
- **LOW** `.claude/skills/auto/SKILL.md:90-104`: a `plan.md` that already
  exists unapproved (drafted earlier or edited by hand) could be approved
  without this run having drafted it. The intent covers "the artefacts that
  intent's own skills draft". Worth a look: record only a plan this run
  drafted, or stop and ask.
- **LOW** Historical sampling doesn't match the count the new script makes
  authoritative:
  - of the 12 attested manual reviews, §36 (the 4th) says `sampled: yes`,
    while §37 (the 5th) and §43 (the 10th) say `no`;
  - `--sample-due manual --exclude 50` now gives n = 13, not due.

  This is older than §50, and the post-merge reads that were owed for §37
  and §43 may never have happened. Worth a look.
- **LOW** Plan Progress divergence: `auto_round` is written at the start of
  each round (`auto/SKILL.md:124-125`), not only at a stop as B12 says. It is
  sensible, since a closed session must resume at the right round, but it
  isn't the spec. Worth a look: accept it, and say so in the spec when F3
  amends it.

## Not checked
- **The skill in a real run:** whether its text produces the behaviour.
  Only the live check shows that.
- **Push notifications:** whether the tool is available in the owner's
  session.
- **The real `origin` and the real `.git/heraklios-sessions.jsonl`:** the
  sandbox has neither by design; its events go to its own `.git`.
- **`ship.mjs` was not run anywhere;** F5 comes from reading the code.
- **e2e:** not required; no `src/`, `e2e/` or `main.ts` change.
- **The implementer's 16 mutants** were not replayed one for one. The
  reviewer ran its own 35, which overlap them.
- **`parseReviewHeader` with a `run:` line:** not exercised. This branch has
  no `review.md` until this one.

## Live check
- **Owed** by rule 3 (AC5): the skill's behaviour only shows in a real run.
  Run it in the sandbox clone
  `C:/Users/eric/AppData/Local/Temp/claude/C--Users-eric-src-heraklios/d4d8f463-fc75-4c39-80e6-361cdb7ead3e/scratchpad/auto-sandbox`.
  - Its `main` is §50's `69ee2ca` plus one commit adding the sandbox intent
    §91 (`clip('abc', 0)` returns `'ab…'`).
  - A spawned §91 worktree lands in `…/scratchpad/heraklios-wt/`, not the
    real one.
  - Do it after the rework: the sandbox's `main` must then be reset to the
    reworked §50 commit, which the implementer can redo.
  - The scratchpad is session-specific, so don't leave the check for a much
    later session.
- **Steps and what you should see:**
  0. **Setup** (F5), in Git Bash: `git init --bare
     ".../scratchpad/auto-origin.git"`, then in the sandbox `git remote add
     origin ".../scratchpad/auto-origin.git"` and `git push -u origin main`.
     That pushes to a local folder only; `git remote -v` must show only
     `auto-origin.git`.
  1. `cd ".../auto-sandbox" && claude`, then type `/auto 91`.
  2. `auto_authorized: <today> by-agent    # owner: "/auto 91"` is committed
     on `main`. §91 is a fix, so there is no spec stop.
  3. The plan is drafted and approved: `plan_approved: <today> by-agent    #
     auto: owner "/auto 91" (auto_authorized <today>)`. Nothing else may be
     recorded.
  4. With no prompt, `npm run spawn -- 91` creates
     `…/scratchpad/heraklios-wt/91-clip-nonpositive-max`. Check that
     `C:/Users/eric/src/heraklios-wt` gains nothing. The implementer runs in
     the background.
  5. Round 1: `auto_round: 1` on `fix/91-…`. The review runs unprompted. Its
     `review.md` has `run: auto` and a "Coordinator, re-run" block, and is
     committed on the branch.
  6. At the first stop, `npm run sessions` and `npm run queue` in the
     sandbox show `auto · r1 · <reason>` for §91, plus a push notification
     if your session has the tool.
  7. Close the session, open a new one in the sandbox, and type `/auto 91`.
     It resumes at the same round and doesn't re-plan or re-spawn. If it
     re-reviews an unchanged branch, F2 isn't fixed.
  8. If it owes a live check, it gives steps. Say you ran them, and
     `live_checked` is recorded on your words.
  9. It ends with "ready: `/ship 91`" after a `--dry-run` report, then an
     "auto stopped: ready for /ship" commit. **Don't ship.**
  10. Clean up:
      - inside the sandbox, `git worktree remove` the §91 worktree, after
        checking its `node_modules` isn't a junction;
      - delete `auto-sandbox` and `auto-origin.git`.

  Then record `live_checked` on the real §50 branch.

## Verified myself vs. taken on trust
**Coordinator, re-run** (worktree at `69ee2ca`, clean):
- **MS1** (`sdlc-scan.mjs:58`, `run: field('run')` dropped), full `npx
  vitest run`: 57 files, **977 passed**, so it survives (F4). Restored by
  copy, checked with `cmp`; `git status --short` empty.
- **Read, confirming F1, F2, F3 and F5:**
  - `CLAUDE.md:141-144` and `.claude/skills/spawn/SKILL.md:48-51`
    ("never runs it unprompted" / "Don't run it unprompted");
  - `.claude/skills/auto/SKILL.md:64-71` ("pick up at the first step whose
    work is not done") and `:130-133` (`escalate` always stops, with
    nothing after);
  - `scripts/ship.mjs:126-142`: `checkStart` throws on a missing `origin`
    before any dry-run branch.

**Reviewer agent** (same worktree and HEAD):
- `npm run verify`: exit 0, 57 files, 977 tests, lint 21 of 21, with none
  in `scripts/`. `npm run check:intent`: PASS.
- **The full diff of all 20 files,** read against spec B1–B14,
  Interpretations and Out of scope, with every added policy sentence
  checked for wording wider than B1/B3. It found none.
- **The tier-counting move:** `npm run sdlc:scan` at `fe31788^`, `fe31788`
  and HEAD, from `git archive` copies outside the repo. The output (text and
  JSON) is identical across the move. HEAD adds only `, run manual` and the
  per-run block.
- **`--sample-due`:**
  - on the real repo: manual n = 13, auto n = 1, a bogus value exits 2;
  - on a fake 3-review repo: auto n = 4, and n = 3 is due with `--exclude`.
- **35 mutants, full suite each:**
  - 32 on the lib lines, all killed, covering `intent-check-lib`,
    `session-lib`, `queue-lib` and `scan-lib`;
  - MS1, MS2 and MS3 on the glue survive (F4).
- **The sandbox, read-only:** no remote; `main` is `69ee2ca` plus §91's
  intent and metadata; `node_modules` is not a link; the worktree path rule
  puts §91 under `…/scratchpad/heraklios-wt/`.
- Nothing touched `main` or was pushed. `git status --short` empty at the
  end.

**Taken on trust:** that T7's expected numbers were first computed on the
pre-move code. That is moot, since the move was diffed verbatim and its
output compared byte for byte.

**For the owner's diff read, in order:**
1. `intents/README.md:106-118` and `:130-135`: the authorisation and the
   auto fields;
2. `.claude/skills/auto/SKILL.md`: `:20-34` (what it authorises), `:88-104`
   (the plan gate), `:113-164` (the loop, cap and re-check), `:166-210`
   (stops), `:52-70` (start and resume);
3. `CLAUDE.md:75-83` with `:139-144` and `spawn/SKILL.md:49-51` (F1);
4. `REVIEW-POLICY.md:52-63` (sampling) and `:209-251` (`run:`, "Needs
   decision:"), with "Merging" `:114-144` unchanged;
5. `.claude/skills/review/SKILL.md:74-79`, `:100-107`, and
   `heraklios-reviewer.md:130-137`;
6. `sdlc.md:98-125`;
7. the scripts: `intent-check-lib.mjs:108-136`, `scan-lib.mjs:74-141` and
   `sdlc-scan.mjs:58-77`.
