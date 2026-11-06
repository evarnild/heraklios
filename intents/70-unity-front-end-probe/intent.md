<!-- generated-by: heraklios/intent@0.1.5 -->
# §70 — Probe: can a Unity front end drive the existing TypeScript rules engine?

**Type:** experiment
**Originator:** the owner (2026-11-06), asking "would you accept the challenge
to do a Unity version of Heraklios?". Their answers:
- **Why:** "A 3D or richer look", "Native or store builds", and "Learning or a showcase".
- **Rules:** "Keep the TS engine".
- **First step:** "Experiment first".

**Source:** none. `plan-history.md`, `OVERVIEW.md` and the intents have no
earlier Unity, Godot, 3D or native-build work.

## Problem

The owner wants Héraklios with a richer, possibly 3D, look, as native desktop
or store builds, and as a learning project and showcase. Today the game is a
browser app: TypeScript and Phaser 3 on a 2D canvas.

A Unity version runs into the project's hard boundary. The rules are pure
TypeScript, and Unity scripts in C#:
- **`src/engine/` and `src/data/`** hold about 9,800 lines of rule code.
- **About 9,100 lines of unit tests** guard them, along with the seeded
  self-play harness (`fuzzHarness.ts`).
- **Porting to C# would mean two rule implementations to keep in step.** The
  owner chose to keep the TypeScript engine as the one source of rules.

Nobody knows yet whether Unity can host that engine well enough. The open
points are:
- the runtime: an embedded JavaScript engine such as Jint or ClearScript, a
  Node sidecar, or a WebGL build calling into the browser;
- the cost of passing `GameState` across;
- the speed of `legalActions` and `applyAction` from Unity;
- whether the native builds and the 3D look the owner wants are still reachable
  through that route.

Committing to a full Unity feature before answering this would risk a large
build on a wrong foundation.

## Outcome

- **A written result** in `intents/70-unity-front-end-probe/result.md`, with:
  - **The approaches tried.** At least two ways for Unity to run the TS
    engine: compiled to one JS bundle and run in an embedded engine, and one
    alternative. Each has build steps, measured timings and its limits.
  - **A recommendation:** go, go with conditions, or no-go, and which approach.
- **A throwaway Unity scene** that shows:
  - the Héraklios board, drawn from `src/data/map.ts` through the engine;
  - one unit selected, its legal moves shown from `legalActions`, and a move
    applied through `applyAction`;
  - the resulting state read back.

  At least one approach must do this on the Windows desktop target, with the
  rules coming only from the TS engine.
- **A parity check:** one seeded `playRandomGame` replay run through the
  hosted engine ends in the same state as under Node/vitest. That shows the
  hosted engine is the same engine.
- **The next intent:** a feature for a playable Unity front end, or a note
  that the idea is dropped, with the reason recorded in `result.md` and
  `plan-history.md`.

## Constraints

- **The rules stay in TypeScript.** The probe never edits `src/engine/` or
  `src/data/` to suit Unity.
  - If a small seam is needed, for example a bundle entry point or a
    JSON-serialisable state export, it is written down as a finding for a
    later intent. It isn't made here.
  - No rule logic in C#. C# only draws, takes input, and calls the engine.
- **Containment:**
  - the Unity project lives in its own top-level folder, `unity-probe/`, on
    the branch `exp/70-unity-front-end-probe`;
  - Unity's generated folders (`Library/`, `Temp/`, `Logs/`, `obj/`, `Build/`)
    are gitignored;
  - `vite.config.ts`, `vitest.config.ts` and `eslint.config.js` don't pick the
    folder up;
  - the branch is never merged into rule code as-is
    (`intents/README.md`: "never merged into rule code as-is"). Only
    `result.md` and the `plan-history.md` note come back to `main`.
- **No new runtime dependency for the web game.** Unity packages and NuGet
  libraries, such as Jint, stay inside `unity-probe/`.
- **Tooling on this machine:**
  - neither Unity nor the .NET SDK is installed today (checked 2026-11-06), so
    the owner installs Unity Hub and an editor version first;
  - agents drive Unity through its command line (`-batchmode`) and scripts;
  - the owner runs anything that needs the editor's window.
- **Licensing and assets:** use Unity Personal and free or original assets
  only. No asset that imitates the print game's art or another game. Engine
  libraries must have licences compatible with a possible store release (Jint
  is BSD-2, ClearScript is MIT).
- **Memory on this machine is tight.** The probe stays a small scene, and
  Unity runs aren't overlapped with other intents' heavy steps.

## Type-specific questions

### Experiment
- **The question:** can a Unity front end, on the Windows desktop target, run
  the unchanged TypeScript rules engine:
  - **correctly:** a seeded replay matches Node;
  - **fast enough:** a `legalActions` plus `applyAction` round trip well
    under a frame, measured at both ends of a game;
  - **leaving room:** native and store builds, and a 3D board, still open?

  If not, what does each approach cost?
- **Containment:** `unity-probe/` on `exp/70-unity-front-end-probe`, with no
  change to `src/`, the web build or the test suites. Unity output is
  gitignored.
- **What happens to the result:**
  - `result.md` and a `plan-history.md` entry are kept on `main`;
  - the scene is thrown away, or kept on the experiment branch for reference;
  - a "go" becomes a new feature intent, for a Unity front end over the TS
    engine, with its own spec;
  - a "no-go" records why, so the question isn't reopened blind.

## Assumptions I made

- **Type: experiment, not feature.** The owner chose "Experiment first". The
  question is feasibility, and the result is a decision, not shipped behaviour.
- **The first target is Windows desktop.** That is the owner's machine.
  Mobile, WebGL and store builds are named in `result.md` as reachable or not,
  but aren't built here.
- **A flat board is enough.** A 3D look isn't built in the probe. The probe
  only has to show that 3D rendering isn't blocked by the engine approach.
  Showing the look is the next feature's job.
- **The second approach is left to the probe.** One candidate is fixed: the
  engine bundled by Vite or esbuild into a single JS file, run in Jint.
  Candidates for the other are ClearScript (V8), a Node sidecar over IPC, and
  WebGL with a JS bridge.
- **The id is 70.** That is what `npm run queue -- --next-id` gives; §69 is the
  round-cap draft.
- **The probe's measurements aren't made yet.** The line counts above are from
  `main` at `210fa07`: 9,803 lines of non-test code in `src/engine` and
  `src/data`, and 9,089 lines of tests.
