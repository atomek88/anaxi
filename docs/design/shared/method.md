---
anaxi: "@method"
depth: D3
risk: 2·2·1·1
target: D3 (a method has no build step; its contract is its text)
about: [method]
---
# The method

**Why.** Design docs fail in two directions: too shallow, so building stalls on a contract nobody wrote, or too
deep, so time goes into designing what isn't needed yet. Teams have no shared word for "deep enough", so review
turns into taste. It worked when an item's depth and the depth it needs can be read off its marks, and a
reviewer and an agent agree on whether it is ready to build.

**What.** A ladder of five levels, each a set of questions: D0 Why, D1 What, D2 Shape, D3 Contract, D4 Build.
Levels are cumulative: an item is at the deepest level with every level before it answered. A risk rubric
(blast radius, reversibility, novelty, certainty, 0–2 each) suggests a target; focus and stage cap it to what is
needed now; the gate uses the full target. Shared items, "enough", caveats, `later:` with a trigger, and
superseding complete it. Out of scope: tracking whether work is done, estimates, a required doc template. All of
it is defaults: a project changes the ladder, the rubric and the questions in `anaxi.json`.

**Shape.** Depth is answered questions, not sections written: the marks are a claim and the content is the
evidence. Chosen over a template per level, which teams would not adopt over their own TDD layout. The rubric
suggests and never decides (`target:` overrides with a reason), because a score people fight is worse than
none. The riskiest part is the rubric's thresholds, which come from judgement, not data; pilots calibrate them.
Roles change the shape: a shared item that others build on is judged by its contracts first.

- [ ] D2 · Should an item's role (feature, shared, foundation) change which questions apply to it? (ROADMAP §7)
