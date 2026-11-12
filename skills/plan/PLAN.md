---
plan: "<name>"
items: ["@a", "@b"]
status: active            # active | done | dropped
made: <commit>            # the commit the design was read at (N31 compares against it)
---
# Plan: <what this delivers>

<!-- A build plan (@plan): the work, beside the design. `anaxi-check plan new @a @b` writes most of this from the
     docs; /anaxi:plan fills the tasks. Tick in the same commit as the code. Never restate the design: link to it. -->

**Outcome.** <one sentence: what is true for the user when this plan is done>

## Order

@a → @b + @c → @d

Critical path: @a → @b → @d · parallel lanes: 2

## Slice 0 · Foundation

<what every slice needs first: shared items, @stack changes, migrations, config; or "nothing">

## Slice 1 · @a <Title> · ②

> criteria: #ac-one, #ac-two · files: `src/a/*.ts` · design: ../features/a.md (D3)

- [ ] Write test: <criterion one> (#ac-one)
- [ ] Write test: <criterion two> (#ac-two)
- [ ] Implement <action> `src/a/core.ts`
  - [ ] <subtask, only where the task has real steps>
- [ ] Modify `src/a/routes.ts:40-80`: <what changes>
- [ ] 🛑 gate unit: `npm test -- a`

## Slice 2 · @b <Title> · ③

> files: `src/b/` · design: ../features/b.md (D3)

- [ ] Build against @a's contract (D3), not its internals
- [ ] Spike first, time-boxed: <the unfamiliar part>
- [ ] Write test: <criterion>
- [ ] Implement <action> `src/b/…`
- [ ] 🛑 gate verify: <the behaviour to confirm by hand or by the agent>

## Finish

- [ ] 🛑 gate e2e: <the flow, for real: `npx playwright test <spec>`, or a simulator/device run>
- [ ] 🛑 gate deploy: <staging or a flag; what to watch> (needs `STAGING_URL`)
- [ ] @a: every criterion holds → set built: yes
- [ ] @b: every criterion holds → set built: yes

## Risks

| Item | Factor | Mitigation |
|---|---|---|
| @b | novelty 2 | spike first, time-boxed to a day |

## Deploy

1. <prerequisite>
2. <sequence>
3. Verify: <health check>

## Team

<only when the person gives one: who builds which slice, rough sizes>

## Found on the way

- ↩ design @a: <what changes the design; proposed on the item's own unchecked line>
