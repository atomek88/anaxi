---
anaxi: "@your-id"           # needed only if other docs reference this one
depth: D0                    # current depth; the target comes from risk. Write D2 🎯 once it reaches it
risk: 0·0·0·0                # blast·reversibility·novelty·certainty, 0–2 each; the total sets the target
about: []                    # topics, e.g. [api, data]; used by project questions with `when:`
uses: []                     # shared items this depends on, e.g. ["@stack", "@task-api"]
focus: now                   # now | next | later
caveats:                     # limits accepted at this depth
later:                       # deferred work, and what triggers it
---
# Title

<!-- Headings below map to levels automatically (FORMAT.md §4). Rename them freely; add a `D2` badge to a
     heading if a renamed section should still count as that level. Delete sections you don't need yet:
     depth comes from what is answered, not from which headings exist. -->

## Context and goals
<!-- D0: the problem in the users' words, who has it, how we'll know it worked. -->

## Non-goals
<!-- D0: what we are deliberately not solving. -->

## Requirements
<!-- D1: main flow, scope in and out, acceptance criteria, edge behavior, what this touches. -->

## Proposed design
<!-- D2: parts and their jobs, how data moves, stack (only what's new vs @stack), the risky part. -->

## Alternatives considered
<!-- D2: each decision with what it beat, and why. -->

## API
<!-- D3: operations, inputs and outputs, errors, and what callers do about them. -->

## Data model
<!-- D3: what is stored or exchanged, its shape, and what must stay compatible. -->

## Failure modes
<!-- D3: what happens when a dependency is slow, down or wrong. -->

## Implementation plan
<!-- D4: ordered steps, files touched, exact dependencies, illustrative code for the tricky parts. -->

## Testing
<!-- D4: the tests to write, including the edge and error cases above. -->

## Rollout
<!-- D4: flags, stages, backfill, how to roll back. -->

## Open questions
- [ ] D1 · …

## Appendix: sketches
<!-- Canvas: diagrams, mockups, ideas, anything unbound. Not committed; doesn't count toward depth. -->
