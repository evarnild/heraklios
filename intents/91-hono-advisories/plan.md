<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §91 plan — npm audit clears the hono advisories in the orchestrator's Agent SDK

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve. Don't push through.

## Goal

`npm audit` reports 0 vulnerabilities, because the lockfile pins `hono` at
4.13.18 and `@hono/node-server` at 2.1.7. Both are inside
`@modelcontextprotocol/sdk`'s declared ranges, both are past every advisory,
and both are 14 days old or more. `package.json` doesn't change, there is no
`overrides` entry, and the lockfile diff touches only those two packages.

## Risks

- **Lockfile churn.** `npm audit fix` and plain `npm install` can rewrite the
  lockfile with every optional platform binary (`lightningcss-*`,
  `@rolldown/binding-*`, `fsevents`). Its dry run showed exactly that. The
  outcome forbids it, so the method below avoids `npm audit fix`, and the
  check counts every changed package in the lockfile diff.
- **Too-new releases.** `hono` 4.13.22 was published today and 4.13.21 two
  days ago. `npm update` would take one of them, breaking the pin rule. So the
  versions are set exactly.
- **An override left behind.** The method uses a temporary `overrides` entry
  to steer the lockfile. If it stays in `package.json`, the outcome fails.
  The check confirms `package.json` is byte-identical to `main`.
- **The orchestrator.** It is the only consumer, through
  `@anthropic-ai/claude-agent-sdk` → `@modelcontextprotocol/sdk`. No unit
  test starts a real SDK session, so a smoke start of the orchestrator is the
  runtime check.
- **The lint cap.** No source changes, so lint is untouched (18 warnings, cap
  18).

## Verified against the codebase

Re-read on `main` at `a57fe21` (2026-11-25).

- `npm audit` on `main` reports `@hono/node-server 2.0.0 - 2.1.5` (GHSA-qv5m-9pm6-hqp3, GHSA-jpvv-r467-5p4w), `hono <=4.13.15` (GHSA-4m76-xfj5-7975, -h7mg-cq63-vhpq, -3gg2-335m-rxc6, -46wx-v44x-9hh2, -4h7h-rv7c-7m2v), and "2 moderate severity vulnerabilities".
- `npm ls hono @hono/node-server` gives `@anthropic-ai/claude-agent-sdk@0.3.309` → `@modelcontextprotocol/sdk@1.32.2` → `@hono/node-server@2.1.5` (with `hono@4.13.13` deduped) and `hono@4.13.13`.
- `npm view @modelcontextprotocol/sdk@1.32.2 dependencies` gives `hono: '^4.11.4'` and `'@hono/node-server': '^1.19.9 || ^2.0.5'`.
- `package.json:28` has `"@anthropic-ai/claude-agent-sdk": "0.3.309"` (pinned exactly, §52). There is no `overrides` key today.
- Release dates from `npm view <pkg> time`:
  - `hono` 4.13.15 (2026-11-01, still vulnerable), 4.13.16 (2026-11-01, the first fixed), 4.13.17 (11-07), **4.13.18 (11-11)**, 4.13.19 (11-16), 4.13.20 (11-22), 4.13.21 (11-23), 4.13.22 (11-25);
  - `@hono/node-server` 2.1.5 (2026-10-13, vulnerable), 2.1.6 (11-02, the first fixed), **2.1.7 (11-11)**, 2.1.8 (11-12), and later.
- The pin rule (§56, §63): the newest release at least 14 days old, so on or before 2026-11-11. That gives **hono 4.13.18** and **@hono/node-server 2.1.7**. Both clear every advisory above (ranges `<=4.13.15` and `2.0.0 - 2.1.5`).
- `tools/orchestrator/`: `npm run orchestrator` serves on 127.0.0.1:5299 (`CLAUDE.md`).

## Where this goes

- **Modules touched:** `package-lock.json` only. `package.json` ends
  byte-identical to `main`.
- **New modules:** none.
- **Why there:** a dependency pin is build config. No code changes.
- **Budget lines:** none.

## Subtasks

1. **Record the red state.** Save `npm audit` (2 moderate, non-zero exit)
   and `npm ls hono @hono/node-server` output for Progress. This is the
   failing-first check: the intent names no unit test.
2. **Steer the lockfile without churn:**
   1. `npm pkg set overrides.hono=4.13.18 "overrides.@hono/node-server=2.1.7"`
   2. `npm install --package-lock-only --ignore-scripts`
   3. `npm pkg delete overrides`
   4. `npm install --package-lock-only --ignore-scripts` again. npm keeps the
      locked versions, because they satisfy the SDK's ranges.
   5. `git diff --exit-code main -- package.json` must show no difference.
   6. Inspect `git diff -- package-lock.json`: only the `node_modules/hono`
      and `node_modules/@hono/node-server` entries (version, resolved,
      integrity), plus any new dependency they require, and nothing else.

   If npm adds unrelated entries, stop and report the diff. Don't hand-edit
   the lockfile.
3. **Install and verify:** `npm ci`, then `npm audit` (expect `found 0
   vulnerabilities`) and `npm ls hono @hono/node-server` (expect 4.13.18 and
   2.1.7, deduped under the SDK). Then `npm run verify`. Commit.
4. **Smoke-start the orchestrator.** Run `npm run orchestrator` in the
   background, then fetch `http://127.0.0.1:5299/` and confirm it answers
   200 with its page. Stop the process you started. Record it.
5. **A fresh-install check.** In a scratch clone of the branch, outside the
   repo (e.g. the session scratchpad), `npm ci` must report no
   vulnerabilities. Delete the clone afterwards.

## Tests

No unit test covers a dependency version. The checks are:

| Outcome | Check | What it catches |
| --- | --- | --- |
| `npm audit` clean | `npm audit` exits 0 with `found 0 vulnerabilities` (subtasks 3 and 5) | Any advisory still in range |
| In-range pins, no override | `npm ls` shows 4.13.18 and 2.1.7 under the SDK; `git diff main -- package.json` is empty | A leftover `overrides` entry, or versions outside the ranges |
| No churn | the lockfile diff touches only `hono` and `@hono/node-server` (plus their new dependencies, if any) | `npm audit fix`-style platform-binary additions |
| Nothing else broke | `npm run verify` has the same test count and 18 warnings as `main`; the orchestrator's vitest files (`tools/orchestrator/**/*.test.mjs`) pass | A behaviour change in a dependency the tests reach |
| The orchestrator runs | the smoke start (subtask 4) | The SDK failing to load with the new hono |

## Validation

- `npm run verify` green, lint 18 (cap 18).
- `npm run check:intent`: PASS expected, or a ROUTE for "no test changed" on
  a fix. If ROUTE, review.md states the reason: a lockfile-only fix with
  `npm audit` as its check, as §63's was.
- `npm run e2e`: not owed by the paths. Run it once anyway, because the
  lockfile is shared tooling.
- Live check: none by path. The orchestrator smoke start is evidence in
  Progress, not the gate.

## Assumptions I made

- **The newest release at least 14 days old** (4.13.18 and 2.1.7), not the
  oldest fixed one (4.13.16 and 2.1.6). This follows §56's and §63's pin
  rule. The intent asked the plan to name the oldest fixed release and its
  date, and both are listed under Verified.
- **The temporary-overrides method** is a means to write the lockfile, not a
  shipped override. The checks prove `package.json` is untouched.
- **`--ignore-scripts`** while rewriting the lockfile, so no install script
  runs. The `npm ci` in subtask 3 runs normally.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
