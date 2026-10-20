<!-- generated-by: heraklios/review@0.1.3 -->
# §31 review — Who records a gate, and how

verdict: escalate
tier: reviewed
reviewed-commit: 85af078a8e7603e9748439c301264908f04d4a32
round: 1
sampled: no
live-check: not-needed

Tier set by the path table: `REVIEW-POLICY.md`, `.claude/skills/**`, `.claude/agents/**` and `.codex/agents/**` are all Reviewed, and `metadata.yml` says `review_tier: reviewed`. Nothing raised or lowered it further.

## Passes
| # | Pass | Result |
| --- | --- | --- |
| 1 | Intent and plan match | findings (1) |
| 2 | Type check | pass |
| 3 | Rulebook fidelity | not run — no rule, `src/` or `docs/research/` change; the "sources" are process documents (pass 7) |
| 4 | Tests prove the rule | findings (1) |
| 5 | Engine/presentation boundary | pass — no `src/` change, no save format, no undo boundary |
| 6 | Numbers in prose | pass |
| 7 | Documentation | pass (with the pass-1 note) |
| 8 | Guardrails and hygiene | pass |
| 9 | Repository-specific footguns | not run — no drift, AI-tier or map-editor change |

## Type check
```
type-check: PASS (intent 31, feature)
  note:  14 file(s), 253 line(s) changed outside intents/.
```

## Findings
- **LOW** `sdlc.md:75` — spec B10 lists `sdlc.md:22`, `:32` and `:75`, and the diff changes only `:22` and `:32`. Progress says why: `:75` ("Approve and merge — your gate") is the change-approval gate, which the spec's Out of scope leaves unchanged. That reading holds, but the spec was not amended to match. Worth a look: strike `:75` from B10 or leave as is.
- **LOW** `scripts/scan-lib.mjs:7` — mutant `HASH_RE` `{7,40}` → `{1,40}` survived the full suite. The 7-character minimum is not pinned by any test (`scan-lib.test.mjs` uses non-hex and 7-plus-character hashes only). Worth a look: add a `merged: 'abc'` case expecting "not a commit hash".
- **LOW** `scripts/intent-check-lib.mjs:165-168` — the gates-before-code loop calls `parseGate` twice per gate. Nit; no behaviour effect.

No finding needs rework.

### Mutations (pass 4)
All run against `npx vitest run scripts`, files backed up and restored by me; `git status --short` clean afterwards. The harness reported `NOAPPLY` for three of my first patterns (a quoting error in my script) and I reran those three with simpler patterns.

| Line | Mutation | Result |
| --- | --- | --- |
| `parseGate` | owner/agent flipped | killed |
| `GATE_RE` | `$` anchor dropped | killed |
| `GATE_RE` | `^` anchor dropped | killed |
| `GATE_RE` | space made optional (`2026-10-20by-agent` accepted) | killed |
| `parseGate` | `[]` not read as empty | killed |
| `parseGate` | `undefined` not read as empty | killed |
| `checkChange` loop | malformed `continue` removed | killed |
| `checkChange` loop | recorded gate not skipped | killed |
| `checkChange` | `touchesSource` forced true | killed |
| malformed FAIL | checks only the type's gates, not `GATE_FIELDS` | killed |
| `checkLiveCheck` | `!== 'empty'` → `=== 'recorded'` | killed |
| `session-lib` `isRecorded` | back to the bare-date regex | killed |
| `scan-lib` `HASH_RE` | loosened to `.*` | killed |
| `scan-lib` `HASH_RE` | minimum length 7 → 1 | **survived** (finding above) |
| `scan-lib` | unresolvable-`merged` check removed | killed |
| `scan-lib` | whole `merged` check removed | killed |
| `scan-lib` | malformed-gate problems removed | killed |
| `gateShares` | agent counted as owner | killed |
| `gateShares` | empty counted | killed |
| `scan-lib` | `why` text changed | survived — message text, not behaviour |

The wiring in `sdlc-scan.mjs` (`isCommit` via `git rev-parse`, `mergedInWindow`, the report sections) has no unit test. I covered it by running the scan (below).

## Not checked
- The conversation-level rule itself (B1–B3): no script can see whether an agent recorded a gate on a real request. This is the spec's own Out of scope; the marker records what happened, nothing enforces it.
- `sdlc-scan.mjs` is untested code. I ran it on this branch, which has a clean `metadata.yml` set. I did not run it against a deliberately bad `merged:` or gate value, so the "Metadata problems" print path is exercised only through `scan-lib` unit tests.
- B9's attribution of who typed each existing gate (§26, §27, §30, §32): I did not re-derive it from commits. I read the markers and comments in the diff only. Commit `6de3853` (§30) is on another branch; not opened.
- `/intent` and `/review` skills were not run end to end. Their changes were read, not exercised.
- The Codex implementer (`.codex/agents/heraklios-implementer.toml`) change is one sentence; I have no Codex run to see it loaded.
- `npm run e2e` not run: the diff has no `src/scenes`, `src/ui`, `src/main.ts` or `e2e/` change.
- `docs/sdlc-grid.md` and `/grid` were not touched or re-run (spec Out of scope).

## Live check
not needed — no `src/scenes`, `src/ui`, `src/map-editor`, `src/main.ts`, HTML, `vite.config.ts` or `.claude/settings.json` change, and no Not-checked item is runtime behaviour only a live run can show.

## Verified myself vs. taken on trust
- `git rev-parse HEAD` → `85af078a8e7603e9748439c301264908f04d4a32`, worktree clean at start.
- `npm run verify` → green: 37 test files, 633 tests passed; `npm run lint` re-run separately: 0 errors, 21 warnings (cap 21, unchanged).
- `npm run check:intent` → PASS (above).
- `npm run sdlc:scan` → "Metadata problems: none"; gates (owner / agent): `intent_accepted` 1/5, `spec_accepted` 1/2, `plan_approved` 1/4, `live_checked` 1/1. This matches B9's table and spec AC4; §32 counted in "Quality per review tier" (reviewed: 4 changes, attested: 1).
- AC6 grep (`never record a gate|Who records it|every gate in|never write live_checked|never record`, outside `intents/3x` and plan-history) → only `REVIEW-POLICY.md:96` (new wording), `intents/README.md:97` (new wording), and the `/review` skill line 90 (new wording). The implementers' "Never record a gate: …" lines are in `.claude/agents` and `.codex/agents` (the grep covered `*.md` and `*.toml` at the repo root only through `.`; hidden directories matched).
- Diff of the six `metadata.yml` files by eye: only gate values gain `by-agent`, plus the §30 comment; no date changes (AC5).
- Mutation table above: 22 runs by me.
- Taken on trust: the Progress entry's description of subtask order (`parseGate` landing before B9 re-marking), read from commit subjects only.
