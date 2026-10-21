<!-- generated-by: heraklios/intent@0.1.2 -->
# §41 plan — An e2e run can fail before any scenario: the game's first load never arrives

Intent: [intent.md](intent.md)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Know, for every red `npm run e2e`, whether the code failed or the machine
did; fix what is the repo's to fix; and stop two worktrees' suites from
breaking each other (intent → Outcome).

## What the coordinator found before planning (2026-10-21)

**The red run in §38's review was the laptop going to sleep.** Windows'
System log (`Get-WinEvent`, Kernel-Power):

| Local time | Event |
| --- | --- |
| 22:15:49 | 524 "Critical Battery Trigger Met" |
| 22:15:52 | 42 "The system is entering sleep" |
| 22:15:55 | 107 "The system has resumed from sleep" |
| 22:16:23 | 105 "Power source change" (charger) |

The trace's failed requests (`/src/main.ts`, `env.mjs`, with
`net::ERR_NETWORK_IO_SUSPENDED`) are stamped 20:15:51Z = **22:15:51
local**, inside that window. Lead (a) is confirmed for that run.

The same log shows short sleep/resume cycles (3–4 s) on 2026-10-20 at
02:18, 23:50, and on 2026-10-21 at 06:55, 08:28, 10:14, 13:16, 17:26. The
earlier flakes' exact times weren't recorded, so whether they coincide is
**not known**. Lead (b), the shared port, is untested.

## Risks

- **Blaming the machine for a real defect.** A sleep explains a run only if
  it falls inside that run's window; the check must compare times, not
  just look for any sleep that day.
- **Windows-only tooling in the suite.** The sleep check must be optional
  (skip quietly where `Get-WinEvent` doesn't exist) and must never turn a
  red run green; it only adds a line to the failure output.
- **Port change breaking §32's guarantees.** A per-worktree e2e port must
  still never reuse another checkout's server, and the global setup's
  production-build check must keep running.
- **Lint cap 21**: new scripts and config add no warning.

## Verified against the codebase

Re-read on `main` at `3c5ce12`:

- `playwright.config.ts:6-7` `PORT = 5232` ("5200 + (32 mod 100), the
  spawn rule"); `:14-16` the §38 comment (bad byte `0xA7` at "§38") and
  `reporter: [['list'], ['line']]`; `:22` `trace: 'retain-on-failure'`;
  `:24-30` `webServer` with `--strictPort`, `reuseExistingServer: false`.
- `scripts/spawn-intent.mjs:97` `portFor(id)` (5200 + id mod 100) from
  `scripts/session-lib.mjs`; each worktree's `CLAUDE.local.md` names its
  port.
- `e2e/global-setup.ts` builds into a temp dir and checks the hook isn't
  in the production build.
- `CLAUDE.md:30`, `:38` and `README.md:40` say "port 5232".

## Subtasks

1. **Config clean-up (§38 review's LOWs).** One reporter (`list`); the
   comment's "§38" as UTF-8. One commit.
2. **Lead (b), test it.** Script (in `scripts/`, kept if useful): start
   suite A, then suite B in a second worktree (or a copy) at offsets 0 s,
   while A runs, and as A's server shuts down. Record what B does:
   refuses cleanly ("already used"), or starts and fails. If any offset
   breaks a run that isn't refused, it's a cause.
3. **Separate ports (if 2 shows a problem, or anyway if cheap).** The e2e
   port comes from the worktree: `E2E_PORT` env or derived like
   `portFor`, distinct from the dev port (e.g. 5300 + id mod 100; main
   checkout keeps 5232). Docs (`CLAUDE.md`, `README.md`) updated. If 2
   shows no problem, record that and skip this subtask.
4. **Name a machine sleep in a red run (lead a).** A Playwright global
   teardown (or reporter hook) that, only when the run had failures, asks
   Windows for Kernel-Power events 42/107/524 between the run's start and
   end and prints e.g. "The machine slept at 22:15:52 during this run
   (critical battery); its failures may not be the code's." Pure parsing
   and window logic in a small module with unit tests (sample event lines
   inside/outside the window, no events, non-Windows); the PowerShell call
   is the thin untested part. One commit.
5. **README** (`npm run e2e` paragraph): a red run that reports a sleep is
   rerun after the machine is on mains power; any other red run is read
   from its trace, never just rerun.
6. **Hand-over.** `verify`, `check:intent`, `npm run e2e` 3× as first runs
   in fresh worktrees; subtask 2's results and the sleep check's output
   from a forced failure in Progress; `status: in-review`; `follows_up:
   32` only if subtask 2 shows the shared port is a cause.

## Tests

- Unit tests for the sleep-window module (subtask 4): an event inside the
  window is reported; one a second before or after isn't; several events
  are listed in order; empty input and a non-Windows platform print
  nothing. Mutants: the window bounds (`<` / `<=`), the event-id filter.
- Subtask 2's script is the failing-first check for lead (b), if it
  reproduces.
- A forced e2e failure shows the sleep line only when a sleep falls inside
  the run (checked by feeding the module a recorded event list, not by
  sleeping the machine).

## Validation

- `npm run verify` green, lint ≤ 21.
- `npm run check:intent` PASS.
- `npm run e2e` passes 3 times as a fresh worktree's first run.
- No live check owed by path (`e2e/`, `scripts/`, `playwright.config.ts`,
  docs); if `vite.config.ts` changes, one is.

## Assumptions I made

- Reading the Windows event log needs no admin rights (the coordinator's
  `Get-WinEvent` above ran without them).
- A critical-battery sleep is the owner's machine, not the repo's to fix;
  naming it in the output is the fix.
- If subtask 2 finds nothing, separate ports are still worth it only if
  they're a few lines; otherwise recorded as not needed.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
