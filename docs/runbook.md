# Runbook: agent workflow and launch hazards

Moved here from sections 1 and 4 of the old root plan file when it was
retired (§47). The headings keep their numbers, so "§4" in a comment, an
agent file or a skill means the Runbook below. The queue these sections used
to point at is now generated: `npm run queue`. Links into `plan-history.md`
are unchanged.

## 1. Agent workflow

| Stage | What happens |
| --- | --- |
| **Implement** | One agent, with `isolation: 'worktree'` — its own checkout of the repo. The agent creates a branch, implements the rule, adds engine tests, and runs `npm run build` + `npm test` until green, then commits. |
| **Verify** | A second, independent agent re-reads the diff with fresh eyes, re-runs the checks, and reports whether the rule matches the rulebook text and whether the tests actually prove it. It does *not* trust the implementer's own summary. |

### Agents

Two project-scoped agent definitions live in `.claude/agents/` and carry
their own model, tools, and rules — invoke them by name rather than
re-specifying any of this per call:

- `heraklios-implementer` (Sonnet) — implement stage. Takes `isolation:
  'worktree'` at call time.
- `heraklios-reviewer` (Opus, adversarial) — verify stage.

```js
agent(implementBrief, { agent: 'heraklios-implementer', isolation: 'worktree', phase: 'Implement' })
agent(verifyBrief, { agent: 'heraklios-reviewer', phase: 'Verify' })
```

The model is fixed in each agent's frontmatter, so it no longer needs to be
passed (or risk being silently dropped) on every call — the prompt only
needs to carry the feature-specific brief (slug, files, design questions, and
the relevant plan section), not the process rules, which live in the agent
files themselves.

Codex equivalents live in `.codex/agents/`:

- `heraklios_implementer` — implements one scoped feature with tests.
- `heraklios_reviewer` — read-only adversarial reviewer.

### Why a worktree

`isolation: 'worktree'` gives the agent a separate working directory backed
by the same `.git`. Two consequences worth knowing:

- Branches and commits **survive worktree cleanup**, because refs live in the
  shared `.git` directory, not in the worktree. Committing is therefore what
  makes the agent's work durable — an uncommitted edit in a discarded
  worktree is gone. **Have the agent commit early and often** (an initial WIP
  commit as soon as anything compiles), not just once at the end — a network
  or tool failure mid-run should lose minutes of work, not all of it.
- The worktree needs its own `node_modules` resolution to run tests. See the
  runbook below for the junction-based fix.

### Rules the agent must follow

Baked into `.claude/agents/heraklios-implementer.md` and
`heraklios-reviewer.md` — branch naming, the engine/presentation split,
build/test-clean-before-commit, README updates, the "never touch main /
never edit the intent's plan.md beyond Progress" boundary, and the ambiguous-rulebook-comment convention
all live there now. The prompt only needs to supply the feature-specific
brief: slug, files, design questions, and any relevant rulebook references or the intent folder.

### Editing the repo while a run is in flight

- **Avoid editing `README.md` in the main tree during a run** — the agent
  touches it (rule 4), so a simultaneous edit there means a conflict at
  merge time. Source files being implemented are best left alone for the
  same reason.
- **Don't merge into `main`, switch its branch, or reinstall `node_modules`
  mid-run.** The agent branches from the commit `main` pointed at when it
  started, and may be resolving modules against the shared install.

### Launch checklist

Before launching a task:

1. Run `npm run queue` and read the target intent folder (`intents/<id>-<slug>/`).
2. Verify `main` is clean and current.
3. Check `git worktree list`, `git branch`, and any stale `feat/<slug>`
   branch/worktree.
4. Use a fresh `feat/<slug>` branch or worktree.
5. Install dependencies in that worktree if needed; do not junction
   `node_modules` into a worktree that will be deleted.
6. Verify with `npm run build` and `npm test`.
7. Run an adversarial review before merging.
8. After merge, set `status: done` and `merged:` in the intent's `metadata.yml`; the queue is generated, so there is no row to update.

---

## 4. Runbook: detailed launch hazards appendix

Everything needed to launch with no prior conversation context. **This
section is feature-agnostic** — it was first written during Feature A, but
every hazard below has since bitten on a later run.
Substitute the slug of whatever is being launched for `<slug>`; `npm run queue` says what that is.

### Preconditions

1. **Check connectivity first** — a prior run on this project died to a DNS
   failure mid-run:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://api.anthropic.com/
   ```
   A `404` is success (the endpoint resolved and answered). A timeout or
   `ENOTFOUND` means do not launch.
2. `main` clean and at the commit the agent should branch from.
3. No stale `feat/<slug>` worktree or branch left over from a previous
   attempt (`git worktree list`, `git branch`). **These accumulate** — as of
   2026-08-07 three orphaned `worktree-agent-*` branches and one detached
   review worktree (`C:/Users/eric/src/heraklios-review-push2`) were still
   lying around from finished runs. Prune them *after* the junction check
   below, never before.

### The `node_modules` problem

A fresh worktree has **no `node_modules`** (gitignored), so the toolchain
isn't resolvable there.

**Check the junction target actually exists first** — during the AI action
layer run the main tree's `node_modules` was *empty*, so the junction below
silently produced a worktree with no toolchain and the agent had to
`npm install` in its worktree anyway:

```bash
ls node_modules | wc -l    # must be non-zero before junctioning
```

**Default to `npm install` in the worktree (~11s).** It is the safe option
and the cost is trivial. Only junction for a long-lived worktree you are
certain you will not delete:

```bash
powershell -Command "New-Item -ItemType Junction -Path node_modules -Target 'C:/Users/eric/src/heraklios/node_modules'"
```

#### ☠️ Never junction into a worktree you intend to delete

**This has already destroyed the main tree's install once.** A Windows
directory junction is a *link*, but a recursive delete — `rm -rf`,
`Remove-Item -Recurse`, `git worktree remove --force` — **follows it and
wipes the target's contents**, i.e. the main tree's `node_modules`, breaking
every other worktree at once. It fails silently: nothing reports an error,
and the damage only surfaces at the next `tsc` run, which then fails with
`./node_modules/.bin/tsc: No such file or directory` (or worse, falls back
to `npx`'s impostor `tsc` and reports a false green — see below).

It happened here when a reviewer was told to junction and then remove its
worktree when finished. Both instructions were reasonable; together they are
destructive. **It then happened a second time, minutes after this warning was
first written**, during routine post-merge cleanup:

```bash
git worktree remove .claude/worktrees/agent-<id> --force   # ☠️ wiped it again
```

That is the real trigger in practice — not a hand-written `rm -rf`, but the
ordinary cleanup command at the end of every successful run. **Agent
worktrees are created by the harness and may contain a junction you did not
make**, so the check below is mandatory before removing *any* worktree, not
just ones you junctioned yourself:

```bash
cmd //c "dir /AL .claude\worktrees\agent-<id>"   # lists junctions, if any
```

**This is not hypothetical right now.** As of 2026-08-07 the live worktree
`.claude/worktrees/agent-a0f2d0a8c70c82076` (the `feat/cascading-push`
implementer's) **contains exactly such a junction**:

```
<JUNCTION>  node_modules [\??\C:\Users\eric\src\heraklios\node_modules]
```

Removing that worktree with `--force` and no `rmdir` first would destroy the
main tree's install for the third time.

If a junctioned worktree must be removed, delete the **link** first:

```bash
cmd //c rmdir node_modules      # removes the link only, never the target
```

then remove the worktree, and verify the main install survived:

```bash
ls C:/Users/eric/src/heraklios/node_modules | wc -l   # must be non-zero
```

### ⚠️ `npx tsc` can report a false green

**Never verify a type-check with bare `npx tsc --noEmit`.** With no local
install, `npx` silently downloads an unrelated package named `tsc` from the
registry, which exits 0 without type-checking anything. This produced a
bogus "clean" result on `main` during the Feature A merge, and the reviewer
hit the same trap from the main tree during the AI action layer review.

Always invoke the project's own binary, and confirm the exit code:

```bash
./node_modules/.bin/tsc --noEmit; echo "exit: $?"
./node_modules/.bin/vitest run
```

`vitest` does not have this failure mode (it produced genuine results even
via `npx`), but prefer the local binary for both.

### ⚠️ Verifying a UI change by hand: pin the port

This project routinely has **four checkouts** live (`heraklios`,
`heraklios-stable`, `heraklios-codex`, plus any agent worktree under
`.claude/worktrees/`), and a `npm run dev` in each grabs the next free Vite
port. During [§13](plan-history.md#13-hex-coordinate-tooltip) three servers were running
with **two bound to 5173**, so `http://localhost:5173` non-deterministically
served a tree that did not contain the feature under test — two rounds of
manual verification reported "no tooltip" against code that never had one.
`localhost` resolves to IPv4 or IPv6 depending on the client, and two
processes can each hold one of them on the same port.

So: start the server on an explicit port, and **prove the code is served
before asking anyone to look**.

```bash
npm run dev -- --port 5199 --strictPort --host 127.0.0.1
curl -s http://127.0.0.1:5199/src/ui/MapView.ts | grep -c showHexTooltip   # must be non-zero
```

`--strictPort` makes a collision fail loudly instead of silently sliding to
the next port, and quoting `127.0.0.1` rather than `localhost` removes the
IPv4/IPv6 ambiguity. To see what is actually running:

```bash
powershell -Command "Get-NetTCPConnection -State Listen -LocalPort 4173,5173,5174 | Select-Object LocalPort,OwningProcess"
```

### Reviewer must check out DETACHED

Git refuses to check out a branch that's already checked out in another
worktree, which a plain `git checkout feat/<slug>` would hit while the
implementer's worktree still exists:

```bash
git checkout --detach feat/<slug>
```

### The workflow script

The shape validated across every run so far: a single `agent()` call using
the `heraklios-implementer` agent (`isolation: 'worktree'`), piped into a
second `agent()` call using `heraklios-reviewer`, each with a structured
output schema (see [§1](#1-agent-workflow)). The feature brief
(slug / files / design question — from whichever section
`npm run queue` points at) is the only per-run content the prompts
need to carry; process rules live in the agent files.
