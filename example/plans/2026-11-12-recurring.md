---
plan: "recurring"
items: ["@task-api", "@scheduler", "@recurring"]
status: active
made: fa5f2ec
---
# Plan: Task API, Scheduler, Recurring tasks

**Outcome.** A user sets a chore to repeat weekly or monthly once, and it shows up in their calendar on time without being re-entered.

## Order

@task-api → @scheduler → @recurring

Critical path: @task-api → @scheduler → @recurring

## Slice 0 · Foundation

Shared items the others need, first. Nothing new in @stack.

## Slice 0.1 · @task-api Task API · ③

> design: ../shared/task-api.md (D3)

- [x] Contain the blast radius: a flag or a staged rollout, and a way to turn it off
- [x] Make it reversible: a down migration or a kill switch, written before the change
- [x] Write test: a task submitted offline and retried ten times shows up exactly once; a withdrawn task never reaches the calendar, or leaves it
- [x] Implement `submissionId` dedupe on `POST /tasks` (`src/api/tasks.ts`)
  - [x] Store the id with a unique index (`db/migrations/0007_submission_id.sql`)
  - [x] Return the existing task on a repeat, not a `409`
- [ ] Implement `DELETE /tasks/:id` withdrawal for queued and placed tasks
- [ ] 🛑 gate unit: `npm test -- task-api` passes, including the ten-retries case

## Slice 0.2 · @scheduler Scheduler · ③

> design: ../shared/scheduler.md (D2)

⏳ not ready: D2 → D3 · 1 open

- [ ] Contain the blast radius: a flag or a staged rollout, and a way to turn it off
- [ ] Build against @task-api's contract (D3), not its internals
- [ ] Write test: a 30-minute task with a deadline tomorrow lands before it, in working hours
- [ ] Implement: <break this down from @scheduler's contract and build notes>
- [ ] 🛑 gate: <how to verify @scheduler's criteria>

## Slice 1 · @recurring Recurring tasks · ③

> files: `example/src/recurring`, `example/ios/Recurring` · design: ../features/recurring-tasks.md (D2)

⏳ not ready: D2 → D3 · 2 open · @scheduler at D2 of D3

- [ ] Contain the blast radius: a flag or a staged rollout, and a way to turn it off
- [ ] Build against @task-api's contract (D3), not its internals
- [ ] Build against @scheduler's contract (D3), not its internals
- [ ] Write test: a weekly series created on Monday has its next occurrence placed in the calendar within a day, and each later one a week ahead of its date; deleting "all future" removes the placed and queued ones and nothing else
- [ ] Write test: Edge cases: a monthly task on the 31st falls on the last day of shorter months; a missed occurrence doesn't block the next one; a series created offline syncs like any task
- [ ] Write test: While saving, the sheet shows "repeats every Monday", not a list of dates
- [ ] Implement: <break this down from @recurring's contract and build notes>
- [ ] 🛑 gate: <how to verify @recurring's criteria>

## Finish

- [ ] 🛑 gate e2e: on a simulator, create "water plants" weekly, advance the clock 8 days, see two occurrences; delete all future, see none (`npx detox test e2e/recurring`)
- [ ] 🛑 gate deploy: staging for a day with the flag on for the team; no duplicate occurrences in the logs
- [ ] @task-api: every criterion holds → set built: yes
- [ ] @scheduler: every criterion holds → set built: yes
- [ ] @recurring: every criterion holds → set built: yes

## Found on the way

- ↩ design @recurring: a weekly rule needs the owner's timezone, or "Monday" drifts for travellers (proposed on the item)
