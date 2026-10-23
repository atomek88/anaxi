# Shared: Scheduler

## Scheduler
> @scheduler · depth: D2 → D3 · risk: 2·1·1·1 · about: async, integration · uses: [@task-api](task-api.md)
> open: what the planner does with a task whose deadline has already passed

**Why.** Users want tasks in their calendar without picking the times themselves. Success: 80 % of submitted
tasks get a slot within 24 hours. Not a goal: rearranging events the user created.

**What.** Several times a day, per user, the planner reads free time for the next seven days and places pending
tasks into windows long enough to hold them: earliest deadline first, then oldest. A "do now" task goes into
the first free window starting now. Acceptance: a 30-minute task with a deadline tomorrow lands before it, in
working hours.

**Shape.** An hourly sweep job finds users whose local planning time has arrived and queues one planning run
per user. Runs call the Google Calendar API with the user's stored grant. Decision: one run per user at a
time, enforced by a lease. Rejected: a single global run (one slow calendar delays every user).
<!-- D3 not written yet: the run's inputs and outputs, the event tags, and failure handling. -->
