# Piloting Anaxi

A two-sprint trial on one or two real features, to find out whether the method helps and whether people apply it
the same way. Nothing here is needed once the pilot is over.

## Setup

- **Pick one or two features** that are about to be designed: ideally one routine, one risky, and at least one
  that uses a shared component.
- **Name a pilot owner**: one engineer who runs the calibration and writes the retro note.
- **Set up the repo** with the [quickstart](QUICKSTART.md). Put `anaxi-ci.sh` in CI so the index stays honest.
- **Take a baseline.** Before starting, note for each feature: how many design review rounds you'd expect, and
  one or two late surprises from similar past work.

## Sprint 1: calibration

**Scoring (15 minutes, in refinement).** Two people score the same five items *independently*, using only the
rubric in [METHOD.md §3](METHOD.md#3-target-depth). Then compare:

| Item | Person A risk | Person B risk | Target A | Target B | Same? | Why they differed |
|---|---|---|---|---|---|---|
| | ·  ·  · | ·  ·  · | | | | |

**Assessing (30 minutes, after the first drafts).** Two people (or a person and the agent) each assess the
same two items: for each applicable question, *answered*, *skipped* or *missing*, quoting the answer.

| Item | Question | A says | B says | Quote | Agree? |
|---|---|---|---|---|---|
| | | | | | |

**What to do with disagreements:**

- Different risk scores: is a factor's wording ambiguous for your domain? Reword its 0/1/2 in your project notes,
  or adjust `rubric.thresholds` in `anaxi.json`.
- Different "answered" verdicts: reword the question in `anaxi-questions.md` (`reword:`), or sharpen how you
  read that level's "done when".
- Agent disagrees with people: reword the question, or add an item question. Note it as N16.

Aim for the same target on 4 of 5 items, and the same verdict on most questions. Don't chase 100 %; the point
is that a disagreement becomes a sentence you can argue with.

## Sprint 2: use it for real

Run the features through refinement, review and the gate as in [METHOD.md §8.1](METHOD.md#81-in-a-normal-sprint).
Keep a short log, one line per event:

| Date | Item | What happened | Nudge involved | Helpful? |
|---|---|---|---|---|
| | | e.g. "stopped at D2, felt right" · "gate blocked: @scheduler not at D3" · "N06 was noise" | | yes / no / meh |

## Retro (30 minutes)

Answer, briefly:

1. **Did the target feel right?** For each feature: too shallow (surprises during build), too deep (wasted
   writing), or about right?
2. **Did "enough" help anyone stop?** Any doc that would have kept growing without it?
3. **Did the gate catch anything?** A missing contract, an open question, a shallow dependency?
4. **Which nudges were noise?** Switch them off or change their severity in `anaxi.json`.
5. **Which questions caused friction?** Reword, `skip-all:`, or add a `when:`.
6. **What did it cost?** Rough minutes per item for scoring and marking, compared with before.
7. **Keep, change, or stop?**

Changes that would help every project go to [QUESTIONS.md §7](QUESTIONS.md#7-proposed-challenged-retired) or the
[CHANGELOG](CHANGELOG.md); the rest go in your own `anaxi.json` and `anaxi-questions.md`.
