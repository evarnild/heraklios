<!-- generated-by: heraklios/intent@0.1.5 -->
# §85 — A Unity shell hosts the engine through its supported entry, with a parity gate

**Type:** feature
**Originator:** the owner (2026-11-22): "draft the next intent for our unity
plan".
**Source:**
- `intents/70-unity-front-end-probe/result.md` → "Recommendation: go, with
  conditions" and "Proposed next intent", step 2.
- §72 (`intents/72-engine-host-seams/`), which delivered step 1.

## Problem

§70's probe showed that a Unity front end can host the unchanged TypeScript
engine. Replays were bit-identical in five host/runtime combinations, and
ClearScript V8 took 1 to 18 ms per call. The recommendation was "go, with
conditions", in three steps:

1. **Engine seams.** Done by §72:
   - `src/engine/host.ts`: `newGame`/`load` with a required seed, and `Host`
     with `legalActions`, `apply`, `question`, `state` and `save`;
   - `deployment.ts`'s `deployUnit` and `autoDeploy`;
   - the JSON question/answer session for combat resolution.
2. **A Unity shell.** Not started.
3. **A playable flat board, then 3D.** Not started.

Two problems remain:

- **Nothing in the repo runs the engine outside the browser.**
  - The probe lives only on the unmerged branch `exp/70-unity-front-end-probe`
    (`unity-probe/`).
  - Its bridge, `engine-entry.ts`, reached into engine modules directly,
    before `host.ts` existed.
  - Its DLLs and bundle are gitignored and fetched by a setup script.
- **Nothing would tell us if a Unity host stopped matching the browser.**
  §70's parity check was a one-off.

Without a maintained shell, step 3 has nothing to build on. Each engine change
could silently break a non-browser host, and no one would notice.

## Outcome

- **A Unity project on `main`.** It lives in a top-level folder (name decided
  by the spec), on the same Unity version the probe used (6000.6.10f1). It
  opens in Unity Hub and enters Play mode with no errors.
- **The engine bundle is built from the same commit.**
  - An `npm` script bundles `src/engine/host.ts` (the supported entry, not a
    probe file) into one JS file for the shell.
  - The shell refuses to run a bundle stamped with a different commit or
    version.
- **The engine runs on its own thread.**
  - ClearScript V8 runs in-process, in one dedicated worker thread with a
    message queue (§70 condition 2).
  - The main thread never calls the engine directly, and `legalActions` is
    never called per frame.
- **JSON uses Newtonsoft (or `System.Text.Json`), not `JsonUtility`** (§70
  finding 8).
  - C# DTOs cover the host's types: `GameState`, `Action`, `SessionAction`,
    `Question` and `HostStep`.
  - Actions are passed back by index or opaque token, never re-serialised from
    C#.
- **A parity gate.**
  - One command, runnable by the owner or a script, replays
    `playRandomGame(seed)` for a fixed set of seeds through the Unity-hosted
    engine.
  - It compares a SHA-256 of `{ stats, trace, state }` against the Node
    reference.
  - It fails loudly on any mismatch.
- **A minimal scene proves the protocol end to end.** No real UI. It:
  - starts a seeded `newGame` with two default armies (`autoDeploy`);
  - shows the board flat, as the probe did;
  - plays one move and one land attack;
  - answers at least one combat question (a retreat), through the host's
    question/answer protocol.

  This is the part §70 could not exercise.
- **The web game is unchanged.** `npm run verify` and `npm run e2e` are
  unaffected, and vite, vitest, eslint and tsc ignore the Unity folder.

## Constraints

- **No rule change.** The shell only calls `host.ts`. Any engine change is a
  separate, tested `src/` change. If the shell needs a missing seam, the spec
  names it and it is added with tests first.
- **The engine stays the single source of rules.** No rule logic is written
  in C#.
- **Repo hygiene.**
  - Unity's `Library/`, `Temp/`, `Logs/`, `Build/`, native DLLs and the
    generated bundle are gitignored.
  - A setup script fetches ClearScript V8 and Newtonsoft through NuGet or the
    package manager, as the probe's `setup.cmd` did.
  - The folder lives outside every tool's globs. The Unity folder sits inside
    the repo, unlike spawned worktrees, which live outside on purpose
    (CLAUDE.md "Parallel sessions"), so the spec must check that vite, vitest,
    eslint and tsc globs exclude it.
- **Licences.** ClearScript is MIT, V8 BSD-3 and Newtonsoft MIT. A
  `THIRD-PARTY` note records them.
- **Scope: Windows desktop only** (§70 condition 3). macOS and Linux are
  later. Mobile and WebGL are out.
- **The parity gate is not part of `npm run verify`.** Unity isn't present on
  every machine, and verify must stay fast. It is a separate command,
  documented in `docs/runbook.md`.
- **Machine load.** Unity and the V8 host are heavy. The implementer and the
  reviewer run Unity one at a time, never in parallel with an e2e run.
- **Live check owed.** The owner opens the project in Unity, presses Play,
  runs the parity gate, and watches the scene play its scripted move, attack
  and retreat.

## Type-specific questions

### Feature
- **Users:**
  - the owner, as the developer of the future Unity front end;
  - later, Windows desktop players (step 3).
- **Rulebook basis:** digital-only. A host for the existing rules.
- **Known simplification it removes:** none.
- **Open design questions (for the spec):**
  1. **Folder.** `unity/` at the top level, or `frontends/unity/`? Reuse the
     probe's project and settings, or start clean? The draft assumes a clean
     project in `unity/`, copying only what the probe proved (the V8 host
     code and the build script).
  2. **How the parity gate runs.**
     - Unity batch mode (`-batchmode -executeMethod`), which is slow to start
       but tests the real player;
     - a plain .NET console host using the same C# host code, which is fast
       and needs no Unity;
     - or both.
     - The draft assumes both: .NET for the routine check, and Unity batch
       mode before a release.
  3. **DTOs.** Hand-written C# classes, or generated from the TypeScript
     types (for example a small script over `host.ts`)? Generated DTOs can't
     drift, but they add a tool. The draft assumes a small generator script in
     `scripts/`.
  4. **Bundle stamp.** Embed the git commit and engine version in the bundle,
     and check them in C#. Or check only a content hash?
  5. **Scripted scene or clickable?** Is the scene scripted (the probe's
     offscreen evidence), or clickable for the owner's live check? The draft
     assumes both: a "Run demo" button plus click-to-move as in the probe.

## Assumptions I made

- **Type: feature.** It adds a new runtime (a second front end), not a
  restructuring of existing code.
- **Tier: `review_tier: reviewed`.** The path table has no row for a Unity
  tree, and Attested relies on tests that `verify` runs, which C# code
  outside the npm toolchain doesn't have. The owner reads the diff.
- **Id: 85,** from `npm run queue -- --next-id`.
- **No blocker.**
  - §72, which provides `host.ts`, is merged.
  - §73 (BoardScene on the session) is not needed: the shell talks to
    `host.ts`, not to the scene.
- **§70's branch stays as the archived probe.** This intent copies what it
  needs and does not merge that branch.
- **The Unity editor and .NET SDK are installed** on the owner's machine (the
  owner, earlier: "unity and .net sdk are now installed").
