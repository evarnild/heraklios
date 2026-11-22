<!-- generated-by: heraklios/spec@0.1.0 -->
# §85 spec — A Unity shell hosts the engine through its supported entry, with a parity gate

Accepted intent: [intent.md](intent.md)

Written against `main` at `7a9b113`. Probe files are cited from the unmerged
branch as `exp/70:<path>:<line>` (short for
`exp/70-unity-front-end-probe:unity-probe/<path>`); that branch was read with
`git show`, never checked out.

The spec decides **what** gets built. It does not repeat §70's result; it
points at it and records the decisions that have no other home.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `intents/70-unity-front-end-probe/result.md` → "Recommendation: go, with conditions" | ClearScript V8 in-process; "Never call `legalActions` per frame and run engine calls off the main thread (V8 contexts are single-threaded, so give the engine one worker thread and a message queue)" (condition 2); Windows desktop scope (condition 3); "keep the engine bundle version-locked to the front end (the bundle is built from the same commit, parity-checked against `playRandomGame` in CI by the same SHA-256 method used here)" (condition 4); Unity is a second front end beside Phaser (condition 5). |
| same file → "Findings" 6 and 8 | The front end must pass its own seeded rng; "Unity's `JsonUtility` cannot read a root array or a union of shapes … A real front end should add Newtonsoft (a Unity package) or `System.Text.Json`, and keep an index or opaque-token path for actions" (re-serialising wrote `facing: 0` into every `navalMove`). |
| same file → "Parity check" | The method: `playRandomGame(seed, { turnCap: 7, trace, buildInitialState })`, seeds 7, 42, 2026; the final `GameState` captured through `buildInitialState`; JSON hashed with SHA-256; reference from the **unbundled** `src/` under vitest. |
| `plan-history.md` §70.1 (`plan-history.md:4163-4185`) | Live-checked probe; branch kept for reference, never merged. |
| `intents/72-engine-host-seams/spec.md` B13-B16 | `src/engine/host.ts` is "the supported entry. Its inputs and outputs are JSON-serialisable values only"; its rng is required and seeded; "Unity, a bundle step, a CI parity gate (§70 steps 2-3)" were out of §72's scope. |
| `docs/architecture.md` principles 4, 6, 9, 14, 17 | Tooling never imported by the game; one source of truth; seeded randomness; a new dependency "is pinned and goes in the plan"; a new boundary is written down in that file. |
| `README.md` "Known simplifications" | None removed (digital-only host). |
| `docs/research/` | No rule passage is involved. |

### What the code holds today (checked at `7a9b113`)

- **The supported entry.** `Host` offers `legalActions()`, `apply(action)`,
  `question()`, `state()`, `save()` (`src/engine/host.ts:80-91`). Every output
  is a deep copy through JSON (`host.ts:102`, `:110-138`). `newGame(config,
  seed)` deploys each seat by `autoDeploy` unless placements are given
  (`host.ts:148-159`, `:168-200`); `load(savedJson, seed)` at `:207`.
  `apply` returns a `HostStep` `{ result, events, question }` (`:72-78`).
- **Questions.** `Question` is a union of `retreat`, `pushTarget`, `advance`,
  `exchangeSacrifice`, each naming the answering `player`
  (`src/engine/combatResolution.ts:41-48`); answers are their own union
  (`:51-55`). A step with one option is applied without asking (`:31-34`).
  With a question open, `sessionLegalActions` lists exactly its answers
  (`src/engine/gameSession.ts:81-85`) and a turn action is refused
  (`gameSession.ts:162`).
- **Order of `legalActions`.** `endPhase` is always first when no question is
  open (`src/engine/actions.ts:442-443`). With a question open, index 0 is an
  answer. The probe's "End phase" button applied index 0 blindly
  (`exp/70:UnityProbe/Assets/Scripts/ProbeBoard.cs:190`); the shell must not.
- **Default army and edges.** `defaultArmySelection()` is in
  `src/engine/army.ts:67-80`, not on the host. The web game gives two players
  edges W and E (`src/ui/session.ts:82`, `:128`).
- **The harness.** `playRandomGame(seed, options)` is async
  (`src/engine/fuzzHarness.ts:1083`), takes `turnCap`, `trace`,
  `buildInitialState` (`:847`, `:869`, `:878`) and returns `HarnessStats`
  (`:779-838`). It mutates the state it was given in place, so the object
  `buildInitialState` returned is the final state. It is not reachable from
  `host.ts`.
- **The board data** are a `Map` and a `Set` (`src/data/map.ts:21`, `:1315`),
  not JSON, and `host.ts` exports neither.

### What the probe proved, and what it did not

- **Proved:** V8 in the Unity 6000.6.10f1 player and editor
  (`exp/70:UnityProbe/ProjectSettings/ProjectVersion.txt:1-2`); the five
  managed/native DLLs it needs, copied by `exp/70:setup.cmd:13-15`; flat hex
  drawing and pixel-to-hex maths (`ProbeBoard.cs:27`, `:94-104`, `:166-176`);
  batch scene creation and Windows build (`exp/70:UnityProbe/Assets/Editor/ProbeBuild.cs:13-53`),
  including the always-included `Sprites/Default` shader (`:22-28`); the old
  Input Manager (`exp/70:UnityProbe/ProjectSettings/ProjectSettings.asset:685`,
  `activeInputHandler: 0`) and
  IMGUI.
- **Not carried over:**
  - its bridge reached into engine modules directly
    (`exp/70:engine-entry.ts:6-12`) and passed an empty `ActionContext`
    (`:17`);
  - `JsonUtility` superset DTOs (`EngineHost.cs:8-27`, `:64-67`);
  - Jint (`EngineHost.cs:3`, `:38`) and the Node sidecar;
  - every engine call on Unity's main thread (the host is built in
    `ProbeBoard.Start`, `:32`, and called from `Update`/`OnGUI`, `:144`,
    `:190`);
  - floating NuGet versions `4.*`/`7.*` (`exp/70:PluginPack/PluginPack.csproj:9-11`);
  - a hard-coded editor path (`exp/70:run-unity.cmd:5`);
  - esbuild from a probe-only `package.json` (`exp/70:package.json:6`,
    `exp/70:bundle.mjs:3-6`). The root project has no esbuild; Vite 8's
    bundler (rolldown) is installed (`node_modules/.bin/rolldown`), and it
    bundled `host.ts` plus the harness and map in about 110 ms in a scratch
    trial.

## Behaviour

### The folder and its setup

- **B1. One top-level `unity/` folder** holds everything that is not
  TypeScript tooling:
  - `unity/Heraklios/`: a Unity 6000.6.10f1 project created clean. It is not
    a copy of the probe's project or settings. It uses the old Input Manager
    and IMGUI, as the probe did.
  - `unity/Heraklios/Assets/Heraklios/Host/`: the C# engine host. Its
    assembly definition has no `UnityEngine` reference, so the same source
    compiles into Unity and into the console host (B9).
  - `unity/Parity/`: a .NET console project that compiles that same host
    source by file reference, not by copy.
  - `unity/Restore/`: a restore-only .NET project, the probe's
    `PluginPack` without Jint.
  - `unity/THIRD-PARTY.md` (B21) and `unity/tool-trap/` (B19).
- **B2. `npm run unity:setup`** (a script under `scripts/`) fetches the
  pinned packages through NuGet and copies the five DLLs into
  `unity/Heraklios/Assets/Plugins/`:
  - `ClearScript.Core.dll`, `ClearScript.V8.dll`,
    `ClearScript.V8.ICUData.dll` and `Newtonsoft.Json.dll`;
  - the native `ClearScriptV8.win-x64.dll`.

  The pinned packages are:
  - `Microsoft.ClearScript.V8` **7.5.1.1**, which brings
    `Microsoft.ClearScript.Core` 7.5.1.1, `Microsoft.ClearScript.V8.ICUData`
    7.5.1.1 and `Newtonsoft.Json` 13.0.3;
  - `Microsoft.ClearScript.V8.Native.win-x64` **7.5.1.1**;
  - `Newtonsoft.Json` **13.0.3**, referenced directly so the shell's own JSON
    code pins it.

  Setup then runs the bundle step (B5). It is idempotent. It names what is
  missing, with the install hint, when `dotnet` or the Unity editor cannot be
  found. Both are looked up on `PATH`, then at their default Windows
  locations. On this machine `dotnet` is not on `PATH`; it lives at
  `C:\Program Files\dotnet\dotnet.exe` (SDK 11.0.100).
- **B3. Newtonsoft comes from the same NuGet DLL ClearScript depends on.** It
  is not added as the Unity package `com.unity.nuget.newtonsoft-json`, because
  two copies of the assembly would conflict. No C# file in `unity/` uses
  `JsonUtility`.
- **B4. Gitignored**, so `git status` stays clean after setup, a bundle, a
  parity run, a Play session and a player build:
  - Unity's `Library/`, `Temp/`, `Logs/`, `UserSettings/`, `Build/`, `obj/`,
    `bin/` and `.vs/`;
  - the `*.csproj`/`*.sln` files Unity writes in the project root (the
    committed `unity/Parity/*.csproj` and `unity/Restore/*.csproj` stay
    tracked);
  - `Assets/Plugins/*.dll`;
  - the generated bundle, stamp, demo script and parity reference in
    `StreamingAssets/`;
  - `unity/out/` for logs.

  The plugin `.meta` files are **committed**, as the probe did. They carry
  the native DLL's x86_64/Windows import settings.

### The bundle and its stamp

- **B5. `npm run unity:bundle`** bundles the supported entry (B10) into one
  IIFE JavaScript file, ES2020 target, using Vite's build API (an existing
  devDependency, so no new dependency). The output goes to
  `unity/Heraklios/Assets/StreamingAssets/engine/`, together with
  `engine.stamp.json` and `demo.json` (B16).
- **B6. The stamp.** The bundle defines a global stamp, and the same object is
  written to `engine.stamp.json`:
  - `engineCommit`: the last commit that touched any input file of the
    bundle;
  - `dirty`: whether any of those files had uncommitted changes;
  - `sourceHash`: SHA-256 over the bundle's input files, as the bundler
    reports them;
  - `protocolHash`: the hash of the DTO type model (B8).
- **B7. The shell refuses a bundle that does not match it**, with a message
  that names the command to run.
  - **Everywhere** (editor, player, console host): the bundle's
    `protocolHash` must equal the constant in the generated C# DTOs.
    Otherwise the bundle and the DTOs disagree.
  - **Entering Play in the editor, and before a player build:** an editor
    hook runs `node scripts/unity-bundle.mjs --check`. It recomputes
    `engineCommit`, `dirty` and `sourceHash` from the working tree. Play
    stops, or the build fails, when they differ from the stamp, meaning the
    bundle is stale.
  - **The parity commands (B13, B14)** always rebundle first, so they never
    run a stale bundle.

  The stamp algorithm lives once, in Node, and is unit-tested (AC4). C# only
  compares values.

### The DTOs

- **B8. C# DTOs are generated** by `npm run unity:dtos` (a script under
  `scripts/`). It uses the TypeScript compiler API (`typescript` is already a
  devDependency) over the types the facade exposes:
  - `HostStep`, `GameState` (and `Unit`, `Player`, `HexCoord`);
  - `SessionAction` (that is, `Action` and `AnswerAction`) and `Question`;
  - `SessionEvent`, `ActionResult` and `HostConfig`;
  - the board and stamp shapes of B10.

  How it maps the TypeScript:
  - Each union becomes a base class with one subclass per `kind`, read
    through a Newtonsoft converter keyed on `kind`.
  - A literal-number union becomes `int`, and a string-literal union becomes
    `string`.
  - An unsupported construct fails the generator loudly, naming the type. It
    never silently becomes `object`.

  The output, `unity/Heraklios/Assets/Heraklios/Host/Generated/HostDtos.g.cs`,
  is committed, with its `protocolHash` as a constant. A vitest test
  regenerates it in memory and fails when the committed file differs, so a
  host-type change that is not regenerated fails `npm run verify` (AC5).
- **B9. Actions are only ever handed back by listing and index.** C# reads
  actions and answers to draw them, and never serialises one. Each listing
  from the facade carries a `listingId`. `applyLegal(listingId, index)`
  refuses an index into any listing but the latest. That is a stale click,
  and it is reported as an error result that changes nothing.

### The engine seams (TypeScript, `src/engine/`, with tests, before any C#)

- **B10. `src/engine/hostJson.ts`: a string facade over `host.ts`.** It holds
  no rule. Every argument and result is a JSON string, so C# never builds
  script source from data. It offers:
  - `newGame(configJson, seed)` and `load(savedJson, seed)`;
  - `legal()`, returning `{ listingId, actions }`, and
    `applyLegal(listingId, index)`, returning the `HostStep` as JSON;
  - `question()`, `state()` and `save()`;
  - `board()`: `MAP_TERRAIN` and `RIVER_HEXSIDES` flattened into arrays of
    plain objects;
  - `defaultConfig()`: two seats, edges W and E as in `session.ts:128`, each
    with `defaultArmySelection()`;
  - `stamp()`.

  A thrown error, `HostDeployError` included, comes back as
  `{ ok: false, error: { message, kind? } }`, never as an exception across
  the boundary. One facade holds one game at a time; `newGame`/`load`
  replace it.
- **B11. `src/engine/parity.ts`: `parityPayload(seed, turnCap)`.** It
  resolves to the exact string
  `JSON.stringify({ stats, trace, state })`, where `state` is the object
  `buildInitialState` returned (`buildFuzzGameState()` by default). Its
  callers are:
  - the Node reference (B13), which runs the unbundled source;
  - the facade, as `parity(seed, turnCap)`, which runs the bundle.

  The hashed string is therefore produced by one function on both sides.

### The worker thread

- **B12. One engine thread per game, and a message queue.**
  - **The worker thread owns all of V8.** A dedicated background thread
    creates the `V8ScriptEngine`, loads the bundle and checks its stamp. It
    is the only thread that ever calls into V8.
  - **The main thread posts requests** to a queue. A request is a method
    name and string arguments. Results, errors included, come back through
    a second queue, which the main thread drains once per frame in
    `Update`. JSON parsing into DTOs happens on the worker. A promise
    (`parity`) is awaited on the worker.
  - **While a request is pending:**
    - the board keeps showing the last state;
    - the panel shows "Engine working…" with the request's name and elapsed
      milliseconds;
    - board clicks and buttons that would post another request are ignored,
      not queued. A click during a pending call does nothing.
  - **`legalActions` is called once per state change**: after `newGame`,
    `load` and each `applyLegal`. The result is cached for selection and
    highlighting. `Update`, `LateUpdate` and `OnGUI` never post a request
    of their own.
  - **An engine error** shows in the panel. The demo stops, and the game
    stays as the engine left it (B9's refusals change nothing). "New game"
    recovers.
  - **Leaving Play or quitting** stops the worker and disposes the engine.
  - **Diagnostics.** The host counts every engine call, the managed thread
    that ran it, and the `legal` calls. Batch runs print these counts
    (AC8).

### The parity gate

- **B13. `npm run unity:parity`, the routine check.** No Unity is needed. It
  runs these steps in sequence, never in parallel:
  1. rebundle (B5);
  2. compute the Node reference from the **unbundled** `src/` through
     `parityPayload`, under vitest as §70 did (`exp/70:parity-reference.probe.ts:9-21`),
     into a gitignored JSON file;
  3. build and run `unity/Parity`, which loads the bundle through the same
     C# host and worker as Unity, replays each case, hashes the UTF-8 bytes
     of the payload with SHA-256, and compares.

  **The cases:**
  - seeds 7, 42 and 2026 at `turnCap` 7 (§70's set);
  - plus the demo (B16): the SHA-256 of `state()` after the scripted demo,
    so the `newGame`/`autoDeploy`/question path is covered too.

  **Output:** one line per case, `parity <case>: MATCH|MISMATCH <first 16 hex>
  <ms>`, then a final `PARITY OK` or `PARITY FAILED`. Exit 0 only when every
  case matches. A mismatch prints both hashes and the first differing trace
  index. A missing tool or bundle is a non-zero exit with a message, never a
  silent pass. The reference is recomputed on every run and never
  committed, so an engine change does not need a hash edit.
- **B14. `npm run unity:parity -- --unity`, before a release.** It builds the
  Windows player in batch mode, then runs
  `Heraklios.exe -batchmode -nographics -parity <reference> -demo`. The
  player runs the same cases inside Unity's Mono runtime and the scripted
  demo (B16), logs the same lines as B13 plus the thread and `legal` counts
  of B12, and quits with 0 only if all of them pass. The npm script relays
  the player log's verdict and exit code. "Before a release" means:
  - once in this intent, by the reviewer;
  - by any later intent that changes `unity/` or the bundle pipeline;
  - before any distributed build.
- **B15. Neither gate is part of `npm run verify`.** Both are documented in
  `docs/runbook.md` (B20). Unity runs, whether a build, a batch player or the
  editor, never overlap with each other or with an `npm run e2e` run. The
  npm scripts run their own steps one at a time.

### The scene

- **B16. The scripted demo is generated, deterministic and replayed by
  index.** The bundle step runs a demo finder under `scripts/` against the
  fresh engine. It writes `demo.json`: the seed, the config
  (`defaultConfig()`), and the list of `{ index, expect }` steps, where
  `expect` is the action's compact description.

  **The finder's policy:**
  - seat 0 moves its light cavalry, one step at a time, along the legal move
    that most shortens the distance to the nearest enemy;
  - seat 0 attacks with the first offered `landAttack` in its combat phase;
  - every other turn is `endPhase`;
  - every open question takes the first offered answer;
  - the run stops right after a `retreat` question has been answered.

  **The seed:** it tries seeds from 1 upward and keeps the first that
  answers a retreat within 200 actions. Any hex geometry comes from the
  engine, not a copy.

  **Replay in Unity:** each step is applied through `applyLegal` with its
  recorded index, after checking that the listed action at that index has
  the recorded description. A mismatch stops the demo with "demo is out of
  date: run `npm run unity:bundle`".

  Measured on `7a9b113` with that policy (scratch trial): with W/E edges no
  first-phase move reaches contact. The armies start 14-16 hexes apart, for
  seeds 1-5. Seed 4 answers a `retreat` (attacker-retreat result, two
  options) after 61 actions (33 moves, 25 `endPhase`, 2 attacks) in turn 7.
  Seeds 1, 3, 6, 7, 10, 11 and 13 answer push or advance questions before
  their first retreat, which the demo also answers.
- **B17. The scene, `Assets/Scenes/Shell.unity`**, has a camera and one
  board object.
  - **What it shows:**
    - the board drawn flat from `board()`, terrain-coloured as in the probe;
    - units as small hexes in their owner's colour;
    - the state panel: turn, phase, active seat, the open question if any,
      the last step's result and events, and the engine timing of the last
      call.
  - **Buttons:** "Run demo", "New game", "End phase" (finds `endPhase` by
    kind) and "Run parity".
  - **"Run demo"** plays B16 at a visible pace: about 4 steps a second, with
    a "Fast" toggle. The panel names each step. When the retreat question
    opens, it is shown, with its options highlighted, for 2 seconds before
    the recorded answer is applied.
  - **Click-to-move:**
    - clicking a unit of the active seat highlights the destinations that
      the cached listing offers for it; clicking one applies it by index;
    - while a question is open, its answers are listed as buttons, and a
      retreat's option hexes are also clickable.
  - **Batch:** `-demo` in batch mode runs the demo headless and logs each
    step (B14).
- **B18. No rule in C#.** C# draws, hit-tests, routes clicks and compares
  hashes and stamps. The demo's choices come from `demo.json`, not from C#
  logic. The hex maths (centre, pixel-to-hex) is presentation, as in
  `src/ui/hexRender.ts`.

### The web game and the toolchain

- **B19. Every TypeScript tool ignores `unity/`, provably.**
  - **The configs:**
    - `eslint.config.js` adds `'unity/'` to its ignores (today
      `eslint.config.js:57-66`);
    - `vite.config.ts` adds `server.watch.ignored: ['**/unity/**']` and sets
      `optimizeDeps.entries` to the two HTML entries. By default Vite's dev
      watcher watches the root (ignoring only `.git`, `node_modules`,
      `test-results` and its cache), and its dependency scan crawls every
      `**/*.html`;
    - `vitest.config.ts` adds the same watch ignore, for `test:watch`.
  - **Already outside:** `tsconfig.json` (`include` is an explicit list,
    `tsconfig.json:16`) and vitest's `include` (`vitest.config.ts:11`)
    already leave `unity/` out, and stay that way.
  - **The trap:** `unity/tool-trap/` holds:
    - `trap.ts`, with a type error and a lint error;
    - `trap.test.ts`, a test that always fails;
    - `trap.html`, importing a module that does not exist.

    If any tool picks the folder up, `npm run verify` (or the dev server)
    fails at once. The trap sits outside `unity/Heraklios/Assets`, so Unity
    never imports it.
- **B20. Documentation.**
  - `docs/runbook.md` gets a section: setup, bundle, DTOs, both parity
    commands, opening the project, the machine-load rule, and where `dotnet`
    and Unity are looked up.
  - `CLAUDE.md`'s command list and module map get the `unity:*` scripts and
    the `unity/` folder.
  - `docs/architecture.md` records the new boundary: `unity/` is a second
    front end. It calls only `src/engine/hostJson.ts`, through the bundle,
    and holds no rule (principle 17).
- **B21. Licences.** `unity/THIRD-PARTY.md` lists ClearScript (MIT), V8
  (BSD-3-Clause), Newtonsoft.Json (MIT), and the components that ClearScript's
  native package's own `License.txt` names, as that file lists them. That
  file is 1,627 lines and also covers ICU (Unicode licence), the GNU C Library
  (LGPL-2.1), zlib, FDLIBM, Strongtalk, JsonCpp, ProtoBuf and others. The
  note points at the full text, which `unity:setup` copies beside the DLLs.
  It is not reproduced by hand.

## Interpretations

No rulebook passage is involved. Each reading below becomes a comment at its
site.

- **I1. "The same commit" means the same engine sources, not the same HEAD.**
  The stamp's `engineCommit` is the last commit touching the bundle's inputs,
  plus `dirty` and `sourceHash`. A docs-only commit does not make the bundle
  stale; a changed engine file does, committed or not.
- **I2. "Engine version" is `protocolHash`**, the hash of the type model the
  C# DTOs were generated from. `package.json`'s `"version": "0.1.0"` is never
  bumped, and `SAVE_VERSION` covers saves, not the host protocol.
- **I3. "Parity" compares Node and V8 at the same moment, from the same
  sources.** It does not compare against hashes pinned in the repo. §70's
  hashes (`exp/70:parity-reference.json`) are history, since §72 changed the
  harness's path. The payload drops §70's redundant `traceLength`
  (`exp/70:parity-reference.probe.ts:19`), as the intent's wording
  `{ stats, trace, state }` says.
- **I4. "One move and one land attack" (intent Outcome) is a minimum, not a
  script length.** With the game's own two-player edges no single move
  reaches contact (B16's measurement), so the demo is the shortest scripted
  run that reaches and answers a retreat.

## Acceptance criteria

- **AC1 (B10, B9).** The facade returns only strings. `applyLegal` with a
  stale `listingId` or an out-of-range index returns an error and leaves
  `state()` unchanged. A game played to its end through the facade equals the
  same game through `host.ts`. A `HostDeployError` comes back as data.
  `board()` round-trips every hex and river of `src/data/map.ts`.
  *Proof:* `src/engine/hostJson.test.ts` (vitest, in `npm run verify`).
- **AC2 (B11).** `parityPayload(7, 7)` equals the string built from a direct
  `playRandomGame` call with a trace and a captured state, and two calls give
  the same string. *Proof:* `src/engine/parity.test.ts`.
- **AC3 (B16).** The demo finder, run on the unbundled source, finds a seed of
  50 or less whose run answers a `retreat` within 200 actions, and replaying
  its steps by index reproduces every recorded description. *Proof:* a vitest
  test under `scripts/`.
- **AC4 (B6, B7).** The stamp is unit-tested on fixture inputs:
  - the same inputs give the same stamp;
  - `--check` reports stale when an input file's content changes, when
    `dirty` flips, or when the input commit differs;
  - it reports fresh after a docs-only change;
  - the stamp global in the bundle text equals `engine.stamp.json`.

  *Proof:* `scripts/unity-bundle.test.mjs`, the npm bundle-stamp unit test.
- **AC5 (B8).** Regenerating the DTOs in memory equals the committed
  `HostDtos.g.cs`, and an unsupported type construct makes the generator
  throw. *Proof:* a vitest test under `scripts/`.
- **AC6 (B19).** All of the following must hold:
  - `eslint.isPathIgnored('unity/x.ts')` is true;
  - vitest's `include` globs match no path under `unity/`;
  - the parsed `tsconfig.json` file list holds no path under `unity/`;
  - `vite.config.ts` and `vitest.config.ts` both carry the `unity/` watch
    ignore, and Vite's `optimizeDeps.entries` is the explicit list;
  - `npm run verify` passes with the trap files present.

  *Proof:* the config-exclusion check (`scripts/unity-exclusion.test.mjs`,
  following `scripts/architecture-rules.test.mjs:1-14`'s ESLint Node API
  pattern), plus the green `verify` run in the review.
- **AC7 (B13).** `npm run unity:parity` prints `MATCH` for seeds 7, 42, 2026
  and the demo, then `PARITY OK`, and exits 0. A deliberately edited
  reference makes it print `MISMATCH`, then `PARITY FAILED`, and exit
  non-zero. *Proof:* .NET parity run output, pasted into `review.md`.
- **AC8 (B14, B12, B16).** `npm run unity:parity -- --unity` builds the
  player and logs:
  - the four `MATCH` lines;
  - the demo's steps, ending with the answered retreat;
  - "all N engine calls on the worker thread (main thread made 0)";
  - "legal calls = state changes + 1";
  - an exit code of 0.

  *Proof:* Unity batch run output, pasted into `review.md`.
- **AC9 (B7).** With the bundle rebuilt from an edited engine file and the
  DTOs not regenerated, or the other way round, the console host and the
  player refuse to start and name the command to run. *Proof:* .NET parity
  run output for the refusal case.
- **AC10 (B4).** After setup, bundle, both parity runs and a player build,
  `git status --porcelain` lists nothing under `unity/`. *Proof:* the command
  output, in `review.md`.
- **AC11 (B3, B18).** No file under `unity/` contains `JsonUtility`, `Jint`
  or `V8ScriptEngine` outside the host's worker class. *Proof:* a grep in
  review pass output.
- **AC12 (B1, B12, B17), the live check** (owed, by the owner):
  1. Run `npm run unity:setup` once.
  2. In Unity Hub, Add → `unity/Heraklios` (6000.6.10f1), then open
     `Assets/Scenes/Shell.unity`.
  3. Press Play. The console shows no errors, and the panel shows the stamp
     and "engine ready".
  4. Click "Run demo". Watch the moves, the attack, the retreat question
     with its highlighted options, and its answer.
  5. Click "New game", select a red unit, click a highlighted hex, and
     click "End phase". While each call runs, the panel shows "Engine
     working…" and clicks do nothing.
  6. Edit any file in `src/engine/` without rebundling, and press Play
     again. Play is refused with the bundle-stale message. Then undo the
     edit.
  7. Run `npm run unity:parity` in a terminal and read `PARITY OK`.

  No `npm run e2e` scenario can stand in for this (`REVIEW-POLICY.md` →
  "When the smoke suite stands in"). The change is new, and it is not
  browser code.
- **AC13 (B15, B20).** `npm run verify` and `npm run e2e` pass unchanged in
  scope and count, apart from the new vitest files. The runbook section
  exists. *Proof:* the review's verify and e2e runs.

## Non-functional

- **Engine/presentation split:** no `src/engine` or `src/data` rule changes.
  The two named seams, `src/engine/hostJson.ts` (B10) and
  `src/engine/parity.ts` (B11), import only engine and data modules. Each is
  its own commit, with its tests, before any `unity/` code. `host.ts`,
  `gameSession.ts`, `combatResolution.ts`, `deployment.ts` and
  `fuzzHarness.ts` are not modified. The shell calls only the facade.
- **Save format:** unchanged. No `SAVE_VERSION` change.
- **Undo boundaries:** none. The shell has no undo.
- **AI / harness:** `playRandomGame`'s traces and stats are untouched. The
  harness ships inside the bundle so that the player can run parity. This
  costs bundle size (the probe's harness-inclusive bundle was 65.6 KB
  minified) and changes no behaviour.
- **Dependencies (principle 14):**
  - no new npm dependency; bundling uses Vite's API;
  - NuGet packages pinned exactly (B2), with no floating versions;
  - no Unity registry package beyond those a clean 6000.6.10f1 project
    creates.
- **Size:** new TypeScript modules stay under 500 lines. The lint cap (19,
  `package.json:12`) does not rise: the trap file is ignored, not
  suppressed.
- **Platform:** Windows desktop x64 only (§70 condition 3). The shared host
  code keeps to the C# 9 that Unity 6 compiles.

## Out of scope

- A playable game in Unity: menu, army builder, placement, saves, combined
  attacks, naval prompts and a 3D view. That is §70 step 3.
- macOS, Linux, mobile, WebGL, IL2CPP, Jint and the Node sidecar.
- Wiring either parity gate into `npm run verify`, `/review` passes or any
  CI. A later `REVIEW-POLICY.md` change can make the .NET gate a required
  pass for engine changes.
- Player-facing text and translation. The shell's labels are developer
  English, outside `src/ui/i18n/`.
- Merging or deleting `exp/70-unity-front-end-probe`.
- Store builds, code signing and any legal review of the licence notes
  beyond recording them.

## Assumptions I made

The owner gave no answers to the intent's five questions. The intent's draft
assumptions are kept, decided on this evidence, and each can be overridden at
the spec stop.

1. **Folder: `unity/`, created clean** (Q1). No `frontends/` tree exists, and
   one top-level name is the easiest to exclude from every glob (B19). Only
   what the probe proved is reused: the hex maths, the batch build entry,
   the plugin restore and the DLL set (see "What the probe proved"). Its
   generated `ProjectSettings/` are not copied. A clean project from the same
   editor version makes its own.
2. **Both gates** (Q2). The .NET console for the routine check (B13): V8
   started in about 280 ms in the probe's .NET bench, and needs neither Unity
   nor a player build. Unity batch mode in a built player before a release
   (B14), because only the player runs Unity's Mono runtime and IL
   stripping. That runtime is where §70 measured a 60-fold Jint-to-V8 gap,
   against 30-fold under .NET, and V8 replays of 145-184 ms.
3. **Generated DTOs** (Q3). A generator over the TypeScript types, committed
   output, and a drift test (B8, AC5). It is a real tool to maintain (the
   weakest point of this spec); hand-written DTOs would drift silently, and
   §70 finding 8 shows how a hand-made shape went wrong.
4. **Stamp: commit, content and protocol** (Q4). The intent's commit-and-
   version stamp is kept, read as I1 and I2. A content hash alone would not
   say which commit a bundle came from. A commit alone would not catch an
   uncommitted engine edit, or would refuse after every docs commit.
5. **Scripted demo plus click-to-move** (Q5), as B16-B17. The demo is
   generated against the current engine rather than hand-written, so an
   engine change cannot quietly break it, and AC3 fails `verify` if no seed
   works any more.
6. **Two engine seams, not a separate intent.** They hold no rule, only JSON
   framing and the parity payload, and the intent's Constraints allow "a
   separate, tested `src/` change" named here. No `blocked_by` is needed.
   §72 is merged (`3d8ed67`), and §73 is not needed.
7. **The facade lives in `src/engine/`**, beside `host.ts`. That way it is
   type-checked, linted and tested by `verify`. A bridge file inside `unity/`
   would be invisible to every tool (B19) by design.
8. **Unity and .NET paths** are found on `PATH`, else at
   `C:\Program Files\Unity\Hub\Editor\<ProjectVersion>\Editor\Unity.exe` and
   `C:\Program Files\dotnet\dotnet.exe`. They are overridable by the
   environment variables `HERAKLIOS_UNITY` and `HERAKLIOS_DOTNET`.
9. **The .NET console targets `net11.0`**, the SDK installed here and the one
   the probe used (`exp/70:Bench/Bench.csproj:4`).

## Questions for the owner

None that change what gets built. At the spec stop, you may want to override
assumption 4 (I1: the bundle is stale after an engine change, not after every
commit) or assumption 2 (when the Unity batch gate is owed).
