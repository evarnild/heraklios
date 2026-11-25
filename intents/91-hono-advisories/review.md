<!-- generated-by: heraklios/review@0.2.0 -->
# §91 review — npm audit clears the hono advisories in the orchestrator's Agent SDK

verdict: attest
tier: attested
reviewed-commit: c2968e5
round: 1
sampled: no
run: auto
live-check: not-needed

Outside `intents/`, the branch changes only `package-lock.json` (113 insertions,
26 deletions). `hono` 4.13.13 → 4.13.18 and `@hono/node-server` 2.1.5 → 2.1.7.
No package is added or removed. Every other changed line is a `"peer": true`
flag, which the owner accepted on 2026-11-25 ("Accept peer-flag churn"), or a
comma that flag moves. `package.json` is byte-identical to `main`, and §63's
`overrides` block is intact. `npm audit` goes from 2 moderate (exit 1) to
`found 0 vulnerabilities` (exit 0). There is one LOW finding, worth a look;
nothing needs rework.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | pass. Only the lockfile changes, through the amended subtask 2. The versions are exactly the plan's. |
| 2 | Type check | pass. ROUTE, reason stated below. |
| 3 | Rulebook fidelity | not run: no rule behaviour changed |
| 4 | Tests prove it | pass. The one behavioural change is the two pins; `main`'s lockfile as the mutant fails `npm audit` (2 moderate, exit 1), and the branch's passes (0, exit 0). By the intent's constraint there is no unit test. |
| 5 | Boundary and conventions | pass. No `src/`, `server/`, `tools/` or test file touched. |
| 6 | Numbers in prose | findings (1, LOW) |
| 7 | Documentation | pass. No README behaviour changed. Progress records the method, the red and green states and the divergences. |
| 8 | Guardrails and hygiene | pass. Lint 18 at a cap of 18. No new dependency. |
| 9 | Repository footguns | pass: none apply |
| 10 | Architecture | pass. Only the lockfile is named in "Where this goes". |

## Type check
```
type-check: ROUTE (intent 91, fix)
  route: Declared fix, but no test changed. A fix carries a test so the defect cannot come back.
  note:  1 file(s), 139 line(s) changed outside intents/.
exit: 2
```
**ROUTE accepted, reason stated here, as for §63.**
- The intent forbids any test change ("`package.json` and `package-lock.json`
  only. No `src/`, `server/`, `tools/` or test change").
- The defect is a vulnerable transitive dependency, not code behaviour. A test
  asserting `npm audit` would depend on the network and on future advisories.
- The intent names `npm audit` itself as the check that fails first. Its red
  run on `main` and green run on the branch are recorded below. The type stays
  `fix`.

## Findings
- **LOW** `intents/91-hono-advisories/plan.md` Progress, "Lockfile diff" bullet:
  "the removed ones are moves of the flag" is inaccurate.
  - A semantic comparison of the two lockfiles shows 6 packages losing
    `"peer": true` outright, with `dev: true` unchanged: `@types/node`,
    `@typescript-eslint/parser`, `acorn`, `eslint`, `typescript` and `vite`.
  - 93 other packages gain it, so 99 packages change in total. The intent's
    "about 90" is close enough.
  - Removals are inside the owner-accepted category (plan subtask 2.6: "lines
    that only add or remove `"peer": true`"), so this is not an outcome breach.
  - It is inert here: nothing uses `--omit=peer` (`spawn-intent.mjs:76` runs
    `npm ci --no-audit --no-fund`).
  - Worth a look: one word in Progress.

## Not checked
- **`npm run orchestrator` from the main checkout.** It refuses to run in a
  worktree (`tools/orchestrator/orchestrator.mjs:42`).
  - The parts this diff can affect were run live in the worktree: importing the
    SDK and its MCP dependency's hono path, and serving through
    `@hono/node-server` (below).
  - The orchestrator's own server is `node:http` (`node-io.mjs`) and never
    imports `hono`. Its only SDK touchpoint is `await
    import('@anthropic-ai/claude-agent-sdk')` (`orchestrator.mjs:26`). The real
    importer of hono is
    `@modelcontextprotocol/sdk/dist/*/server/streamableHttp.js`.
  - Suggested post-merge check, not a gate: on `main`, `npm ci`, then `npm run
    orchestrator`, then fetch `http://127.0.0.1:5299/` and expect 200.
- **A real headless SDK session on the new hono.** No automated test launches
  one.
- **e2e.** Not owed: no source path changed. The implementer's one timeout,
  `unit-tooltip.spec.ts:113`, passed alone. Taken on trust.

## Live check
Not needed. No path rule applies: only `package-lock.json` and intent files
changed. Rule 3 doesn't either: the runtime behaviour this diff can change is
loading and serving with the new `hono` and `@hono/node-server`, and importing
the SDK. All three were run live in the worktree.

## Verified myself vs. taken on trust

**Ran by the reviewer, at `c2968e5`:**
- `git diff main...HEAD -- package.json`: empty. The `overrides` block is
  exactly `{ "@typescript-eslint/typescript-estree": { "minimatch": "11.0.1" }
  }`.
- **A line classifier** on `git diff -U0 main...HEAD -- package-lock.json`:
  `{ '+peer': 93, 'comma-move pair': 14, '-peer': 6 }`, plus 12 lines that are
  exactly the version, resolved and integrity lines (old and new) of the two
  packages. That is 113 added and 26 removed, matching `--numstat`.
- **A semantic comparison** of `main`'s lockfile against the branch's:
  - lockfileVersion 3 on both, 279 packages on both, `added []`, `removed
    []`, key order identical;
  - 93 packages gain `peer` and 6 lose it;
  - the only other field changes are the two packages';
  - the minimatch entries are unchanged (`typescript-estree/node_modules/minimatch
    11.0.1`, `node_modules/minimatch 3.1.5`).
- **Registry integrity** matches the lockfile exactly for `hono@4.13.18` and
  `@hono/node-server@2.1.7`.
- **Pin rule:** `hono` 4.13.18 was published `2026-11-11T08:54:02Z` (4.13.19
  is from 11-16), and `@hono/node-server` 2.1.7 `2026-11-11T09:10:34Z` (2.1.8
  from 11-12). Both are exactly 14 days old and the newest that old. Both are
  in `@modelcontextprotocol/sdk@1.32.2`'s ranges (`^4.11.4`, `^1.19.9 ||
  ^2.0.5`).
- **Red on `main`:** `npm audit` listed both entries and all 7 GHSAs, then `2
  moderate severity vulnerabilities`, exit 1.
- `npm ci` in the worktree: `found 0 vulnerabilities`, exit 0. `npm audit`:
  `found 0 vulnerabilities`, exit 0.
- `npm run verify`: exit 0, `✖ 18 problems (0 errors, 18 warnings)`, `Test
  Files 103 passed (103)`, `Tests 1751 passed | 2 skipped (1753)`.
- **A runtime smoke** (port 5393, a process the reviewer started and closed):
  importing the Agent SDK gave 34 exports, `query` a function. It served a Hono
  app through `@hono/node-server` with `streamableHttp.js` loaded: `200 ok`,
  versions `4.13.18 2.1.7`.
- Nothing touched `main` or was pushed. `git status --short` was clean in both
  checkouts.

**Coordinator, re-run, at `c2968e5` (2026-11-25):**
- **Coordinator, re-run:** `npm audit`. `found 0 vulnerabilities`, exit 0.
  Matches.
- **Coordinator, re-run:** `npm ls hono @hono/node-server`. `@hono/node-server@2.1.7`
  (`hono@4.13.18 deduped`) and `hono@4.13.18`. Matches.
- **Coordinator, re-run:** `git diff --stat main...HEAD -- package.json
  package-lock.json`. `package-lock.json | 139`, `1 file changed, 113
  insertions(+), 26 deletions(-)`, with `package.json` absent. Matches.
- **Coordinator, re-run:** `npm run verify`. `✖ 18 problems (0 errors, 18
  warnings)`, `Test Files 103 passed (103)`, `Tests 1751 passed | 2 skipped
  (1753)`. Matches.
- **Coordinator, re-run:** `npm run check:intent`. The ROUTE above. Matches.
- No mutant to re-run: none survived, and the only "mutant" is `main`'s
  lockfile, shown red above.

**Taken on trust:**
- the implementer's scratch-clone `npm ci`;
- its e2e run;
- its account of the reverted first attempt, of which no trace remains in the
  diff.
