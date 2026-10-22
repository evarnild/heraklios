---
name: intent
description: Draft or sharpen a heraklios intent (intents/<id>-<slug>/intent.md + metadata.yml) for a fix, feature, refactor, adjustment or experiment. Use when starting any new piece of heraklios work, turning a bug found while playing or a review finding into work, or backfilling an intent for a plan that came first. Invoke as /intent --fix|--feature|--refactor|--adjust|--exp <what you have>.
metadata:
  owner: evarnild
  version: 0.1.4
  scope: repository
  status: experimental
  review-tier: reviewed
---

# /intent — draft and validate an intent

You are running the refinement interview asynchronously: turn whatever the
user has into an intent good enough to accept. Follow `intents/README.md` →
"Drafting an artefact" for what the drafting skills share; this file adds only
what is the intent's own.

Stamp: `<!-- generated-by: heraklios/intent@0.1.4 -->` as the first line of
`intent.md` and `metadata.yml`.

## 1. Settle the type

From the flag (`--fix`, `--feature`, `--refactor`, `--adjust`, `--exp`) or,
without one, from the material. If it is ambiguous, it is a **feature** —
say so and why. Rules for each type are in `intents/README.md`; read it.

## 2. Gather what already exists

Look, in this order:

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

Use the type's question set from `intents/_templates/intent.md`:

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

If the user says "just draft it", fill gaps with your best reading.

## 4. Write the artefacts

1. **Id:** the next `§` number — one more than the highest `§N` in `plan.md`,
   `plan-history.md` and `intents/`. Slug: short kebab-case.
2. Create `intents/<id>-<slug>/intent.md` from the template, keeping only
   this type's question block.
3. Create `metadata.yml` from `intents/_templates/metadata.yml`: id, slug,
   type, `status: draft`, title, `review_tier` from `REVIEW-POLICY.md`'s path
   table for the files the work will likely touch (raise to `reviewed` for a
   feature implementing a new rulebook rule; otherwise leave it empty so the
   path table decides), links — and for a fix, `follows_up: <id>` naming the
   intent whose change introduced the defect when you can tell (check
   `git log -S` / `git blame` on the faulty line). That key, not `links:`, is
   how the scan counts follow-ups per review tier, so only set it for a real
   cause. **Leave every gate empty.**
4. Add a one-line row under `plan.md` → Current Queue → Queued:
   `| [§<id>](intents/<id>-<slug>/) <title> | <type> · draft |`
   (create the table header `| Item | Type · status |` if the section is
   still prose). This is the only `plan.md` edit you make.
5. If the material came from a GitHub issue, offer to post the sharpened
   problem statement back to it — don't post without a yes.

## 5. Validate against the template

Check the draft for:

- Problem states a problem, not a solution.
- Outcome is checkable by someone else.
- Constraints quote the rulebook where a rule is involved (path + passage).
- Fix: has a reproduction and names the failing-first test.
- Adjustment: blast radius really is small.
- Assumptions are listed, not buried.

Report the folder path and the type and why. The spec (feature) or plan
(fix/refactor) comes next.
Next skill: `/spec <id>` for a feature, `/build-plan <id>` for a fix or refactor.
