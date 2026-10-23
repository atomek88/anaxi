# Anaxi nudges

A **nudge** is a short message telling an author, reviewer or agent what to do next with an item. Nudges are
the point of the method: they are the "obvious moments" where a plan says explain more, stop, wait, or come
back later.

Every nudge has a stable code so the script, the skill and profiles can refer to it.

## 1. How to read this

| Column | Meaning |
|---|---|
| **Detected by** | `script`: from tags alone, no judgment needed · `agent`: needs reading the content · `both` |
| **Severity** | `block`: the item must not be implemented · `warn`: act before review · `info`: good to know |
| **Action** | what the person or agent should do |

Profiles can switch nudges off or change their severity ([PROFILES.md](PROFILES.md)), except N09 (gate).

**The canvas** ([FORMAT.md §6](FORMAT.md#6-canvas-unbound-space)) is exempt from every nudge except N17. Exploring is
never over-documented, over-engineered or out of focus.

## 2. Catalogue

### Depth: is it deep enough?

| Code | Name | Trigger | Detected by | Severity | Message | Action |
|---|---|---|---|---|---|---|
| **N01** | go-deeper | current depth < effective target ([METHOD §3.1](METHOD.md#31-effective-target-what-is-needed-now)) | both | warn | "**Recurring tasks** is at D2, target D3 (risk 2·2·1·0: one-way data change). Missing at D3: D3.contracts, D3.failure, plus its own checklist question on DST." | answer the missing questions of the *next* level only |
| **N02** | blocked-by-shared | a `uses: @x` item hasn't reached its own full target, or the depth asked for in `uses: @x (Dn)` ([METHOD §5](METHOD.md#5-shared-items)) | script | block (info when this item is `focus: later`) | "**Recurring tasks** uses @scheduler, which is at D2 of its target D3. Owner: scheduling team." | wait, or help deepen the shared item. The shared item also gets "2 items wait on you" |
| **N03** | open-question | `open:` has entries, or the item's question checklist has unchecked boxes at or below its effective target | script | warn | "**Recurring tasks** has 1 open question: DST handling for recurrences. It blocks *enough*." | answer it, or move it to `later:` with a trigger and a caveat |
| **N04** | enough | depth = effective target, nothing open, all `uses` deep enough. When the effective target is capped, the message says so ("enough for now; full target D3") | script | info | "**Task API** D3 🎯 — documented and planned enough. Caveats: no batch submit. Later: v2 batch, when @bulk-import reaches D1." | stop writing; move on |
| **N05** | claim-unsupported | the tag claims a level whose required questions aren't answered in the text, or whose "done when" plainly doesn't hold ([QUESTIONS.md §3](QUESTIONS.md#3-the-levels-aim-bounds-done)) | both (the script catches only empty D0 sections) | warn | "**Task API** claims D3, but D3.failure isn't answered (no error responses listed)." | answer it, skip it with a reason, or lower the claim |

### Focus: is this the right work?

| Code | Name | Trigger | Detected by | Severity | Message | Action |
|---|---|---|---|---|---|---|
| **N06** | over-documented | current depth > effective target. Covers both too much depth for the risk, and depth on items the plan doesn't need yet (`focus: next/later`, or the project stage) | script | warn | "**Settings screen** is at D4 with risk 0·0·1·0 (target D1)." / "**Multi-calendar** is at D3, but `focus: later` caps it at D1 for now." | stop. For a risk mismatch, re-score. For a focus cap, keep D0–D1 and park the rest until the item is `focus: now` |
| **N07** | over-engineered | the content solves problems nobody asked for (signals in §3) | agent | warn | "**Recurring tasks** D2 designs a pluggable recurrence-rule engine; D1.behavior covers weekly and monthly only." | cut back to the scope, or put the extra in `later:` with a trigger |
| **N08** | out-of-focus | the content details something listed in this item's `later:`, its out-of-scope list, a D0 non-goal, or another item's territory. (Depth on items not in the plan is N06.) | agent | warn | "**Recurring tasks** D3 specifies custom RRULEs, which are in its `later:`." | move it to `later:` or to the item it belongs to |

### Readiness and change

| Code | Name | Trigger | Detected by | Severity | Message | Action |
|---|---|---|---|---|---|---|
| **N09** | gate | someone or something is about to implement an item. Uses the full target, never the capped one | both | block until clear | "**Recurring tasks** is not ready: D2 → D3, 1 open, blocked by @scheduler." / "**Task API** ready: D3 🎯, all uses deep enough." | implement only when ready. Agents deepen the item or ask; they don't guess |
| **N10** | revisit | a `later:` trigger that names an item and depth is now met | script | info | "@bulk-import reached D1: the batch part of **Task API** (`later:`) is due." | re-score the item; deepen if the target went up |
| **N11** | recheck-shared | a shared item's content changed after an item that uses it was marked enough (from git history) | script | info | "@scheduler changed on 2026-10-12, after **Recurring tasks** was marked D3 🎯. Recheck what you rely on." | read the change; keep it at enough, or lower its depth |
| **N12** | rescore | open questions were answered or the scope changed, and the risk scores weren't updated | agent | info | "**Recurring tasks**: certainty was scored 2 (guessed), but the DST question is now answered. Re-score; the target may drop to D2." | re-score and update the target |

### Hygiene

| Code | Name | Trigger | Detected by | Severity | Message | Action |
|---|---|---|---|---|---|---|
| **N13** | untagged | a heading in a doc the profile covers has design content but no tag | script | info | "**Offline sync** has no tag. Add one: D0 answers, risk, target." | tag it |
| **N14** | no-target | the target can't be known: no `risk:`, no `target:`, and the depth has no `→` or `enough` | script | warn | "**Search** has no target. Score its risk." | score it |
| **N15** | dangling | `uses:`, `part-of:` or a `later:` trigger names an `@id` that doesn't exist | script | warn | "**Recurring tasks** uses @calendar-sync, which doesn't exist." | fix the reference, or create the shared item at D0 |
| **N16** | question-friction | the same question is skipped with the same reason on several items, or an agent couldn't interpret it | agent | info | "D3.app-versions skipped on 4 items as 'not called by the app'. Add `when: api` to it in anaxi-questions.md." | change `anaxi-questions.md`; for a core question, add a Challenged row ([QUESTIONS.md §6](QUESTIONS.md#6-a-living-set)) |
| **N17** | canvas-promote | a decision, answer or contract lives only in the canvas, while the item's levels (or another item) rely on it | agent | info | "**Recurring tasks** Proposed design relies on the 'materialize a week ahead' idea, which is only in the Sketch section." | move it into the level it belongs to; keep the sketch if it helps |

## 3. Over-engineered and out of focus: what to look for

N07 and N08 need judgment, so here is what the agent (and reviewers) look for. **Each signal is a reason to
ask, not proof.** Report the signal and the item text that triggered it.

**Over-engineered (N07)**

- Generality nobody asked for: plugin systems, strategy registries, configurable everything, "in case we
  need" abstraction layers, when D1.behavior names one or two cases.
- Scale beyond what D0.why or the stated quality needs support: sharding, multi-region or caching designed for 100× the
  stated load.
- More options than decisions: the doc compares five approaches where one decision with one rejected
  alternative would do.
- New technology where the item scored novelty 0, or a second way of doing something the project already does.
- Contract detail (D3) for an interface with exactly one consumer in the same module.
- Depth that exceeds the item's effective target is N06, not N07. N07 is about *breadth* of design at the right depth.

**Out of focus (N08)**

- Detail about anything listed in the item's own `later:`, `caveats:` or D1 out-of-scope list.
- Content that answers another item's questions: designing @scheduler internals inside Recurring tasks,
  instead of `uses: @scheduler` and a nudge to its owner.
- Work toward a D0.non-goal.

**What a good response looks like.** Don't delete the work. Move it: to `later:` with a trigger, to the
item it belongs to, or to a short "ideas" note. Keep the item at its target.

## 4. Order of nudges

When an item has several nudges, report them in this order, so the most useful action comes first:

1. N09 gate (when implementing)
2. N02 blocked-by-shared, N15 dangling
3. N03 open-question, N05 claim-unsupported
4. N01 go-deeper
5. N08 out-of-focus, N07 over-engineered, N06 over-documented
6. N14 no-target, N12 rescore
7. N10 revisit, N11 recheck-shared, N13 untagged, N16 question-friction, N17 canvas-promote
8. N04 enough (only when nothing above applies)

## 5. Adding a nudge

Same process as questions ([QUESTIONS.md §6](QUESTIONS.md#6-a-living-set)): propose it with the
trigger, who can detect it, the message and the action, and the failure it prevents. A new nudge takes the
next free code. Codes are never reused.
