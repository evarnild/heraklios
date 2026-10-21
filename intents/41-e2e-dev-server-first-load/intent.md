<!-- generated-by: heraklios/intent@0.1.2 -->
# §41 — An e2e run can fail before any scenario: the game's first load never arrives

**Type:** fix
**Originator:** `/review` of §38 (round 1); owner: "yes for 38 and follow up"
**Source:** `intents/38-e2e-first-run-flake/review.md` → Findings, first
item

## Problem

§38 set out to find why the first `npm run e2e` sometimes fails, and
closed with only the capture (a failure names itself and keeps a trace):
nothing reproduced. Its review then caught a red run with that capture:

- First `npm run e2e` in the §38 worktree, started seconds after another
  worktree's suite freed port 5232: **6 of 7 scenarios failed**, all on the
  30 s timeout waiting for the dev hook (`e2e/helpers.ts` `startFromMenu`);
  the run took 55 s.
- The trace (`land-move`): `/` → 200, `/@vite/client` → 200, then
  `/src/main.ts` and `/node_modules/vite/dist/client/env.mjs` **failed**,
  console "Failed to load resource: **net::ERR_NETWORK_IO_SUSPENDED**" ×2.
  The game never loaded.
- The next runs passed 7/7 (15.4 s).

So at least one kind of red run fails at the dev server, before any
scenario logic, which fits the pattern from §33, §35 and §37's reviews
(only a first run fails, sometimes slowly). The save-load failure §35
named may be the same thing or a second cause.

## Outcome

- The cause of the failed first load is found and written down, with a
  way to make it happen on demand.
- Either it is fixed (the first `npm run e2e` in a fresh worktree passes,
  3 times), or, if it is outside the repo (a Windows power setting), the
  README says so and `npm run e2e` fails with a message that names it
  rather than six timeouts.
- If the shared port is a cause: two worktrees can run `npm run e2e` at
  the same time without one breaking the other, or the second refuses
  cleanly before starting.

## Constraints

- `e2e/`, `playwright.config.ts`, `scripts/` and docs; no game change. A
  `vite.config.ts` change owes a live check (`REVIEW-POLICY.md` → "Live
  checks", rule 1).
- §32's rule stands: never reuse a server already on the port (it could be
  another checkout's code). A per-worktree port is allowed if `/spawn`'s
  port rule (5200 + id) and §32's global setup still hold.
- No `retries` to hide it (§38's constraint).

## Type-specific questions

### Fix
- **What broke:** a run's first page load gets no `main.ts` from Vite;
  every scenario times out.
- **Since when:** unknown; first seen in §33's review (2026-10-20).
- **Impact:** a red suite that isn't the code's fault; reviews lose trust
  in red runs. No game or save affected.
- **Reproduction:** to find. Two leads from §38's review:
  - **(a)** Chromium reports `ERR_NETWORK_IO_SUSPENDED` when the OS
    signals a network or power suspend: a Windows power or efficiency
    mode, or sleep, throttling the browser or Node while Vite answers its
    first and slowest requests (Vite transforms `main.ts` and its imports
    on first request).
  - **(b)** **Port 5232 is shared by every worktree's suite**
    (`playwright.config.ts` `PORT = 5232`): during §38's review the §40
    session's runs held it three times; the red run started seconds after
    that server stopped.
- **The test that will fail first:** a script that starts two suites a
  few seconds apart (lead b), or one that runs the suite while a power
  plan suspends background IO (lead a). Whichever reproduces becomes the
  failing-first check.

## Assumptions I made

- **Fix, no `follows_up`.** If the cause turns out to be §32's fixed port,
  set `follows_up: 32`.
- §38's capture (`trace: 'retain-on-failure'`) stays and is how each
  attempt is read.
- §38 review's two LOWs on `playwright.config.ts` (duplicate reporter, the
  corrupted "§" byte in the comment) are fixed here too, since this
  intent edits that file anyway.
