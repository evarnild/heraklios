<!-- generated-by: heraklios/konmari@0.1.0 -->
# §75 KonMari record

outcome: nothing to tidy
base: e5a58ce

## Tidied
- none

## Looked at and left
- `installDevHook` and its four builders (`src/ui/devHook.ts`). Each builder
  has one theme and reads one kind of thing (principle 12), and every member
  is on its own line. No new helper copies an existing one.
- `board`, `mapScene` and `buttons`, which moved to module level. The move
  is mechanical: each takes `game` and nothing else changed. They do not
  duplicate the module's other helpers.
- `board(game)` against `placementSnapshot` and `armyBuilderSnapshot`. All
  three use the same "is the scene active, then get it" lines, with a
  different scene key. Folding them into one `activeScene(game, key)` would
  touch two helpers this diff never changed, and it saves only a line each.
  Left alone; not worth an intent of its own.
- `cameraZoom` sits in `mapReaders` but reads `board(game)`, while its
  neighbours read `mapScene(game)`. That is the behaviour it had on `main`.
  Switching it to `mapScene` would change what it returns on the Placement
  scene, so it stays.
- `viewReaders`' `animationSpeed: () => animationSpeed()` and
  `landscapeBuilds: () => landscapeBuilds()` are wrappers carried over
  unchanged from `main`. A wrapper hides any extra argument a caller passes,
  so passing the function itself is not exactly the same behaviour. Left
  as is.
- `e2e/dev-hook-members.spec.ts` is the characterisation spec. It has one
  case, pins a sorted list and uses the shared `startFromMenu` helper. It
  copies nothing.
- `devHook.ts` is 454 lines (review LOW finding). The coordinator's brief
  says the move to `src/ui/devHookReaders.ts` is a judgement for a later
  intent, so it is not done here.

## Proposed refactor intents
- none. The `devHookReaders.ts` move is already recorded as a follow-up in
  `review.md`. It falls due when the next reader is added.
