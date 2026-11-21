# §70 — Result: can a Unity front end drive the unchanged TypeScript engine?

**Verdict: GO WITH CONDITIONS, using ClearScript V8 (not Jint).** The unchanged
engine, bundled to one JS file, runs inside a Unity 6 Windows player under
ClearScript V8, replays seeded games to the byte-identical result Node gives,
and answers `legalActions` + `applyAction` well under a frame. Jint also runs it
correctly but is too slow inside Unity's Mono runtime for anything beyond a
tiny army. The conditions are listed under "Recommendation".

Branch `exp/70-unity-front-end-probe`. Nothing under `src/` was changed. Only
`eslint.config.js` (ignore `unity-probe/`) and `.gitignore` changed outside
`unity-probe/` and this folder.

## What was built (all in `unity-probe/`)

| Piece | Where |
|---|---|
| Bundle entry (bridge, JSON strings only, no rules) | `unity-probe/engine-entry.ts` |
| esbuild bundling, a probe-only dependency (`unity-probe/package.json`, not the root one) | `unity-probe/bundle.mjs` -> `engine.bundle.min.js` (65.6 KB minified, 127 KB plain; the whole engine + `map.ts` + fuzz harness) |
| Node/vitest parity reference (unbundled `src/` run through vitest) | `unity-probe/parity-reference.probe.ts`, `vitest.probe.config.ts`, output `parity-reference.json` |
| .NET console host: Jint, ClearScript V8, Node sidecar, timings, parity | `unity-probe/Bench/` |
| Unity 6 project (6000.6.10f1): scene, host, self-test, batch build | `unity-probe/UnityProbe/` |
| Plugin restore (Jint, ClearScript; NuGet, BSD-2 / MIT) | `unity-probe/PluginPack/`, `setup.cmd` |
| Evidence: screenshots from the built Windows player, bench output | `unity-probe/evidence/` |

C# contains no rule logic. It forwards JSON strings to `H.legal()`, `H.applyLegal(i)`,
`H.state()`, `H.map()`; it draws hexes from the map data, hit-tests a click into
a hex (presentation maths), and highlights the destinations that `legalActions`
returned for the selected unit.

## Reproduce

```
cd unity-probe
setup.cmd                                  :: npm install, esbuild bundle, Jint+ClearScript into Assets/Plugins, bundle into StreamingAssets
npx vitest run --config unity-probe/vitest.probe.config.ts   (from the repo root)  :: writes parity-reference.json
dotnet build Bench -c Release
dotnet Bench\bin\Release\net11.0\win-x64\Bench.dll %CD% all    :: parity + timings, 3 hosts
run-unity.cmd scene -quit -executeMethod ProbeBuild.CreateScene
run-unity.cmd build -quit -executeMethod ProbeBuild.BuildWindows   :: UnityProbe\Build\HeraklionProbe.exe
UnityProbe\Build\HeraklionProbe.exe -batchmode -nographics -selftest [-jint]   :: parity + timings inside the Unity player
UnityProbe\Build\HeraklionProbe.exe -batchmode -screenshot <prefix>            :: offscreen render (evidence/shot-*.png)
```
The Unity project opens directly in the Hub: `unity-probe/UnityProbe`, then
open `Assets/Scenes/Probe.unity` and press Play (see "By hand").

## The three ways to host the engine

All three load the same `engine.bundle.min.js` and the same bridge.

### A. Jint (pure managed JS interpreter, BSD-2)
- **Build:** NuGet `Jint` 4.x (netstandard2.0 build for Unity) plus `Acornima`; copy two DLLs to `Assets/Plugins`. No native code.
- **Works:** ES2020 output from esbuild ran unchanged, including `async`/`Promise` (`playRandomGame` is async: pump with `engine.Advanced.ProcessTasks()`).
- **Limit:** speed. It is an interpreter, and under Unity's Mono it is much slower than under .NET 11 (see tables). Platform-agnostic, so it is the only one of the three that could in principle reach IL2CPP targets such as iOS or consoles (not tested).

### B. ClearScript V8 (native V8 in-process, MIT)
- **Build:** NuGet `Microsoft.ClearScript.V8` 7.5 (netstandard2.1 build) + `Newtonsoft.Json.dll` (a hard dependency of its Core assembly: the IL linker failed without it) + `ClearScript.V8.ICUData.dll` + the native `ClearScriptV8.win-x64.dll`, all in `Assets/Plugins`. The standalone build grew from 99 MB (Jint only) to 142 MB.
- **Works:** in the Windows player and in the editor, no changes to the bundle. Promises settle when the call unwinds (`Execute("undefined")` in the pump loop).
- **Limit:** native binaries per platform. NuGet ships win-x64 here; macOS / Linux builds need their own native packages, and ClearScript does not support iOS, WebGL or consoles. The native DLL is not in git (setup restores it from the NuGet cache).

### C. Node sidecar over stdio (child process)
- **Build:** the same bundle, run by `Bench/sidecar.mjs` through `node:vm`; line-delimited JSON on stdin/stdout. Needs a Node runtime beside the game.
- **Works:** correct and fast in the .NET console bench. **Not tried inside Unity**, because it adds a process to ship and supervise for no benefit over B on Windows; it would be the fallback only where no in-process engine is available.
- **Limit:** shipping Node or a single-executable build, IPC error handling, a second process in a store build (some stores/sandboxes dislike child processes), and no UI-thread-free guarantee beyond what you build.

WebGL (the browser's own JS via a jslib bridge) was considered, not built: it
would call the same bundle with no embedded interpreter, but it is a different
target from the owner's first one (Windows desktop).

## Measurements

Machine: the owner's laptop (RTX 3060 Laptop, Windows 11). Medians over 200 calls after 30 warm-up calls, `legal` = `H.legal()` (JSON string out), `apply` = one `applyAction`, `state` = `H.state()` (JSON string out).
Two positions: **small** = the harness's 10-unit army (`buildFuzzGameState`, the only "start of a game" the engine itself can build; the real start position is built in `PlacementScene`, see findings); **large** = a bridge-built 54-unit position (24 land units a side on plains + 3 ships a side), because 10 units is not a real army. "Late" = after 60 / 200 seeded random non-combat actions of the host (movement, end phase). A true late-game position with combat was not reachable: see findings.

### .NET 11 console (JIT, optimised): `unity-probe/evidence/bench-results.txt`

| Host | Position | legal | apply | state | legal+apply+state |
|---|---|---|---|---|---|
| Jint | small start | 5.8 ms | 1.3 | 0.04 | 7.6 (p95 50) |
| Jint | small after 60 | 6.4 | 1.4 | 0.03 | 8.3 (p95 45) |
| Jint | large start | 218 | 6.8 | 0.06 | 229 (p95 335) |
| Jint | large after 200 | 208 | 7.7 | 0.06 | 219 (p95 357) |
| V8 | small start | 0.57 | 0.18 | 0.05 | 0.83 (p95 5.6) |
| V8 | small after 60 | 0.35 | 0.12 | 0.03 | 0.52 (p95 3.2) |
| V8 | large start | 6.9 | 0.39 | 0.08 | 7.5 (p95 12) |
| V8 | large after 200 | 6.1 | 0.38 | 0.08 | 6.6 (p95 12) |
| Node sidecar | small start | 0.52 | 0.20 | 0.16 | 0.91 (p95 4.3) |
| Node sidecar | small after 60 | 0.57 | 0.20 | 0.15 | 0.95 (p95 3.6) |
| Node sidecar | large start | 6.8 | 0.37 | 0.25 | 7.4 (p95 11) |
| Node sidecar | large after 200 | 6.3 | 0.41 | 0.28 | 7.0 (p95 12) |

Startup (new engine + load bundle): Jint 315 ms, V8 280 ms, Node sidecar 12 ms to spawn (plus the bundle load inside it).

### Inside the Unity 6 Windows player (Mono backend, `HeraklionProbe.exe -selftest`)
`legal` here includes parsing the result with `JsonUtility`, so it is the figure a front end would actually see. `apply` is under 1 ms for V8 (timer resolution 0.0). From `unity-probe/evidence/` and `out/player*.log`.

| Host | Position | legal+parse | apply |
|---|---|---|---|
| Jint | small start (cold JIT) | 167 ms | 3.9 |
| Jint | small after 60 | 45 | 4.7 |
| Jint | large start | 1600 | 17 |
| Jint | large after 200 | 1262 | 8.2 |
| **V8** | small start | 5.6 | 0.5 |
| **V8** | small after 60 | 1.7 | <1 |
| **V8** | large start | 18 (p95 31) | <1 |
| **V8** | large after 200 | 10 (p95 17) | <1 |

Replays in the Unity player: Jint 7-10 s each, V8 145-184 ms each, for 121-131 actions (Node: about 1.4 s under vitest including the invariant checks).

Reading: V8 is within a 16 ms frame in every case measured, but the large-position `legalActions` (about 18 ms cold, 10 ms warm, of which part is the JSON parse) is not free. In a real front end it must run when the player selects or ends a phase, not every frame, and ideally off the main thread. Jint in Unity is 1 to 1.6 s for a large position: not usable for that, tolerable only for a tiny army. A 60-fold gap Jint vs V8 inside Unity (versus 30-fold in .NET) says Unity's Mono compounds the interpreter's cost; IL2CPP may help Jint but was not available to test (no IL2CPP module was installed with this editor).

## Parity check

`playRandomGame(seed, { turnCap: 7, trace, buildInitialState })` with seeds 7, 42, 2026. The reference is the **unbundled** `src/` run under vitest (`parity-reference.probe.ts`). In every host the same JSON, `{ stats, traceLength, trace, state }` (stats, the full action-by-action trace, and the final `GameState` captured through the `buildInitialState` hook, with no change to `src/`), is hashed with SHA-256 and compared.

| Seed | Actions | SHA-256 (first 16) | Jint (.NET) | V8 (.NET) | Node sidecar | Unity player Jint | Unity player V8 |
|---|---|---|---|---|---|---|---|
| 7 | 122 | 05650f598dab5843 | MATCH | MATCH | MATCH | MATCH | MATCH |
| 42 | 121 | a4d88bfbade3a0be | MATCH | MATCH | MATCH | MATCH | MATCH |
| 2026 | 131 | d557fe23258f35fc | MATCH | MATCH | MATCH | MATCH | MATCH |

So the hosted engine is the same engine: same trace, same stats, same final
state, in all five host/runtime combinations. The bundled copy is the same code as the Vite
bundle the game ships (esbuild, ES2020 target, no polyfills needed).

## What the scene shows

`UnityProbe/Assets/Scenes/Probe.unity` (one camera, one `ProbeBoard` object):
- the board drawn from `H.map()` = `MAP_TERRAIN` (every hex of the map, per-terrain colours), flipped so it reads like the Phaser board;
- the harness army as small hexes (red player 0, white player 1);
- click one of the active player's units: the destinations the engine's `legalActions` listed for it turn yellow; click one: `applyLegal(i)` (an `applyAction` of that very action); the state panel and board redraw from `H.state()`;
- an "End phase" button (the engine's `endPhase`), "New game", and a "Run parity self-test" button (the button runs the replays inside the editor/player; Jint-speed warning in editor).

Evidence from the built Windows player, rendered offscreen in batch mode (no window needed): `evidence/shot-1-selected.png` (unit selected, legal moves yellow) and `evidence/shot-2-moved.png` (after one `applyAction` move; state read back). The self-test log line, in the Unity player:
`move p0-cav-l (10, 3) -> (10,2); read back (10,2) movementLeft 5: OK; legal actions at start 189`.

Not done by an agent: interactive mouse play in the editor window (the click path is simple Unity code and was not exercised by a human; the offscreen run drives the same `Refresh` / `ApplyLegal` calls programmatically).

## Findings: seams for a later intent (none were made here)

1. **Entry point and JSON boundary.** The bridge (`engine-entry.ts`, 100 lines) was enough: all state, actions and results are plain JSON (`GameState` has no Maps or Sets; `MAP_TERRAIN` and `RIVER_HEXSIDES` are the only non-JSON values and the bridge flattens them). A real front end needs a small, supported `src/engine` entry (e.g. `src/host/index.ts`) rather than a probe file reaching into modules.
2. **No engine function builds a real starting position.** Armies are placed in `PlacementScene` and `testMode.ts`; the engine only has `buildFuzzGameState` (a fixture in `fuzzHarness.ts`) and `createInitialState` (empty). Army purchase and placement validation exist (`army.ts`, movement checks) but the "deploy these armies on these zones into a `GameState`" step lives in a scene. A Unity front end needs it as engine code.
3. **Pending resolution is outside `applyAction`.** Retreats, pushes, advances, elephant drift and the post-combat bookkeeping are `PlayerAgent` callbacks or inline scene code (`BoardScene` ~3000 lines). `playRandomGame` drives them through `DrivingAgent`, so a host could ask the same questions, but the callbacks are async and take engine types. Interactive combat from Unity needs those turned into JSON "pending question / answer" actions. This is the biggest piece of the next intent, and exactly the part the probe could not exercise (it only plays movement through the bridge's `advance` helper).
4. **`ActionContext`** (`attackedThisPhase`, `rammedThisTurn`) is bookkeeping the caller owns (documented in `actions.ts`). The bridge passes `{}`, so the probe's `legalActions` could re-offer a unit that already attacked. Fine for movement; the real front end must carry these sets (or the engine should).
5. **Combat actions** from `legalActions` are one attacker vs one defender only (documented); combined attacks are built by the caller, as `BoardScene` does.
6. **Determinism.** `applyAction` takes an `rng` argument; the bridge passes a seeded one. `Math.random` is the default, so the front end must always pass its own (and `shuffleSeatOrder` likewise).
7. **State size**: 2 KB (10 units) to 9 KB (54 units) per full state; `legalActions` 2-25 KB of JSON. Round-trip cost is dominated by `legalActions` computation, not by marshalling (`state` is 0.1 ms).
8. **Unity's `JsonUtility`** cannot read a root array or a union of shapes. The probe worked around it (flat object arrays for `map()`, a superset `ActionDto`, wrapping the array, and `applyLegal(i)` so C# never re-serialises an `Action`: re-serialising would have written `facing: 0` into every `navalMove`, which the engine reads as a pinned facing). A real front end should add Newtonsoft (a Unity package) or `System.Text.Json`, and keep an index or opaque-token path for actions.
9. **Documented rules edge, unchanged by the probe:** none discovered; no rule was reinterpreted.

## Native, store and 3D build: what is still open

- **Windows desktop (the owner's first target):** works today with V8 (this probe) and with a Windows standalone build of 142 MB (mostly Unity runtime + V8 + ICU). Steam is reachable as-is.
- **macOS / Linux desktop:** ClearScript V8 has native packages for them (not tested here); the Windows result suggests it carries over.
- **Mobile, consoles, WebGL:** no V8 route. Jint (pure managed) is the portable option but is two orders of magnitude slower than V8 under Mono; whether IL2CPP closes enough of that was not measured. WebGL would use the browser's own JS engine through a jslib bridge to the same bundle (not built).
- **Store builds:** nothing seen blocks them: ClearScript is MIT, Jint BSD-2, V8 BSD-3; all native code is in-process. No assets were used beyond generated hex meshes.
- **3D board:** nothing in the engine route blocks it: the engine only knows axial hex coordinates and returns JSON. The probe draws a flat mesh through `Graphics.DrawMesh`; a 3D look is a view problem, independent of the host. This was not built (as the intent said).

## Recommendation: go, with conditions

Use **ClearScript V8** as the in-process host for Windows desktop. Conditions, in order:

1. **Add the engine seams first** (findings 1-3): a supported engine host entry, an engine-side "deploy armies into a `GameState`" function, and a JSON-shaped "pending resolution" protocol so retreats / pushes / advances / drift can be answered by a front end. This is engine work with tests in `src/`, and the web game benefits (it moves logic out of `BoardScene`). Without it a Unity front end is a movement-only demo.
2. **Never call `legalActions` per frame** and run engine calls off the main thread (V8 contexts are single-threaded, so give the engine one worker thread and a message queue). Budget: about 10-20 ms for a large army.
3. **Accept Windows/macOS/Linux desktop as the scope.** Mobile and WebGL targets are out unless Jint-under-IL2CPP is measured separately or WebGL gets its own JS bridge.
4. **Ship the native V8 binaries per platform** and take the extra ~40 MB of the build; keep the engine bundle version-locked to the front end (the bundle is built from the same commit, parity-checked against `playRandomGame` in CI by the same SHA-256 method used here).
5. **Treat Unity as a second front end beside Phaser**, not a replacement, until it reaches parity: the 9,100 lines of engine tests, the e2e suite and the Phaser UI stay valid; only the view is new.

It is a "go" because the three questions are answered: correct (bit-identical replays everywhere), fast enough (V8: ~1 to 18 ms per call in Unity), and room left (native Windows now, 3D unblocked). It is "with conditions" because Jint, the lightest option, is not fast enough, and because the engine cannot yet run an interactive game end to end without scene code.

## Proposed next intent (the coordinator files it)

**Feature: "Unity front end over the TypeScript engine" (Windows desktop, ClearScript V8).**
Suggested sequence, each its own spec/plan step:
1. *Engine seams (no Unity):* `src/engine` host entry (JSON in/out, seeded rng required), a game-setup function that builds a `GameState` from armies and deployment, and a pending-resolution protocol (retreat, push, advance, elephant drift, ram/board answers) with tests; `BoardScene` migrates to it (shrinks the 3000-line scene).
2. *Unity shell:* project in `unity-probe/`'s successor folder, V8 host on its own thread, Newtonsoft JSON, DTOs generated from engine types, a CI parity check (seeded `playRandomGame` hash vs Node) as a gate.
3. *Playable flat board* (menu, army builder, placement, play, save/load via the engine's `saveGame`), then a 3D board as a view-only change.
Out of scope for that intent: mobile, WebGL, store submission.

## By hand (the owner)

- Open `unity-probe/UnityProbe` in Unity Hub (6000.6.10f1), open `Assets/Scenes/Probe.unity`, press Play. Needs `unity-probe\setup.cmd` run once first (the DLLs and bundle are gitignored). Click a red unit, then a yellow hex. The editor uses V8 by default; the Jint timings need `-jint` and are slow.
- The live check (`REVIEW-POLICY.md`) for this experiment is that run; an agent's offscreen screenshots are only evidence.
- The Node sidecar was not run inside Unity, and IL2CPP was not tried (no module installed).
