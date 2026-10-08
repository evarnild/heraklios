---
name: intent
description: Draft or sharpen a heraklios intent (intents/<id>-<slug>/intent.md + metadata.yml) for a fix, feature, refactor, adjustment or experiment. Use when starting any new piece of heraklios work, turning a bug found while playing or a review finding into work, or backfilling an intent for a plan that came first. Invoke as /intent --fix|--feature|--refactor|--adjust|--exp <what you have>.
metadata:
  owner: evarnild
  version: 0.1.1
  scope: repository
  status: experimental
  review-tier: reviewed
---

# /intent — draft and validate an intent

You are running the refinement interview asynchronously: turn whatever the
user has into an intent good enough to accept, asking **only** the questions
the material does not already answer. The user accepts; you never record a
gate yourself.

Stamp: `<!-- generated-by: heraklios/intent@0.1.1 -->` as the first line of
every file you write.

## 1. Settle the type

From the flag (`--fix`, `--feature`, `--refactor`, `--adjust`, `--exp`) or,
without one, from the material. If it is ambiguous, it is a **feature** —
say so and why. Rules for each type are in `intents/README.md`; read it.

## 2. Gather what already exists — before asking anything

Look, in this order, and quote what you use:

- the user's message and anything pasted or linked (GitHub issue via `gh`, a
  `review.md` finding, a `plan-history.md` follow-up such as §19.5);
- `plan.md` — Current Snapshot, Backlog Map, "Owed" items — for an existing
  entry describing this work;
- `plan-history.md` for prior attempts or related decisions (grep the topic);
- `README.md` "Known simplifications" — features often remove one;
- `docs/research/` for the rule that binds it (start at `docs/research/README.md`);
- for a fix: the code path, so the reproduction and the test-that-will-fail
  are concrete, not guessed.

## 3. Ask only the missing questions, by type

Ask at most one round, batched. Use the type's question set from
`intents/_templates/intent.md`:

- **fix** — what broke, since when, impact (does it corrupt a game or a
  save?), reproduction, which test will fail first.
- **feature** — outcome, users (hotseat / AI seat / map-editor author),
  rulebook basis or "digital-only", the known simplification it removes, open
  design questions for the spec.
- **refactor** — what is restructured, how behaviour is held constant, what it
  unblocks.
- **adjustment** — exactly what changes; confirm it stays ≤5 files, ≤60
  lines, no rule code — otherwise propose fix or feature instead.
- **experiment** — the question, the containment, what happens to the result.

Skip any question the material already answered. If the user says "just
draft it", fill gaps with your best reading and list each one under
**Assumptions I made**.

## 4. Write the artefacts

1. **Id:** the next `§` number — one more than the highest `§N` in `plan.md`,
   `plan-history.md` and `intents/`. Slug: short kebab-case.
2. Create `intents/<id>-<slug>/intent.md` from the template, keeping only
   this type's question block.
3. Create `metadata.yml` from `intents/_templates/metadata.yml`: id, slug,
   type, `status: draft`, title, `review_tier` from `REVIEW-POLICY.md`'s path
   table for the files the work will likely touch (raise to `reviewed` for a
   feature implementing a new rulebook rule; otherwise leave it empty so the
   path table decides), links — for a fix, link the folder of the intent that
   introduced the defect when you can tell (`intents/<id>-<slug>`); that link
   is how the scan counts follow-ups per review tier. **Leave every gate empty.**
4. Add a one-line row under `plan.md` → Current Queue → Queued:
   `| [§<id>](intents/<id>-<slug>/) <title> | <type> · draft |`
   (create the table header `| Item | Type · status |` if the section is
   still prose). This is the only `plan.md` edit you make.
5. If the material came from a GitHub issue, offer to post the sharpened
   problem statement back to it — don't post without a yes.

## 5. Validate against the template and report

Check the draft and tell the user plainly what is still weak:

- Problem states a problem, not a solution.
- Outcome is checkable by someone else.
- Constraints quote the rulebook where a rule is involved (path + passage).
- Fix: has a reproduction and names the failing-first test.
- Adjustment: blast radius really is small.
- Assumptions are listed, not buried.

End with: the folder path, the type and why, open assumptions, and the next
step — "accept by setting `intent_accepted: <date>` in metadata.yml", then the
spec (feature) or plan (fix/refactor) comes next.
