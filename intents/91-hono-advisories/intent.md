<!-- generated-by: heraklios/intent@0.1.5 -->
# §91 — `npm audit` clears the hono advisories in the orchestrator's Agent SDK

**Type:** fix
**Originator:** the owner (2026-11-25), after `npm ci` in the main checkout
printed "2 moderate severity vulnerabilities": "fix npm ci"
**Source:** `npm ci` and `npm audit` on `main` at `de2af05`; §63 for the
precedent (`intents/63-minimatch-advisory`)

## Problem

`npm ci` ends with "2 moderate severity vulnerabilities", and `npm audit` on
`main` lists them:

- `@hono/node-server 2.0.0 - 2.1.5`:
  - GHSA-qv5m-9pm6-hqp3: "Unhandled `ECONNRESET` on the socket during an
    asynchronous WebSocket upgrade crashes the process";
  - GHSA-jpvv-r467-5p4w: "Backslash in the request path is parsed as a path
    separator, bypassing path-based access control at a reverse proxy".
- `hono <=4.13.15`: five advisories, GHSA-4m76-xfj5-7975, -h7mg-cq63-vhpq,
  -3gg2-335m-rxc6, -46wx-v44x-9hh2 and -4h7h-rv7c-7m2v (middleware bypass,
  `css` helper HTML injection, `csrf()` hyperlink-auditing gap, multipart
  validation skip).

Both come in through one dev dependency:
`@anthropic-ai/claude-agent-sdk@0.3.309` (§52, the orchestrator) →
`@modelcontextprotocol/sdk@1.32.2` → `hono@4.13.13` and
`@hono/node-server@2.1.5`. `@modelcontextprotocol/sdk` declares `hono:
'^4.11.4'` and `'@hono/node-server': '^1.19.9 || ^2.0.5'`, so fixed
releases are inside its own ranges. `npm audit` reports "fix available via
`npm audit fix`", with no `--force`.

The game never loads either package. They're dev-only, reached by the
orchestrator's headless sessions (`tools/orchestrator/`), which listen on
127.0.0.1 only (§52). Still, `npm ci` warns on every worktree spawn and every
clean install, and §56's and §63's outcome is an `npm audit` at 0.

## Outcome

- `npm audit` on the branch reports 0 vulnerabilities. `npm ls hono
  @hono/node-server` shows versions past the advisories' ranges
  (`hono >4.13.15`, `@hono/node-server >2.1.5`), reached within
  `@modelcontextprotocol/sdk`'s declared ranges, with no new `overrides`
  entry (§63's existing `minimatch` override stays as it is).
- No package in the lockfile is added, removed or re-versioned except `hono`
  and `@hono/node-server`, plus anything they newly need. **Amended
  2026-11-25 (owner's choice, "Accept peer-flag churn"):** npm 10.9.3
  re-marks the `"peer": true` flags on about 90 unrelated packages whenever
  it rewrites the lockfile. Those flag-only lines are accepted. Every other
  changed line must be one of the two packages' own. `npm audit fix`'s
  optional platform-binary additions are still not part of this fix.
- `npm ci` in a fresh worktree reports no vulnerabilities.
- `npm run verify` stays green with the same test count and lint warnings,
  and the orchestrator's own tests (`tools/orchestrator/**/*.test.mjs`, run
  by vitest) pass unchanged.

## Constraints

- **`package.json` and `package-lock.json` only.** No `src/`, `server/`,
  `tools/` or test change.
- **The pin rule used by §56 and §63:** prefer releases at least 14 days old.
  `hono`'s newest release is 4.13.22, and its registry entry was modified on
  2026-11-25. The plan names the oldest release that clears each advisory,
  and that release's date. If none is 14 days old yet, the plan says so and
  the owner decides whether to wait or take the newer one.
- **No `npm audit fix --force`, and no override** unless the plan proves the
  in-range path impossible.
- **The orchestrator stays runnable.** `npm run orchestrator` starts and
  serves its page on 127.0.0.1:5299. Its sessions are what use the SDK. A
  smoke start is the plan's check, since no automated test launches a real
  SDK session.

## Type-specific questions

### Fix
- **What broke:** `npm ci` and `npm audit` report 2 moderate entries, covering
  7 advisories in `hono` and `@hono/node-server`.
- **Since when:** the advisories' publication, after §52 added the SDK on
  2026-10-23 (`5e01015`, pinned at 0.3.309). No heraklios commit introduced
  them.
- **Impact:** dev-only. The orchestrator's local server path could be hit by
  a crafted local request; nothing reaches the game bundle, a save or the
  save API (`server/` doesn't use hono). The warning shows on every `npm ci`.
- **Reproduction:** `npm audit` on `main`, or `npm ls hono
  @hono/node-server`, which shows `hono@4.13.13` and `@hono/node-server@2.1.5`.
- **The test that will fail first:** none in the suite, as with §63. The
  check is `npm audit` itself: today it reports 2 moderate and exits non-zero;
  after the fix it must report `found 0 vulnerabilities`. The plan records
  both outputs.

## Assumptions I made

- **"fix npm ci" means its vulnerability report.** `npm ci` also prints
  "npm warn deprecated eslint@9.39.5: This version is no longer supported";
  `npm view eslint version` gives 10.15.0. Moving the lint toolchain to
  eslint 10 is a major upgrade that can change rules and the warning count
  (the cap is 18). It belongs in its own refactor intent, like §56 was for
  vite and vitest, and is out of scope here. I can draft it.
- **`follows_up:` left empty,** as for §63. §52 added the dependency, but the
  defect is the later advisories, not §52's change.
- **Review tier left empty.** The path table makes `package.json` and the
  lockfile "build config", Attested.
- **No live check by path.** The orchestrator smoke start is in the
  Outcome as the plan's check, not a gate.
- **No `blocked_by`.**
