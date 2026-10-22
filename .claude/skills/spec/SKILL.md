---
name: spec
description: Draft or revise the spec (intents/<id>-<slug>/spec.md) for an accepted heraklios feature intent, stamped as made by this skill. Use after intent_accepted is recorded on a feature, or when a review sends its spec back. Invoke as /spec <id>.
metadata:
  owner: evarnild
  version: 0.1.0
  scope: repository
  status: experimental
  review-tier: reviewed
---

# /spec — draft and validate a feature's spec

Follow `intents/README.md` → "Drafting an artefact" for everything the three
drafting skills share. This file adds only what is the spec's own.

Stamp: `<!-- generated-by: heraklios/spec@0.1.0 -->` as the first line of
`spec.md`.

## 1. Check the preconditions, and stop if one fails

Read `intents/<id>-*/metadata.yml`. Stop and say which is missing if:

- `type` is not `feature` (a fix or refactor has no spec; use `/build-plan`;
  an adjustment or experiment has neither);
- `intent_accepted` is not recorded.

## 2. Read first

- the intent: Outcome, Constraints, open design questions, the owner's
  decisions;
- `intents/_templates/spec.md`;
- the `docs/research/` passages for any rule involved: the transcription,
  and the French original where the transcription may be damaged (start at
  `docs/research/README.md`);
- `README.md` "Known simplifications", and `plan-history.md` for the topic;
- the code the behaviour touches, on current `main`.

## 3. Questions

Ask only about the intent's open design questions that the intent and these
sources leave open. Otherwise decide, and list the decision under
Assumptions.

## 4. Write `spec.md` from the template

- a "Written against `main` at `<hash>`" line;
- Sources that apply;
- Behaviour as numbered observable rules, **B1, B2, ...**;
- Interpretations: every ambiguous passage and the reading chosen, each to
  become a code comment at its implementation site;
- Acceptance criteria **AC1, AC2, ...**, each naming the test, scenario or
  manual check that proves it;
- Non-functional: engine/presentation split, save format, undo boundaries,
  AI/harness;
- Out of scope;
- Assumptions I made.

## 5. Validate

- every open design question of the intent is answered in a B or an
  Assumption;
- every AC names its proof;
- every claim about code was re-read at the recorded commit;
- every rule quote is at the source's wording.

## 6. Report

Name the folder, the weak points, and the next step: "accept by setting
`spec_accepted: <date>` in metadata.yml, or say yes".
