<!-- generated-by: heraklios/spec@0.1.0 -->
# §87 spec — npm run queue -- --docs writes the intent documents the Intent Map reads

Accepted intent: [intent.md](intent.md)

Written against `main` at `ac3b868`.

The spec decides **what** gets built. No game rule is involved: this is SDLC
tooling, so the rulebook sources do not apply.

## Sources that apply

| Source | What it settles |
| --- | --- |
| `scripts/queue.mjs` header | "The intent queue (§47), generated on demand from each intent's metadata.yml and git; nothing is written to disk and nobody edits a queue by hand." B2 keeps the second half true and narrows the first (Interpretation I1). |
| `scripts/queue-lib.mjs` `pickSource` | "while that branch exists and is not merged, the branch wins … when `main` holds a terminal status the branch is ignored". The documents follow the same choice (B3). |
| `scripts/queue-lib.mjs` `queueData` | The `--json` entry shape: `id, slug, title, type, status, gates, auto, source, merged, blocked_by, blocked_by_open`. The index reuses it (B5). |
| `scripts/queue.test.mjs` | "End-to-end test for `npm run queue`, against a throwaway git repository in the OS temp dir — never this repository". The command's own tests run the same way (AC2, AC3). |
| The 2026-11-24 scratchpad script (`build-intent-docs.mjs`, quoted in intent.md "Assumptions I made") | The reference behaviour: per-intent JSON, `git show <ref>:intents/<dir>/<name>.md`, CRLF→LF, `U+FFFD` escaped, an index with a build time and `main`'s short hash. |
| `README.md` "Known simplifications" | None. This removes no simplification. |

## Behaviour

- **B1 — The mode.** `npm run queue -- --docs <dir>` writes the document
  bundle into `<dir>`, then prints one line: `<n> intents, <m> documents
  → <dir>`. Without `--docs`, `npm run queue` behaves exactly as today
  (`--json`, `--next-id` and the plain listing are unchanged).
- **B2 — Where it writes.** `<dir>` is required. `--docs` without a
  directory prints a usage line and exits 1, writing nothing. It creates
  `<dir>` if missing and writes only `<dir>/index.json` and
  `<dir>/<id>.json`. It refuses (exit 1, nothing written) a `<dir>` inside
  the repository's `intents/` folder. A `<dir>` elsewhere in the repository
  is allowed; keeping it out of git is the caller's business. It deletes
  nothing: an old `<id>.json` for an intent no longer listed stays, and the
  index decides what is listed.
- **B3 — Which ref each intent's documents come from.** The same choice
  `npm run queue` makes for its status. When `pickSource` picks the branch,
  every document is read from that branch. When it picks `main`, every
  document is read from `main`. It reads committed content only (`git show
  <ref>:intents/<dir>/<name>.md`), never a working tree, so another
  worktree's uncommitted edit is never copied. For a `branch conflict`
  intent (two local branches carry the id), documents come from `main`,
  as its status does.
- **B4 — Which intents and documents.** Every intent `npm run queue` lists:
  every group, shipped included, and the same set `--json` prints. Per
  intent, whichever of `intent.md`, `spec.md`, `plan.md` and `review.md`
  exist at its ref. A missing one is left out, not written as empty.
- **B5 — `<id>.json`.** One JSON object: the intent's `queueData` entry
  (B5's fields as `--json` prints them), plus `group` (`inFlight`,
  `queued`, `shipped`, `stopped` or `other`), `ref` (the branch name or
  `main`), `has` (the names present, in the order intent, spec, plan,
  review) and `docs` (name → text).
- **B6 — `index.json`.** `{ built, main, intents }`: `built` is an ISO
  timestamp, `main` is `main`'s short hash, and `intents` holds every listed
  intent's `<id>.json` without `docs`, ordered by id, highest first.
  `problems` from `queueData` is copied as `problems`.
- **B7 — Text normalisation.** Each document's text has CRLF turned into
  LF. In the written file, every `U+FFFD` character is written as the JSON
  escape `�`, so that parsing the file gives back the text unchanged.
  Nothing else in a document is altered.
- **B8 — Determinism.** Apart from `built`, two runs on an unchanged
  repository write byte-identical files.

## Interpretations

- **I1 — "Nothing is written to disk" (`queue.mjs` header).** That line
  guards the queue's purpose: no hand-kept queue file that can drift. `--docs`
  writes a derived copy only into a directory the caller names, never
  `intents/`, and no later `npm run queue` reads it. So the rule's intent
  holds. The header comment is updated to say so, and this reading is
  recorded there.
- **I2 — Shipped intents read from `main`, not from their merge commit.**
  `pickSource` picks `main` for a terminal status. Documents edited on `main`
  after the merge (a review's post-merge note, a `merged:` bookkeeping
  commit's folder) are the current record, and the map shows the current
  record.

## Acceptance criteria

- **AC1 — B5, B6 and B7 shaping** (test: `scripts/queue-lib.test.mjs`).
  A pure function turns `(entries, docsById, { built, main })` into the
  files' contents. Tests show:
  - `has` follows the order intent, spec, plan, review;
  - a missing document is absent from `docs`;
  - CRLF becomes LF;
  - `U+FFFD` is written as `�` and parses back to `U+FFFD`;
  - the index has no `docs` and is sorted highest id first.
- **AC2 — B3 and B4: ref per intent** (test: `scripts/queue.test.mjs`,
  sandbox repository). The fixture has:
  - one intent with an open branch whose `review.md` exists only there;
  - one intent shipped on `main` whose branch still exists and has a stale
    `plan.md`;
  - one intent on `main` only.

  After `--docs`:
  - the first has `ref` equal to the branch and its `review.md` text;
  - the second has `ref: main` and `main`'s `plan.md`;
  - the third has `ref: main`.
- **AC3 — B1 and B2: argument handling** (test: `scripts/queue.test.mjs`).
  - `--docs` alone exits 1 and creates nothing.
  - `--docs intents/x` exits 1 and creates nothing.
  - `--docs <tmp>` exits 0 and prints the count line.
  - `npm run queue` with no flag prints the same text before and after a
    `--docs` run.
- **AC4 — B3: committed content only** (test: `scripts/queue.test.mjs`).
  An uncommitted edit to a `plan.md` in the sandbox's working tree does not
  appear in the output.
- **AC5 — B8** (test: `scripts/queue.test.mjs`). Two runs into two
  directories give identical files once `built` is removed.
- **AC6 — The real repository** (manual check, by the coordinator at
  review). `npm run queue -- --docs <scratch dir>` on this repository lists
  the same intents as `npm run queue -- --json`. Its `<id>.json` for an
  intent with an open branch carries that branch's committed documents, and
  the output publishes as the Intent Map artifact's `docs/` files without a
  refusal.

## Non-functional

- **Engine/presentation split:** none touched. All of it is in `scripts/`: the
  pure shaping in `queue-lib.mjs`, git and file I/O in `queue.mjs`.
- **Save format:** unchanged.
- **Undo boundaries:** none.
- **AI / harness:** none.
- **Dependencies:** none added.
- **Lint:** no new warning. `queue.mjs` stays under the 500-line and
  80-line-function guardrails.
- **Live check:** none owed by the path rules (`scripts/**` only).

## Out of scope

- The Intent Map artifact itself: its page, its SVG map, its desktop live
  reading, and publishing. A session runs the command and publishes the
  files.
- Generating the map's counters and arrows from the index. The index
  carries `blocked_by` (B6), so a later intent can do it.
- Other files in an intent folder: `metadata.yml`, `konmari.md`,
  `findings.md`, `result.md`.
- Deleting stale files in `<dir>`.

## Assumptions I made

The intent's five open design questions, decided here without a question
round, because the material settles each:

1. **Directory, not stdout** (B1, B2). The reader fetches one intent at a
   time (the published page loads `docs/<id>.json` on click), and a single
   stdout JSON would be about 2.5 MB. I1 records why writing a directory
   keeps the queue's rule.
2. **`<dir>` is required, with no default** (B2). A default inside the
   repository would need a `.gitignore` line and would invite committing the
   bundle. Making it required keeps the command from writing anywhere
   unasked.
3. **The four documents only** (B4). Those are what the owner asked to read
   ("display the intent.md, spec.md, plan.md and review.md of a selected
   intent"). The others are listed out of scope.
4. **Shipped intents from `main`** (I2), following `pickSource`.
5. **The index carries the `queueData` fields now** (B6), blockers and gates
   included. It costs nothing, since it is the same entry `--json` prints,
   and it is what a later map generator needs. The generator itself is out of
   scope.

Also:

- **A correction to intent.md.** Its Outcome says the source rule is
  "tested in `queue-lib.test.mjs` with an injected git". The source *choice*
  (`pickSource`) is already tested there. Reading from the chosen ref is
  tested end to end in `queue.test.mjs`'s sandbox repository (AC2), which is
  how the existing queue I/O is tested.
- **The scratchpad script differed on one point.** It picked a branch
  whenever one existed, even a merged one. B3 follows `pickSource` instead,
  so a merged branch kept on disk no longer wins over `main`.
- **No `blocked_by` found.** Everything it builds on (§47's queue, §71's
  `blocked_by` data) is merged.
