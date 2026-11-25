<!-- generated-by: heraklios/intent@0.1.5 -->
# §87 — `npm run queue -- --docs` writes the intent documents the Intent Map reads

**Type:** feature
**Originator:** the owner, after the Intent Map artifact gained a document reader (2026-11-24 session: "make it an intent: npm run queue -- --docs")
**Source:** none in the repo. The Intent Map is a claude.ai artifact the owner keeps outside the repo.

## Problem

The owner's Intent Map is a page that shows the open intents and their
`blocked_by` links. Since 2026-11-24 it also shows any intent's `intent.md`,
`spec.md`, `plan.md` and `review.md` when you click it. In a browser, the page
reads a copy of those documents that was published with it. That copy is made
by a script written during one Claude session, which lives in that session's
temporary scratchpad and is not in the repo. So:

- a refresh from another session, or after a reboot clears the scratchpad,
  means writing the script again;
- nothing checks that the copy follows the same rules as `npm run queue`.
  Those rules are: which source wins (the intent's branch while it is open,
  else `main`), which intents count, and which ids exist. The copy and the
  queue can disagree, and it would go unnoticed;
- the script's quirks are known only to that session. For example, review
  files that quote a mojibake `U+FFFD` make the artifact publish refuse the
  bundle, so the character has to be written as a JSON escape.

The installed desktop app reads files live and doesn't need the copy.
Everywhere else (browser, phone) only sees the copy, so a stale or
unrepeatable copy is a stale map.

## Outcome

- `npm run queue -- --docs <dir>` writes `<dir>/<id>.json` for every intent
  `npm run queue` lists, holding the intent's id, title, type, status, group
  and auto line, the git ref each document was read from, and the text of
  whichever of `intent.md`, `spec.md`, `plan.md` and `review.md` exist. It also
  writes `<dir>/index.json` listing the same intents without the texts. Its
  output for the in-flight intents of the 2026-11-24 copy carries the same
  texts as that copy.
- An intent's documents come from the source `npm run queue` already uses for
  its status (`queue-lib.mjs`'s `pickSource`): the intent's branch while it
  exists and is not merged, else `main`. This is tested in `queue-lib.test.mjs`
  with an injected git, like the existing queue tests.
- The written files can be published as they are: no raw `U+FFFD` (it is
  written as the JSON escape `�`, so the text reads unchanged once
  parsed), LF line endings, and nothing outside `intents/<id>-*/`.

## Constraints

- `scripts/queue.mjs` says "nothing is written to disk and nobody edits a
  queue by hand" (its header comment). `--docs` writes files, but only into
  the directory it is given and only on request. It never writes inside
  `intents/` or anywhere a later `npm run queue` reads. The header comment
  says so.
- The pure half goes in `queue-lib.mjs` with tests, and the I/O stays in
  `queue.mjs`, as today (`CLAUDE.md`: "the pure half is queue-lib.mjs").
- No new dependency. The tooling stays plain `.mjs` (principle 14 in
  `docs/architecture.md`, pass 8).
- The artifact itself (its page, its SVG map, its desktop live reading) is
  outside the repo and outside this intent. The command only produces files
  that a session publishes next to the page.
- It must not touch `saves/`, worktrees' working files, or any uncommitted
  file. Documents are read from git refs, not the working tree, so another
  worktree's half-written review is never copied.

## Type-specific questions

### Feature
- **Users:** the owner, who reads the Intent Map in a browser or on the
  phone, and the Claude session that refreshes it, which runs the command
  and publishes the files.
- **Rulebook basis:** digital-only. This is SDLC tooling, with no game rule.
- **Known simplification it removes:** none.
- **Open design questions:**
  1. Output: a directory argument (as above), or one JSON on stdout like
     `--json`? A directory lets the reader fetch one intent at a time, and
     the page is built that way. Stdout keeps "writes nothing" true.
  2. Does `<dir>` need a default (for example a gitignored `.intent-docs/`),
     or is it required?
  3. Which documents: only the four the reader shows, or also `metadata.yml`,
     `konmari.md` and the odd ones (`findings.md`, `result.md`)?
  4. Shipped intents: read from `main` (their branch is merged or deleted),
     or from the merge commit named by `merged:`?
  5. Should it also print `--json` queue data into `index.json` (blockers,
     gates), so the map's counters and arrows could later be generated from
     it too? That would be a separate intent if the answer is "later".

## Assumptions I made

- **A feature, not an adjustment.** It adds a mode to a script, with tests,
  and the pure-lib-plus-I/O split likely touches more than 60 lines in 3 or
  more files.
- **Review tier:** left empty. `scripts/**` is Attested in the path table, and
  no rule code is touched.
- **No live check owed** by the path rules. Whether the published map reads
  the bundle is the artifact's concern, outside the repo. The owner may still
  want to look at the map after the first refresh.
- **The scratchpad script is the reference behaviour.** Its rules were:
  branch named `<type>/<id>-…` else `main`, `git show <ref>:intents/<dir>/<name>.md`,
  CRLF to LF, `U+FFFD` escaped, index sorted by id descending, a `built`
  timestamp, and `main`'s short hash. The spec may change any of them.
- **No `blocked_by`.** It builds on `npm run queue` as merged today. `links`
  names §47 (the generated queue) and §71 (blocked_by, which the map draws).
