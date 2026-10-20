<!-- generated-by: heraklios/review@0.1.2 -->
# §32 review — Browser smoke suite for the game's scenes (`npm run e2e`)

verdict: escalate
tier: reviewed
reviewed-commit: 62a647c41782daea9d008887d78001d3750bfdec
round: 2
sampled: no
live-check: owed

Tier set by input 1 (paths), as in round 1: `REVIEW-POLICY.md`,
`.claude/skills/review/**`, `.claude/agents/**` and `.codex/agents/**`
are Reviewed paths. No finding needs rework, so the verdict is
`escalate`: you read the diff before merging. `sampled: no`, since
sampling counts attested changes only.

This round reviews the rework commit `62a647c` (`f6b6e31..62a647c`:
`e2e/helpers.ts`, `CLAUDE.md`, `sdlc.md`, Progress). It reran every
mechanical check on the whole branch. Round 1's passes and mutations on
`f6b6e31` still stand, since nothing else changed.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) — round 1's LOW divergence list, still open (worth a look) |
| 2 | Type check | pass — FAIL only on the owed live check (owner's to clear) |
| 3 | Rulebook fidelity | pass — no rule touched by the rework |
| 4 | Tests prove the rule, not only pass | findings (3) — one new LOW; round 1's tween MEDIUM and visibility LOW still open (worth a look) |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | pass — Progress's "4 passed (14.1 s)" headed / "(13.4 s)" headless match my 14.2 s / 13.8 s |
| 7 | Documentation | pass — `CLAUDE.md` and `sdlc.md` now match the policy |
| 8 | Guardrails and hygiene | pass — lint 21/21 |
| 9 | Repository-specific footguns | pass |

## Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: FAIL (intent 32, feature)
  error: A live check is owed and not recorded. Do the steps in intents/32-e2e-smoke-suite/review.md → ## Live check, then set live_checked: <date> in intents/32-e2e-smoke-suite/metadata.yml.
  note:  26 file(s), 837 line(s) changed outside intents/.
```
The only error is the owed live check. Per the skill that is the owner's
to clear, not rework. It clears once you record `live_checked:`.

## Findings
- **LOW** `e2e/helpers.ts:34-36` — the comment says "every other 404 stays
  fatal", but on the Vite dev server no other 404 ever happens. Its SPA
  fallback answers any unknown path with `index.html` and status 200
  (`/nope.png`, `/markers/nope.png` and `/sub/favicon.ico` all → 200
  `text/html`); `/favicon.ico` is the only path that 404s. So the trap
  can't catch a missing asset as a 404 at all. That's a limit of the dev
  server, not something the rework introduced. The filter itself is
  exactly as narrow as asked. Worth a look: reword the comment to
  "/favicon.ico is the one path Vite's dev server 404s; nothing else
  is filtered", so a later reader doesn't count on 404 detection.
- **MEDIUM** `src/ui/devHook.ts:102` — round 1, open: `idle()`'s tween
  check is still unproven (mutant #8 survives). Worth a look; not
  required for this merge.
- **LOW** `src/ui/devHook.ts:117` — round 1, open: the `visible` and
  `input.enabled` filters are unproven (mutants #10, #11). Worth a look.
- **LOW** `intents/32-e2e-smoke-suite/plan.md` Progress — round 1, open:
  `centerOn`, `testScenario()`, the JSON copy in `state()` and
  `hexToCanvas` not centring are still missing from "Diverged from the
  plan". Worth a look.

Nits (round 1, unchanged): stray blank line in the `/review` skill's
step-1 code block; `e2e/attacks.spec.ts:42` takes a long way round to
compute `step` = ±1.

## Not checked
- **Missing assets in dev:** because of the SPA fallback above, a missing
  image or sprite only shows up as a failed decode, if Phaser logs one
  as a console error. I didn't try breaking a real asset reference to see
  whether the suite notices.
- **The favicon filter is only exercised headed.** Removing it makes
  `--headed` fail (4 failed) but leaves `npm run e2e` (headless) green. A
  regression there only shows in a headed run, which `/review` doesn't
  require.
- **Round 1's Not-checked items** still apply (below): the advance-prompt
  path depends on seed 1, `testScenario` resets are inert, AC1's 20-run
  loop was not repeated by me, normal play with the hook installed not
  seen, Linux/macOS/CI not tried. Correction to round 1: the naval
  rule the suite encodes is at `e2e/naval.spec.ts:27`, not `:507`.

## Live check
- owed: rule 1. The diff touches `src/ui/**` and `src/main.ts`, and the hook
  is new behaviour, so the smoke-suite exception can't apply.
- steps (AC8). Stop any dev server on port 5232 first, then:
  ```
  cd C:\Users\eric\src\heraklios-wt\32-e2e-smoke-suite
  ```
  (not the main checkout: `main` has no `playwright.config.ts`, and a bare
  `npx playwright test` there picks up the Vitest files and fails with
  "Vitest failed to access its internal state").
  1. `npx playwright test --headed` — watch the four scenarios. Chromium
     opens the Menu four times. Land-move and save-load click "Mode test
     (2 joueurs, armées prêtes)"; attacks and naval click "Mode test combat
     (unités face à face, 2 cases)". Then: a fantassins unit steps one hex;
     infantry closes, End phase, archers shoot (a retreat hex gets clicked
     if offered), infantry melees ("Don't advance" if offered); a galley
     turns once via a "Turn" button and moves one hex; the 💾 Save / Load
     panel opens, saves slot 1, closes, an archer moves, and loading slot 1
     puts the archer back. Ends with `4 passed`.
  2. `npm run dev -- --port 5232` → open `http://localhost:5232` → start a
     **normal** 2-player game (not a test-mode shortcut): build armies,
     place, play one full turn (a move, an attack, end phase).
- you should see: step 1 ends `4 passed`. In step 2, nothing different from
  `main`, and no console errors except possibly the browser's own
  `/favicon.ico` 404. In DevTools, `window.__heraklios` exists (dev only)
  and `__heraklios.testScenario()` returns `null` in the normal game.
- then: `live_checked: <date>` in `metadata.yml`, and commit it together
  with this `review.md` on the branch (the merge check reads git).

## Verified myself vs. taken on trust
- Read `git diff f6b6e31..62a647c` in full. `CLAUDE.md:77-84` now puts
  "The owner runs the live check…" first and lists all four conditions;
  `sdlc.md:60` adds "owed only because of the paths it touches". Both
  match `REVIEW-POLICY.md` → "When the smoke suite stands in".
- `npm run verify` (worktree, `62a647c`): lint 0 errors / 21 warnings (cap
  21); Vitest 36 files, **615 passed**.
- `npm run check:intent`: FAIL, only on the owed live check (output above).
- `npm run e2e` (B11): **4 passed (13.8 s)**.
- `npx playwright test --headed`: **4 passed (14.2 s)**.
- **Mutant: favicon filter removed** (`e2e/helpers.ts` backed up, the
  `&& !m.location().url.endsWith('/favicon.ico')` clause deleted, change
  confirmed with `cmp`, file restored from the backup) → `--headed`: 4
  failed. **Killed.**
- **Probe specs** (throwaway files in `e2e/`, deleted after each run):
  - `page.request.get` statuses: `/favicon.ico` 404; `/nope.png`,
    `/markers/nope.png`, `/sub/favicon.ico` all 200 `text/html`. So
    fetch/img probes for "another 404" were impossible: there isn't one.
  - `console.error('boom from the game')` from the page → `errors` was
    `["boom from the game"]`. The trap still catches errors other than
    the favicon.
- `git status --short` afterwards: only this `review.md`, untracked.
- Taken on trust: nothing new beyond round 1's list.

# Round 1 (history)

- verdict: rework
- tier: reviewed
- reviewed-commit: f6b6e317bfa6d53e3d8c95b5d43ac5bf23621dfb
- round: 1
- sampled: no
- live-check: owed

Resolutions (round 2): the favicon MEDIUM and the `CLAUDE.md`/`sdlc.md`
MEDIUM were **fixed in `62a647c`**. The tween MEDIUM, the visibility LOW
and the divergence-list LOW are **open, worth a look**.

Tier set by input 1 (paths): the diff touches `REVIEW-POLICY.md`,
`.claude/skills/review/SKILL.md`, `.claude/agents/heraklios-reviewer.md` and
`.codex/agents/heraklios-reviewer.toml`, all Reviewed. (`eslint.config.js`
only adds `test-results/` and `playwright-report/` to `ignores` — output
directories, no rule loosened; the lint cap stays 21.) Stamp is 0.1.2: this
run used the skill as it stands on `main`; the branch's 0.1.3 applies from
the next review after merge.

### Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | pass — digital-only; one rule assumption checked (below) |
| 4 | Tests prove the rule, not only pass | findings (3) |
| 5 | Engine/presentation boundary and conventions | pass |
| 6 | Numbers in prose | pass |
| 7 | Documentation | findings (1) |
| 8 | Guardrails and hygiene | pass |
| 9 | Repository-specific footguns | pass — no drift, AI or map-editor change; `src/engine`/`src/data` untouched |

### Type check
```
> heraklios@0.1.0 check:intent
> node scripts/check-intent.mjs

type-check: PASS (intent 32, feature)
  note:  26 file(s), 826 line(s) changed outside intents/.
```

### Findings
- **MEDIUM** `e2e/helpers.ts:34` — the console-error trap fails every
  scenario in a **headed** run, which is the run AC8 and this report's live
  check ask for. Full Chromium requests `/favicon.ico` when it opens a
  window. `index.html` declares no icon, so Vite answers 404. Chromium logs
  "Failed to load resource: … 404", and `startFromMenu` collects it as an
  error. Every scenario passes all its game assertions, then fails on
  `expect(errors).toEqual([])`. The headless shell behind `npm run e2e`
  never fetches the favicon, which is why the default run is green. Found
  by the owner running step 1 below. I reproduced it: `npx playwright test
  --headed` → 4 failed, each with that one 404, and a probe spec showed the
  console message's location is `http://127.0.0.1:5232/favicon.ico`.
  Needs rework: in `startFromMenu`, skip a console error whose
  `m.location().url` ends in `/favicon.ico` (narrow, keeps every other 404
  fatal; comment why). Don't add an icon to `index.html` instead: that
  widens the change and owes its own live check. Then run `npx playwright
  test --headed` once and record it in Progress.
- **MEDIUM** `CLAUDE.md:73-79` — the new "only exception" sentence is looser
  than the policy it summarises (B10). `REVIEW-POLICY.md` → "When the smoke
  suite stands in" requires that the check be owed **by rule 1 alone** and
  that **`/review` ran `npm run e2e` itself**. `CLAUDE.md` drops both and says
  only "a passing `npm run e2e` scenario already covers the changed
  behaviour". It also sits right after the "and so does any other change
  whose Not checked list…" clause, so it reads as if the exception covers
  rule 3 too. The sentence after it, "The owner runs it and records…", now
  reads as "the owner runs the suite". `CLAUDE.md` is the context file every
  implementer reads, so this is the version agents will act on. `sdlc.md:59-62`
  has the same gap: it keeps "/review ran the suite" but drops "rule 1
  alone". AC7 only lists the policy, skill and agents, which all agree.
  Needs rework: in `CLAUDE.md`, state both conditions (owed by the path rule
  alone; `/review`'s own passing run, naming the scenario) and move "The
  owner runs it…" before the exception, or reword it as "Otherwise the owner
  runs the live check…". In `sdlc.md`, add "owed only because of the paths
  it touches".
- **MEDIUM** `src/ui/devHook.ts:102` — `idle()`'s "no tween is running"
  half (spec B4) is unproven: mutating `if (tweens)` to `if (false)` leaves
  all four scenarios green (and Vitest, which can't see it). No scenario
  waits on a tween today, so a later change that breaks tween detection
  passes silently, and so would a scenario added later whose result depends
  on one. Worth a look: either add a scenario step that has to wait for a
  board tween (a move that animates, if any does), or state in the spec or
  helper comment that tween-waiting is unproven.
- **LOW** `src/ui/devHook.ts:117` — the `!obj.visible` and
  `!obj.input?.enabled` filters in `candidate()` both survive mutation. No
  scenario looks up a label whose hidden or disabled twin is on screen.
  ('Resolve attack' and "Don't advance" are hidden most of the time, but each
  exists once, so `buttonCount` is 1 either way. `settle` only asks after
  `idle()` is false.) Worth a look: a scenario-level
  `expect(buttonCount('Resolve attack')).toBe(0)` during movement would pin
  the visibility filter.
- **LOW** `intents/32-e2e-smoke-suite/plan.md` Progress, "Diverged from the
  plan" — the hook's surface differs from spec B4 in ways the list doesn't
  record. `hexToCanvas` doesn't centre the camera itself; a separate
  `centerOn(hex)` does, and the helpers call it first. `state()` is a JSON
  copy, not `structuredClone`, and carries neither `testMode` nor the mode
  marker; the marker comes from a separate `testScenario()`. `seed`,
  `busy` and `pendingHexes` are listed; `centerOn` and `testScenario` are
  not. All of these are reasonable. Worth a look: add them to the
  divergence list so the spec and code don't disagree silently.

Nits: `.claude/skills/review/SKILL.md` adds a stray blank line inside the
step-1 code block. `e2e/attacks.spec.ts:219` computes `step` through
`enemyAt(...)` around a hard-coded `r < 4`, which is a long way to say ±1.

### Not checked
- **Rulebook (pass 3):** nothing to check against `docs/research/`; this is
  test infrastructure. The one rule the suite encodes itself,
  `e2e/naval.spec.ts:507` "a turn costs one movement point", matches
  `src/engine/navalMovement.ts:23` ("1 point per 60° turn"). I did not
  re-derive it from the rulebook. If it were wrong, the test would fail
  rather than pass falsely.
- **Advance prompt coverage depends on seed 1.** Mutant #17 shows seed 1's
  melee does raise an "advance" offer, so the `settle` decline path runs.
  Other seeds were not inspected for which prompts they hit (16/16 passed).
- **Equivalent or test-only mutants, not counted as gaps:**
  `!Number.isInteger(index)` (#14) survives because `found[0.5]` is
  `undefined` and the `!hit` guard throws anyway. Removing the source-hex
  redraw `expect` (#19) is a test-line removal. The destination-hex check and
  the position assertion remain.
- **`session.testScenario` resets** in `resetSession`/`resetToMenu` (#15,
  #16) survive. The marker is only read by the dev hook, so a stale value
  could only mislead a test that starts a non-test game after a test one in
  the same page, and no scenario does.
- **AC1's 20-run loop** — not repeated (I ran the suite 1×, plus 20 mutant
  runs, plus 16 seeds of the attack scenario). **AC8** is the owner's.
- **Normal (non-test-mode) play with the hook installed**: not seen. I did
  not drive the browser myself beyond the headed runs below. (The headed
  run was missing from my first pass, and that gap hid the favicon
  finding.)
- **Linux/macOS, CI**: out of scope and not tried.
- **`@types/node` ^24.19.2 alongside `vitest/globals`** — type-checks clean
  under `tsc -b` (verify green). I did not check whether its `setTimeout`
  typings now differ in `src/` code, which compiles either way.

### Live check
- owed: rule 1. The diff touches `src/ui/**` (`devHook.ts`, `session.ts`,
  `testMode.ts`) and `src/main.ts` (rule 1 as this branch amends it). The
  smoke-suite exception can't apply to the change that introduces the suite:
  the hook is new behaviour.
- steps (AC8): in `C:\Users\eric\src\heraklios-wt\32-e2e-smoke-suite`,
  stop any dev server on 5232, then:
  ```
  cd C:\Users\eric\src\heraklios-wt\32-e2e-smoke-suite
  ```
  (not the main checkout: `main` has no `playwright.config.ts`, and a bare
  `npx playwright test` there picks up the Vitest files and fails with
  "Vitest failed to access its internal state").
  1. `npx playwright test --headed` — after the favicon fix above; until
     then each scenario ends with the favicon 404. Watch the four scenarios. You should
     see Chromium open the Menu four times. Land-move and save-load click
     "Mode test (2 joueurs, armées prêtes)"; attacks and naval click "Mode
     test combat (unités face à face, 2 cases)". Then: a fantassins unit
     steps one hex; infantry closes, End phase, archers shoot (a retreat hex
     gets clicked if offered), infantry melees ("Don't advance" if offered);
     a galley turns once via a "Turn" button and moves one hex; the
     💾 Save / Load panel opens, saves slot 1, closes, an archer moves, and
     loading slot 1 puts the archer back. `4 passed`.
  2. `npm run dev -- --port 5232` → open `http://localhost:5232` → start a
     **normal** 2-player game (not a test-mode shortcut): build armies,
     place, play one full turn (a move, an attack, end phase).
- you should see: in step 2, nothing different from `main`, and no console
  errors. In DevTools, `window.__heraklios` exists (dev only) and
  `__heraklios.testScenario()` returns `null` in the normal game.

### Verified myself vs. taken on trust
- `npm run verify` (worktree, `f6b6e31`): build OK; lint 0 errors / 21
  warnings (cap 21, unchanged from `main`); Vitest 36 files, **615 passed**
  (the only new test file is `devHookMatch.test.ts`, with 7 tests, so 608
  were already on `main`; I did not run `main` separately).
- `npm run check:intent`: PASS (output above).
- `npm run e2e` (B11): **4 passed (13.7 s)**, including the AC5 build check
  in global setup.
- **B1:** a plain HTTP server on `127.0.0.1:5232`, then `npm run e2e` →
  exit 1 after 1.5 s with "http://127.0.0.1:5232 is already used". The
  server was not reused.
- **Attack scenario, `H32_SEEDS=1..16`:** 16 passed (36.0 s), which
  reproduces Progress's 16/16.
- **Mutations** (scratchpad `mut32.mjs`, one at a time; each runs the full
  Vitest suite and `npm run e2e`, then restores the file from a byte copy;
  `git status --short` clean afterwards). 13 killed, 7 survived:

  | # | Mutant | Result |
  | --- | --- | --- |
  | 0 | AC2 `landMove` `applyAction` stubbed | killed (land-move, save-load, attacks) |
  | 1 | AC2 'Resolve attack' handler no-op | killed (attacks: "ranged attack resolved") |
  | 2 | AC2 `rotateSelectedShip` no-op | killed (naval: "the ship turned") |
  | 3 | AC2 `adoptSave` no-op | killed (save-load) |
  | 4 | AC3 `'test'` shortcut marks `'close-combat'` | killed (mode assertion) |
  | 5 | AC4 `aiRunning` renamed | killed (all scenarios: `idle()` throws) |
  | 6 | AC5 `import.meta.env.DEV` guard → `true` | killed (global setup names `devHook-*.js`) |
  | 7 | `busy()` always `[]` | killed (attacks) |
  | 8 | `busy()` ignores tweens | **survived** (finding) |
  | 9 | `pendingHexes()` always `[]` | killed |
  | 10 | `candidate` ignores `visible` | **survived** (finding) |
  | 11 | `candidate` ignores `input.enabled` | **survived** (finding) |
  | 12 | `pickButton` takes first duplicate | killed (Vitest) |
  | 13 | reading order loses x tiebreak | killed (Vitest) |
  | 14 | drop `Number.isInteger` guard | survived — equivalent |
  | 15 | `resetToMenu` keeps `testScenario` | survived — inert (Not checked) |
  | 16 | `resetSession` keeps `testScenario` | survived — inert (Not checked) |
  | 17 | `settle` never declines advance | killed |
  | 18 | `settle` never answers hexes | killed |
  | 19 | drop source-hex redraw `expect` | survived — test-line removal |
- Read the full diff (excluding `package-lock.json`) and the intent's
  `intent.md`, `spec.md`, `plan.md` (with Progress) and `metadata.yml`
  (`status: in-review`, plan approved 2026-10-16). Spec amendments B4, B7
  and AC5 match the approved plan's "Spec changes".
- Taken on trust: AC1's 20/20 loop, and §30's figures quoted in the README
  (~720 MB; checked against `intents/30-browser-test-probe/findings.md:70`,
  not re-measured).
- **Headed run** (2026-10-20, after the owner's report): `npx playwright
  test --headed` → 4 failed, each on `expect(errors).toEqual([])` with one
  "Failed to load resource: … 404". A throwaway probe spec, copied into
  `e2e/`, run headed and then deleted, logged that message's location as
  `http://127.0.0.1:5232/favicon.ico`. The same page load headless logged
  nothing. `git status --short` clean apart from this report afterwards.
