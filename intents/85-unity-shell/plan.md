<!-- generated-by: heraklios/build-plan@0.2.0 -->
# §85 plan — A Unity shell hosts the engine through its supported entry, with a parity gate

Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md) (accepted 2026-11-23)

Approved before any code exists. If the plan turns out wrong mid-execution,
stop, fix the plan, and re-approve — don't push through.

## Goal

Put a second front end on `main`: a clean Unity 6000.6.10f1 project under
`unity/` that runs the unchanged TypeScript engine through its supported entry,
on one worker thread, and a parity gate that fails loudly when the engine run
inside V8 stops matching the engine run in Node. The two seams come first, as
tested `src/` commits (`src/engine/parity.ts`, `src/engine/hostJson.ts`). The
tooling (bundle with a stamp, DTO generator, demo finder, exclusion proof)
comes second, as tested Node scripts. The C# host, the .NET parity console,
the Unity project and the scene come last. Nothing in the web game changes,
except two watcher/scan lines in `vite.config.ts` and `vitest.config.ts`.

## Risks

- **A seam that is tested only against itself.** A test that compares
  `hostJson` to a copy of `hostJson`'s own logic passes whatever the code does.
  Every seam test compares against `host.ts` or a direct `playRandomGame`
  call, and each behavioural line below names the mutant that must fail.
- **The parity gate that cannot fail.** A hash computed from a payload that is
  built differently on each side, or a reference computed from the same bundle,
  would always match. The reference comes from the **unbundled** `src/` under
  vitest; both sides call the one `parityPayload`. Subtask 17 must show
  `MISMATCH` on a deliberately edited reference (AC7).
- **A stale bundle or stale DTOs that run anyway** (B7). Mitigated by the
  stamp unit tests (AC4), the in-memory DTO drift test (AC5) and the refusal
  case in AC9. The most likely bug is the `--check` path recomputing
  `sourceHash` from a different file set than the build did. Both use one
  function over the bundler's own input list.
- **Opaque action tokens re-serialised by C#.** The probe wrote `facing: 0`
  into every `navalMove` (§70 finding 8). C# must never `JsonConvert.Serialize`
  an `Action`. AC11's grep and the `applyLegal(listingId, index)` API are the
  guard. A stale `listingId` is refused (B9).
- **Engine thread discipline.** V8 is single-threaded. Any `V8ScriptEngine`
  call from the Unity main thread, or a `legal` call per frame, defeats the
  design. The host counts calls and the thread that ran each (B12), and AC8
  asserts "main thread made 0".
- **Compiles under .NET, not under Unity.** The shared host source builds
  under `net11.0` in `unity/Parity` but must also build under Unity's C# 9 and
  Mono. The Parity project is built with `LangVersion` 9.0 (assumption 3) to
  catch C# 10+ syntax early. Only Unity itself proves the rest.
- **Machine memory** (about 2 GB free). A Unity editor, a `dotnet` build server,
  `vitest` and a Vite dev server together would swap the machine. See
  "Validation: one heavy command at a time".
- **Tool pickup of `unity/`.** `Library/` holds tens of thousands of files and
  `unity/tool-trap/` holds deliberately broken files. Any tool that globs
  `unity/` breaks `verify` or floods the dev watcher. Covered by B19, the trap
  and AC6. The check that matters most is the live one after Unity has populated
  `Library/`.
- **Stale line citations.** This plan was re-read at the hash below. The spec
  was written against `7a9b113`. Several files changed since (a diff stat shows
  UI files only; no engine file cited by the spec moved).
- **Lint cap.** `package.json:12` is `--max-warnings 18`. The spec says 19
  (Non-functional → Size). Main is 18 and must not rise. New `.ts` and `.mjs`
  files add no warnings (files under 500 lines, functions under 80).
- **Drift-machine fall-through** (this repo's known class): not touched. No
  engine rule changes and `drift.ts`/`combatResolution.ts` are not edited. The
  demo's retreat answer exercises the existing path.
- **The demo finder policy may not find a seed.** The spec's trial found seed 4
  (retreat after 61 actions). If the finder, once written, finds no seed of 50
  or less within 200 actions, this is a spec problem (AC3 and B16), not
  something to tune by hand. Stop and amend the spec.

## Verified against the codebase

Re-read on `main` at `2dd6375`. The spec's `7a9b113` checks were re-done on the
points below; no engine, data, script or config file the spec cites changed
between the two hashes (the intervening commits touch `src/ui/` and intents).

- `src/engine/host.ts:35-58` — `HostPlayerConfig`, `HostConfig` exports
  (`players`, `seatOrder`, `options`, `seatControls`).
- `src/engine/host.ts:60-70` — `HostDeployError` carries `seat`, `request`,
  `deployError` (the `kind` the facade reports).
- `src/engine/host.ts:72-91` — `HostStep` and `Host` (`legalActions`, `apply`,
  `question`, `state`, `save`).
- `src/engine/host.ts:~102-138` — every output is a deep copy through JSON
  (`copy`, line ~100).
- `src/engine/host.ts:~168-200` — `newGame(config, seed)` with `requireSeed`,
  `createSeededRng(seed)`, `deployAll` (placements or `autoDeploy`).
- `src/engine/host.ts:~207` — `load(savedJson, seed)`.
- `src/engine/combatResolution.ts:41-48` — `Question` union (`retreat`,
  `pushTarget`, `advance`, `exchangeSacrifice`), each with `player`.
- `src/engine/combatResolution.ts:51` — `AnswerAction`; `:57` — `SessionEvent`.
- `src/engine/gameSession.ts:45` — `SessionAction = Action | AnswerAction`.
- `src/engine/gameSession.ts:81-85` — `sessionLegalActions`: with a question open
  exactly its answers.
- `src/engine/gameSession.ts:~155-165` — a turn action while a question is
  open throws.
- `src/engine/actions.ts:442-443` — `legalActions` starts with `{kind:
  'endPhase'}` (so index 0 is `endPhase` only with no question open).
- `src/engine/actions.ts:153` — `ActionResult`.
- `src/engine/army.ts:67-80` — `defaultArmySelection()` (not on the host).
- `src/ui/session.ts:82`, `:128` — the web game's default edges
  `['W','E','N','S']`, sliced to the player count. For two players: W and E.
- `src/engine/fuzzHarness.ts:145` — `buildFuzzGameState()`.
- `src/engine/fuzzHarness.ts:847-878` — `PlayRandomGameOptions` with
  `turnCap`, `trace`, `buildInitialState`.
- `src/engine/fuzzHarness.ts:1083-1088` — `async playRandomGame(seed, options)`
  builds state with `(options.buildInitialState ?? buildFuzzGameState)()`, so
  the object returned is the one mutated in place.
- `src/engine/fuzzHarness.ts:905` — `formatAction` is **not exported**, and the
  spec forbids modifying `fuzzHarness.ts`. The demo's `expect` therefore cannot
  use it (assumption 1).
- `src/data/map.ts:21`, `:1315` — `MAP_TERRAIN` (`ReadonlyMap<string,
  TerrainType>`) and `RIVER_HEXSIDES` (`ReadonlySet<string>`).
- `src/engine/hex.ts:88` — `hexDistance`.
- `vite.config.ts` (whole file, 20 lines) — `root: '.'`, `saveApiPlugin()`,
  `server.port`, `build.rollupOptions.input` of the two HTML files; no `watch`
  or `optimizeDeps` today.
- `vitest.config.ts:11` — `include` already lists `scripts/**/*.test.mjs`, so
  Node-script tests run under `npm test`; `unity/` is not matched.
- `tsconfig.json:16` — `include` is an explicit list with no `unity` and no
  `scripts`.
- `eslint.config.js:57-66` — `ignores` list (`dist/`, `node_modules/`,
  `.claude/`, `.codex/`, `tools/map-extract/`, ...).
- `package.json:12` — `"lint": "eslint . --max-warnings 18"`. `vite` is
  `8.3.4`, `typescript` `^5.7.2`, `vitest` `5.0.3`. `node_modules/.bin/rolldown`
  exists. No esbuild, no tsx. Node is v24.11.0.
- `scripts/size-budget-lib.mjs:25-36` — `isBudgeted`: non-test `.ts`/`.mjs`/`.js`
  under `src/`, `server/`, `scripts/`, `tools/`. New scripts count, so each
  stays under 500 lines. `scripts/size-baseline.json` lists six files over 500
  lines; this plan touches none of them.
- `scripts/architecture-rules.test.mjs:1-14` — the ESLint Node API pattern
  AC6 follows.
- `docs/runbook.md` — headings `## 1. Agent workflow` (line 9) and `## 4.
  Runbook: detailed launch hazards appendix` (line 111). There is no section
  2 or 3; the new section is added as `## 5.` (assumption 7).
- `.gitignore` — no `unity/` entries today.
- Machine: `C:\Program Files\dotnet\dotnet.exe` exists (SDK 11.0.100, not on
  PATH); `C:\Program Files\Unity\Hub\Editor\6000.6.10f1\Editor\Unity.exe`
  exists; the NuGet cache already holds `microsoft.clearscript.v8` 7.5.1.1,
  `...native.win-x64` 7.5.1.1 and `newtonsoft.json` 13.0.3, so the spec's pins
  exist and resolve.
- Probe, read with `git show exp/70-unity-front-end-probe:unity-probe/...`
  (never checked out): `parity-reference.probe.ts` (the vitest reference
  method, seeds 42/7/2026, `turnCap: 7`), `engine-entry.ts` (imports engine
  modules directly: the thing B10 replaces), `bundle.mjs` (esbuild, not
  carried), `PluginPack/PluginPack.csproj` (floating `4.*`/`7.*`, Jint),
  `setup.cmd` (the DLL copy list), `UnityProbe/Assets/Editor/ProbeBuild.cs`
  (batch scene and build entries, `Sprites/Default` always-included),
  `UnityProbe/Assets/Scripts/EngineHost.cs` (`JsonUtility`, main-thread calls),
  `UnityProbe/ProjectSettings/ProjectVersion.txt` (`6000.6.10f1`).

## Where this goes

- **Modules touched (existing):**
  - `vite.config.ts` and `vitest.config.ts`: the `unity/` watch ignore, and
    Vite's `optimizeDeps.entries` (the two HTML entries);
  - `eslint.config.js`: add `'unity/'` to `ignores`;
  - `package.json`: four scripts (`unity:setup`, `unity:bundle`, `unity:dtos`,
    `unity:parity`). No dependency is added;
  - `.gitignore`: the B4 list;
  - `docs/runbook.md` (new section), `docs/architecture.md` (the new
    boundary), `CLAUDE.md` (commands and module map).
- **New `src/` modules (engine layer, each a sentence):**
  - `src/engine/parity.ts`: builds the exact string that both sides hash,
    `JSON.stringify({ stats, trace, state })`, by calling `playRandomGame`;
  - `src/engine/hostJson.ts`: a string-in, string-out facade over `host.ts`
    that adds no rule: listing ids, index-based apply, board flattening,
    default config, stamp, errors as data.
- **New tooling modules (`scripts/`, not imported by the game, principle 4):**
  - `unity-stamp-lib.mjs`: computes and compares the stamp;
  - `unity-bundle.mjs`: the bundle build, writes the stamp and the demo, and a
    `--check` mode;
  - `unity-dtos-lib.mjs` and `unity-dtos.mjs`: the TypeScript-compiler-API DTO
    generator and its CLI;
  - `unity-demo-lib.mjs`: the demo finder, over any facade object;
  - `unity-tools-lib.mjs`: finds `dotnet` and Unity (PATH, default location,
    `HERAKLIOS_DOTNET`/`HERAKLIOS_UNITY`), pure with an injected file system;
  - `unity-setup.mjs`, `unity-parity.mjs`: the two commands, each running its
    steps one after another;
  - `unity-reference.vitest.mjs` with its own config
    `unity-reference.vitest.config.mjs`: computes the Node reference under
    vitest, kept out of `npm test` because `.vitest.mjs` does not match the
    main `include` (assumption 2).
- **New top-level folder `unity/`** (B1): `Heraklios/` (Unity project, with
  `Assets/Heraklios/Host/` the shared C# host without `UnityEngine`),
  `Parity/` (.NET console), `Restore/` (restore-only), `tool-trap/`,
  `THIRD-PARTY.md`.
- **Why there:**
  - The facade and payload sit in `src/engine/` beside `host.ts`, so
    `tsc`, `eslint` and `vitest` check them (principle 15; spec assumption 7).
    They import only engine and data modules, so principle 2 holds.
  - Tooling stays in `scripts/` (principle 4). The C# lives in `unity/`, which
    every TypeScript tool ignores (B19). It holds no rule (principle 5).
  - The shell calls one entry, `hostJson.ts` through the bundle, so principle 6
    holds: rules and board data have one source.
  - `hostJson` imports `parity`, which imports `fuzzHarness`. The game never
    imports `hostJson`, so the web build does not carry the harness.
  - Principle 17: `docs/architecture.md` gets the new boundary in the same
    intent, as an *enforced-by-ignore, judged* note: `unity/` is a second front
    end that calls only `hostJson.ts`.
- **Budget lines:** none. No file over 500 lines grows, and each new file
  stays under 500 lines. (`fuzzHarness.ts`, `BoardScene.ts` and the other four
  baseline files are untouched.) Format, were one needed:
  `- budget: <path> +<n>: <reason>`.
- **Dependencies (principle 14):** no npm dependency is added. NuGet pins are
  the spec's: `Microsoft.ClearScript.V8` 7.5.1.1,
  `Microsoft.ClearScript.V8.Native.win-x64` 7.5.1.1, `Newtonsoft.Json` 13.0.3.
  Bundling uses Vite 8's `build()` (rolldown), not esbuild. The DTO generator
  uses the `typescript` devDependency.

## Subtasks

Each is its own commit. Subtasks 1-2 are the two seams and come before any
other file. No later subtask edits `host.ts`, `gameSession.ts`,
`combatResolution.ts`, `deployment.ts` or `fuzzHarness.ts`.
"Who" says who can run the check: **A** is the implementer agent headless;
**O** is the owner (or a reviewer on the owner's machine).

1. **Seam 1: `src/engine/parity.ts` + `parity.test.ts`** (B11, AC2). Export
   `parityPayload(seed, turnCap, buildInitialState = buildFuzzGameState)`,
   resolving to `JSON.stringify({ stats, trace, state })` where `state` is the
   object `buildInitialState` returned. Who: A. `npm run verify`.
2. **Seam 2: `src/engine/hostJson.ts` + `hostJson.test.ts`** (B9, B10, AC1).
   The facade as in B10, plus `parity(seed, turnCap)` delegating to subtask 1.
   Each `legal()` returns `{ listingId, actions, descriptions }`, where
   `descriptions[i]` is `JSON.stringify(actions[i])` (assumption 1).
   `stamp()` reads an injected global and returns a fixed "not bundled"
   object when it is absent. One facade holds one game; every call returns a
   JSON string and errors come back as `{ ok: false, error }`. Who: A.
   `npm run verify`.
3. **Exclusion** (B19, AC6): `.gitignore` (B4), `eslint.config.js`,
   `vite.config.ts`, `vitest.config.ts`, `unity/tool-trap/{trap.ts,
   trap.test.ts, trap.html}` and `scripts/unity-exclusion.test.mjs`. Who: A.
   `npm run verify` green *with* the trap committed, then `git status`.
4. **Stamp** (B6, B7, AC4): `scripts/unity-stamp-lib.mjs` and its test. Pure
   functions: build a stamp from `{ inputs, commit, dirty, protocolHash }`,
   compare a stamp with a recomputation. Who: A.
5. **DTO generator** (B8, AC5): `scripts/unity-dtos-lib.mjs`,
   `scripts/unity-dtos.mjs` and the drift test. The first committed
   `HostDtos.g.cs` is produced here. Who: A to write and run the drift test; the
   output compiles only in subtask 9.
6. **Bundle** (B5, B6): `scripts/unity-bundle.mjs` (Vite `build()` library mode,
   IIFE, ES2020, input list taken from the build output, stamp injected with
   `define`, `--check` rebuilds in memory and writes nothing). Writes under
   `unity/Heraklios/Assets/StreamingAssets/engine/`. Who: A.
7. **Demo finder** (B16, AC3): `scripts/unity-demo-lib.mjs` over a facade
   object, its test (against `hostJson` on unbundled source), and the bundle
   step's use of it through the bundle loaded in a Node `vm`. Writes
   `demo.json`. Who: A. If no seed qualifies, stop (see Risks).
8. **Tool lookup and setup script** (B2, assumption 8 of the spec):
   `scripts/unity-tools-lib.mjs` with tests (PATH hit, default-location hit,
   env override, missing tool names the install hint), `unity/Restore/
   Restore.csproj` (pinned versions, no Jint), `scripts/unity-setup.mjs`
   (restore, copy the five DLLs plus the native package's `License.txt`, run
   the bundle step; idempotent). Who: lookup tests A; the real
   `unity-setup.mjs` run needs NuGet (cache already holds the pins; network
   otherwise): A tries it, O if the network is blocked.
9. **Shared C# host** `unity/Heraklios/Assets/Heraklios/Host/` (B7, B9, B12,
   B18, AC11): an assembly definition with no `UnityEngine` reference;
   `EngineWorker` (the only class that names `V8ScriptEngine`), request and
   result queues, stamp and `protocolHash` check, call and thread counters,
   `listingId` handling, a `ParityRunner` (cases, SHA-256 of the UTF-8 bytes,
   output lines `parity <case>: MATCH|MISMATCH <hash16> <ms>`, `PARITY OK` or
   `PARITY FAILED`), and a demo runner reading `demo.json`. Who: A writes it;
   compiled in subtask 10.
10. **.NET parity console** `unity/Parity/Parity.csproj` (`net11.0`,
    `LangVersion` 9.0, the Host source by file link, not copy) and
    `scripts/unity-parity.mjs` (steps 1-3 of B13, one after another).
    Who: A runs it (`dotnet build`, `dotnet run`), and the AC7/AC9 cases.
    Heavy: see Validation.
11. **Documentation** (B20, B21): `docs/runbook.md` section 5,
    `docs/architecture.md` boundary note, `CLAUDE.md` commands and module map,
    `unity/THIRD-PARTY.md`. Who: A. `npm run verify` green.
12. **Unity project, clean** (B1): create `unity/Heraklios` with Unity
    6000.6.10f1 in batch mode (`-createProject`), old Input Manager, IMGUI;
    commit `Packages/manifest.json`, `ProjectSettings/`, the plugin `.meta`
    files for the five DLLs (x86_64/Windows import settings for the native
    one), and the asmdefs. Who: **O** (may need the owner's licence and a free
    machine); A may try, and records "not run" in Progress if Unity refuses.
13. **Editor scripts** (B7, B14): `Assets/Heraklios/Editor/`: scene creation
    (`Shell.unity`, with `Sprites/Default` in the always-included shaders), the
    Play-mode and pre-build stamp hook (`node scripts/unity-bundle.mjs
    --check`), and `BuildWindows`. Who: A writes; Unity compiles it: **O**.
14. **The scene** (B17): `ShellBoard` MonoBehaviour: flat board from `board()`,
    unit hexes, state panel, buttons ("Run demo", "New game", "End phase",
    "Run parity"), click-to-move from the cached listing, the question panel
    with clickable retreat options, the "Engine working…" state, and the batch
    entry (`-parity <reference> -demo`). Who: A writes; **O** compiles and
    looks at it.
15. **Player build and batch run** (B14, AC8, AC9, AC10):
    `npm run unity:parity -- --unity`. Who: **O** (or the reviewer on the
    owner's machine), alone.
16. **Hygiene proof** (B4, AC10): after 8, 10, 12 and 15, `git status
    --porcelain` shows nothing under `unity/`. Who: A for what it ran; O
    after the Unity runs.
17. **Gate proof** (AC7): run `npm run unity:parity`, then edit the reference
    by one byte and run it again to see `MISMATCH` and a non-zero exit. Who: A.

## Tests

Each line names the mutant that must make a test fail. A test that passes on
its mutant is rewritten.

**`parity.test.ts` (subtask 1).**
- `parityPayload(7, 7)` equals the string built by hand from `playRandomGame(7,
  { turnCap: 7, trace, buildInitialState })`. Mutants: swap `trace` and
  `state`; drop `trace`; ignore `turnCap` (`parityPayload(7, 3)` must differ
  from `(7, 7)`); ignore the seed (`(7,7)` differs from `(42,7)`).
- Two calls give the same string (mutant: leaking module state between calls).
- The state in the payload is the **final** state, not the initial one:
  `state.turnNumber` (or the unit count) differs from a fresh
  `buildFuzzGameState()`. Mutant: capture a copy before the game.
- Keys are exactly `stats`, `trace`, `state`, in that order (mutant: add
  `traceLength`, §70's field).

**`hostJson.test.ts` (subtask 2).**
- Everything returned is a `string` that parses as JSON. Mutant: return an
  object from any method.
- A game played to its end by always applying index 0 or the last index
  through the facade has the same final `state()` and the same event/step
  sequence as the same game through `host.ts` (`newGame`) with the same seed.
  Mutant: re-seed in the facade; apply `index + 1`.
- `applyLegal` with the previous `listingId` after a state change returns
  `ok:false` and `state()` is byte-equal before and after. Mutants: ignore
  `listingId`; increment it only when the listing is non-empty.
- `applyLegal` with `-1`, `actions.length`, `1.5` and `NaN` returns `ok:false`
  and changes nothing. Mutant: `index <= length`.
- With a question open (use a seed and play from the demo finder's result, or
  `buildPushScenarioGameState`-like state through `load`), `legal()` lists
  exactly the answers, and `endPhase` is not at index 0. Mutant: facade
  filters or reorders.
- `newGame` with a `placements` entry `deployUnit` refuses returns `{ ok:false,
  error: { message, kind } }`, not a throw (mutant: rethrow `HostDeployError`),
  and the previous game is unchanged (mutant: replace the facade before
  deploying).
- `board()`: every `MAP_TERRAIN` key and every `RIVER_HEXSIDES` entry appears
  once with the same terrain and the same hexside; counts match. Mutants: swap
  `q` and `r`; drop rivers; emit only a sample.
- `defaultConfig()` has two seats, edges `W` and `E`, and
  `defaultArmySelection()` for each. Mutant: edges `N`/`S`.
- `state()` and `legal()` outputs are copies: mutating a parsed result changes
  nothing (mutant: return live references).
- `stamp()`: the injected global comes back as given, and the fallback marks
  "not bundled". Mutant: always fallback.
- `parity(seed, turnCap)` resolves to the same string as `parityPayload`.
  Mutant: a different default `buildInitialState`.
- `load` of a `save()` output resumes with the same state (mutant: seed ignored
  when loading).

**`unity-exclusion.test.mjs` (subtask 3, AC6).**
- ESLint's `isPathIgnored('unity/x.ts')` is true. Mutant: remove `'unity/'`
  from `ignores`.
- No vitest `include` glob matches `unity/tool-trap/trap.test.ts` (use
  `picomatch`/the glob engine vitest ships, as the test already can; if none is
  importable without a new dependency, use `path.matchesGlob` from Node 24).
  Mutant: add `unity/**/*.test.ts` to `include`.
- The parsed `tsconfig.json` `include` holds no `unity` path.
- Both `vite.config.ts` and `vitest.config.ts` (imported as modules) carry a
  watch ignore matching `unity/`, and Vite's `optimizeDeps.entries` equals the
  two HTML files. Mutants: remove either ignore, or drop `entries`.
- The green `npm run verify` with the trap present is the end-to-end proof
  (a vitest-run `trap.test.ts` would fail it).

**Stamp tests (subtask 4, AC4).**
- Same inputs give the same stamp. Mutant: include a timestamp.
- `--check` logic reports stale when one input's content changes, when `dirty`
  flips, and when `engineCommit` differs; fresh after a change to a file that is
  not an input (docs-only). Mutants: hash only file names; ignore `dirty`;
  treat any commit as changing the stamp.
- The `protocolHash` mismatch is its own refusal naming `npm run unity:bundle`
  or `npm run unity:dtos`. Mutant: a generic message.
- The stamp global in the bundle text equals `engine.stamp.json` (checked in
  subtask 6 against a real bundle in a Node `vm`).

**DTO tests (subtask 5, AC5).**
- Regenerating in memory equals the committed `HostDtos.g.cs`. Mutant: edit a
  field in `host.ts`'s types without regenerating (simulated with a fixture
  `.ts` program); the drift test fails.
- Fixture types: a union with a `kind` discriminator, a literal-number union,
  a string-literal union, an optional field, a nested array. Each maps as
  specified in B8.
- An unsupported construct (for example a tuple type, a mapped type or
  `Map`) makes the generator throw naming the type. Mutant: fall back to
  `object`.
- `protocolHash` is stable for the same model and changes when any field type
  changes.

**Demo and tool tests (subtasks 7-8, AC3).**
- The finder on the unbundled facade finds a seed of 50 or less that answers a
  `retreat` within 200 actions; replaying its steps by index reproduces every
  `expect`. Mutants: the replay applies index `i + 1`; the finder records the
  wrong description; the finder stops before the retreat answer.
- Replay against a changed listing (one description edited) is refused with the
  "demo is out of date" message.
- Tool lookup: PATH hit, default-location hit, env override wins, missing tool
  names the hint. Mutants: ignore the env override; swallow a missing tool.

**C# side (subtasks 9-10, 14-15).** There is no C# unit-test project in the
spec, so the proof is the parity runs and the player run:
- AC7: `MATCH` for seeds 7, 42, 2026 and `demo`; an edited reference gives
  `MISMATCH`, `PARITY FAILED` and a non-zero exit. This is the mutation test of
  the gate.
- AC9: a bundle built from an edited engine file with DTOs left alone, and the
  reverse, are refused by the console host with the command to run.
- AC8: "all N engine calls on the worker thread (main thread made 0)" and
  "legal calls = state changes + 1". The mutant is calling the engine from the
  main thread or `legal` from `Update`; the counters catch it.
- AC11: a grep of `unity/` for `JsonUtility`, `Jint` and `V8ScriptEngine`
  outside the worker class returns nothing.

Every spec B and AC maps as follows: B1 → 3, 12; B2 → 8; B3 → 9 (AC11); B4 →
3, 16; B5, B6 → 4, 6; B7 → 4, 9, 13 (AC4, AC9); B8 → 5 (AC5); B9 → 2, 9 (AC1);
B10 → 2 (AC1); B11 → 1 (AC2); B12 → 9, 14 (AC8); B13 → 10, 17 (AC7); B14 → 13,
15 (AC8); B15 → 11 (AC13); B16 → 7, 14 (AC3); B17 → 14 (AC12); B18 → 9 (AC11);
B19 → 3 (AC6); B20 → 11 (AC13); B21 → 8, 11; AC10 → 16; AC12 → live check;
AC13 → Validation.

## Validation

**One heavy command at a time.** Free memory is about 2 GB. Never run two of
these together, and never a Unity or .NET command with `npm run e2e`, `vitest`,
`npm run verify`, `npm run dev` or a browser open:

1. `npm run verify` (it runs build, lint, test one after another).
2. `npm run e2e` (once, alone).
3. `dotnet` build or run, with `--disable-build-servers` and `-m:1`, followed by
   `dotnet build-server shutdown`, so no compiler server stays resident.
4. Unity in batch mode (project creation, scene creation, player build,
   `-parity` run): one process, with no editor open and no other heavy process.
5. The owner's editor session (AC12).

Before each, look at free memory and at the process list (`tasklist`). The
`npm run unity:parity` script runs its steps in sequence and never launches
the next before the previous exits.

- **Per subtask:** `npx vitest run <the new test file>`, then
  `npm run verify` before each commit (subtasks 1-8 and 11).
- `npm run check:intent` PASS on the branch.
- `npm run lint`: the warning count stays at or under 18 (`package.json:12`),
  and the cap is **not** raised.
- `npm run e2e` passes unchanged in scope and count, once, after subtask 3 (the
  `vite.config.ts` change) (AC13).
- `git status --porcelain` lists nothing under `unity/` after setup, a bundle,
  a parity run and a player build (AC10).
- Pasted into `review.md` by the reviewer: the output of `npm run
  unity:parity` (AC7, AC9) and `npm run unity:parity -- --unity` (AC8).

**What the implementer agent can run:** everything in subtasks 1-8, 10-11 and
17 (Node, vitest, `dotnet`, in order, with the memory rules). That includes
`dotnet build` and `dotnet run` of `unity/Parity` against the bundle, if NuGet
restore works (the pins are in the NuGet cache; otherwise a network is needed).

**What only the owner can run (or a reviewer on the owner's machine):**
- Subtask 12 (create the Unity project; the editor may need the owner's licence
  or sign-in, and `-batchmode -nographics` may refuse without one).
- Subtasks 13-14 compiled and opened in Unity: a C# error under Unity's C# 9
  and Mono shows only there.
- Subtask 15: the player build and `-batchmode -parity -demo` run (AC8, AC9,
  AC10). An agent may try after 12, but only when memory allows, and it records
  "not run" in `## Progress` when it does not.
- The live check below.

### Live check (owed)

Owed by rule 1 of `REVIEW-POLICY.md` → "Live checks" (the diff touches
`vite.config.ts`) and by rule 3 (the Unity run and the player are runtime
behaviour no test shows). The smoke suite cannot stand in: the change is new and
it is not browser code. The check covers two things.

**A. The Unity shell (AC12).**
1. Close the browser and any dev server. Run `npm run unity:setup` once.
2. In Unity Hub: Add `unity/Heraklios` (6000.6.10f1) and open
   `Assets/Scenes/Shell.unity`.
3. Press Play. The console has no errors. The panel shows the stamp and
   "engine ready".
4. Click "Run demo". Watch the moves, the attack, the retreat question with its
   options highlighted, and its answer.
5. Click "New game", select a red unit, click a highlighted hex, click "End
   phase". During each call the panel shows "Engine working…" and clicks do
   nothing.
6. Edit any file in `src/engine/` without rebundling and press Play. Play is
   refused with the bundle-stale message. Undo the edit.
7. In a terminal (Unity closed): `npm run unity:parity` ends with `PARITY OK`.

**B. The web game is untouched (the `vite.config.ts` change).** After step A,
with `unity/Heraklios/Library/` now full, close Unity, then run `npm run dev`.
The menu loads at `/` and the map editor at `/map-editor.html`, with no
dependency re-scan error in the terminal. Start a seeded game and move a unit.
Touch a file under `unity/` and see that the dev server does not reload. Stop
the server. (This step is not part of `npm run e2e`.)

If the owner does not want to run Unity, the live check is not
done: record it as not checked, never as passed on an agent's run.

## Assumptions I made

Beyond the spec (the spec's own nine assumptions are accepted and not repeated):

1. **`expect` is the action's JSON text, not `formatAction`.** The spec says
   "the action's compact description" (B16). `formatAction` is not exported and
   `fuzzHarness.ts` may not change. The facade's `legal()` therefore returns an
   extra `descriptions` array (`JSON.stringify` of each action), and C#
   compares those strings opaquely, never rebuilding an action. This adds one
   field to B10's `{ listingId, actions }` and one to the DTOs.
2. **The Node reference runs under a second vitest config.** B13 step 2 says
   "under vitest as §70 did". The main `include` matches only `*.test.*`, so
   the reference file is `scripts/unity-reference.vitest.mjs`, run by
   `vitest run --config scripts/unity-reference.vitest.config.mjs`. This keeps
   a reference-writing "test" out of `npm test`. If vitest 5 refuses the
   config, the fallback is an env-gated `it.skipIf` in a `*.test.mjs`, which
   adds one skipped test to the count.
3. **`unity/Parity` is built with `LangVersion` 9.0** so that C# 10+ syntax
   fails early under `dotnet build`, standing in for Unity's compiler. It does
   not check the netstandard 2.1 API surface.
4. **The demo finder runs against the real bundle** (loaded in a Node `vm`) in
   the bundle step, and against the unbundled `hostJson` module in the vitest
   test. Both use one function over a facade object. That is how "the fresh
   engine" (B16) and "the unbundled source" (AC3) are both met.
5. **`--check` rebuilds the bundle in memory** to get the input list and
   recompute the hash, and writes nothing. The stamp file stays at the four
   fields of B6.
6. **`protocolHash` reaches the bundle through Vite's `define`**, computed by
   the generator's in-memory run, so the TypeScript source carries no hash.
7. **`docs/runbook.md` gets the section number 5** (the file has sections 1 and
   4 only).
8. **The `unity-parity.mjs` script passes the reference path** to the player
   as `-parity <path>` and relays the player log's last verdict line and exit
   code (B14).
9. **The Parity project and the player share `ParityRunner`**, so the output
   lines of AC7 and AC8 come from one piece of C#.
10. **The lint cap is 18 on `main`.** The spec's "19" (Non-functional → Size,
    `package.json:12`) is out of date; the plan holds the cap at 18.

## Progress

<!-- The implementer appends here, one entry per phase: date, commits, what
shipped, test counts, anything that diverged from the plan. Nothing above
this line is the implementer's to edit. -->
