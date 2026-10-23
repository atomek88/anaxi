# TaskFlow — scheduling

Parent in [00-spine.md](00-spine.md): [[TF.scheduling]]. The branch needs `contract`: the placement contract is precise enough to build from, so no build
leaf is written ahead of the code.

## TF.scheduler · Hourly sweep, per-user planner, Google Calendar API
> up: TF.scheduling · state: settled · links: uses→TF.calendar-access, writes→TF.outcomes, informs→TF.notifications

Planning follows the sweep pattern of [[TF.aws-runtime]]. One EventBridge Scheduler schedule `plan-sweep`
runs at minute 0 of every hour and invokes `planSweep`. Each user profile carries `nextPlanAt` (the next of
06:00, 12:00 and 17:00 in the user's time zone) and the sparse index key `GSI1PK = PLANDUE#<UTC hour>`. The
sweep queries the current hour's bucket and sends one `{trigger: "sweep", userId}` message per user to the
standard SQS queue `plan-requests`. The `plan` Lambda consumes that queue with a concurrency limit of 20, which
keeps the Google Calendar API well inside per-project quotas. "Do now" bypasses the sweep: the normalizer
invokes `plan` asynchronously for one task ([[TF.submission-envelope]]).

Calendar access uses Google Calendar API v3 over REST with the user's grant from
[[TF.calendar-access]]: `freebusy.query` for availability, and `events.list`, `events.insert`,
`events.patch` restricted to events tagged with the private extended property `tfApp = 1`. Only the primary
calendar receives events; free/busy reads the primary calendar plus any calendars the user ticked during
setup.

Time zones are resolved only in two places: `nextPlanAt` is computed from local wall-clock times in the
user's IANA zone, so daylight-saving shifts move the UTC hour bucket rather than the user's 06:00, and every
event is written with an explicit `timeZone`, so the calendar renders it correctly when the user travels.
Planning in UTC everywhere else keeps comparisons with free/busy results, which Google returns in UTC, exact.

Two runs for one user must never place tasks at the same time. `plan` takes a per-user lease (conditional
put on `SK = LOCK#plan` with a 60-second expiry) before reading anything; a run that cannot get the lease
fails, and its trigger retries.

After a run, `plan` writes one outcome record per new placement ([[TF.outcomes]]) and asks
[[TF.notifications]] to push "Placed" messages for do-now tasks and "Couldn't fit" messages for tasks that
missed their deadline window.

#### D-TF-07 · One hourly sweep instead of per-user schedules
One schedule and one index cover every user and time zone; changing a user's preferences rewrites one
attribute.
Rejected: three EventBridge Scheduler schedules per user (created and rewritten on every time-zone or
preference change, and a per-account schedule quota to watch); one daily batch (same-day submissions
would wait until tomorrow).

## TF.placement · Planning run: inputs, algorithm, writes, failures
> up: TF.scheduler · kind: contract · state: settled · decided-by: D-TF-02, D-TF-07 · links: writes→TF.outcomes, informs→TF.notifications, uses→TF.keyspaces

### Inputs
| Trigger | Source | Payload | Scope |
|---|---|---|---|
| sweep | `plan-requests` queue | `{trigger: "sweep", userId}` | all pending tasks, horizon 7 days |
| doNow | async invoke from `normalize` | `{trigger: "doNow", userId, taskId}` | that task only, horizon now → now + 2 h, ignores the daily cap |

Preferences (profile item `SK = PROFILE`):

| Field | Default | Meaning |
|---|---|---|
| `timeZone` | device zone at sign-up | IANA name, e.g. `America/Chicago` |
| `workingHours` | Mon–Fri 09:00–18:00 | per weekday, list of `[start, end]` local times |
| `maxTasksPerDay` | 4 | TaskFlow events per local day, counting ones already placed |
| `bufferMinutes` | 10 | free gap kept before and after every busy block |
| `busyCalendarIds` | `["primary"]` | calendars read for free/busy |

### Algorithm
0. **Dedupe.** `claimOnce(dedupe:v1:plan:<userId>:<nextPlanAt>, 2 h)` ([[TF.keyspaces]]). Already claimed →
   acknowledge and stop; the sweep's message was a redelivery. Store unavailable → continue.
1. **Lease.** Conditional put `LOCK#plan` with `expiresAt = now + 60 s`. If it is held, throw; the queue
   (sweep) or Lambda's async retry (do-now) tries again.
2. **Grant.** Get an access token through [[TF.token-cache]], refreshing it only on a cache miss. `invalid_grant` → mark the grant `revoked`, send a reconnect nudge,
   release the lease, stop. Do not retry.
3. **Reconcile.** `events.list` on the primary calendar for the horizon with
   `privateExtendedProperty=tfApp=1`. For each task with `status: placed` in the horizon: no matching event →
   the user deleted it, so the task goes back to `pending` and its outcome becomes `rescheduled`; event at a
   new time → update the task's slot and the outcome's `dueCheckAt`. The calendar wins.
4. **Availability.** `freebusy.query` over `busyCalendarIds` for the horizon. Free windows = working hours
   minus busy blocks widened by `bufferMinutes`, starting no earlier than now + 15 min.
5. **Order.** Pending tasks by deadline (none last), then `createdAt`. Do-now: only the given task.
6. **Place (first fit).** For each task, the earliest window that is at least `durationMinutes` long, on a
   day under `maxTasksPerDay`, and ending before the deadline if there is one. Split the window and continue.
   No fit before the deadline → leave pending and add a "couldn't fit" notice. No fit for do-now within two
   hours → leave pending and notify; the next sweep picks it up.
7. **Write.** For each placement, in order: look for an existing event with
   `privateExtendedProperty=tfTaskId=<taskId>` (a crashed earlier run may have inserted it); otherwise
   `events.insert` with summary = title, description "Added by TaskFlow · taskflow://task/<taskId>", start
   and end in `timeZone`, private extended properties `tfApp = 1` and `tfTaskId`, and a popup reminder 5
   minutes before. Then update the task (`status: placed`, `slotStart`, `slotEnd`, `eventId`) and put the
   outcome record (`status: pending`, `dueCheckAt = slotEnd + 12 h`, `GSI1PK = CHECKDUE#<hour>`).
8. **Finish.** Set `nextPlanAt` and its `PLANDUE#` key, send the collected notices to the `notify-requests`
   queue, release the lease, emit `TaskPlaced` per placement.

### Worked run
User in `America/Chicago`, defaults above, sweep at 12:00 local on Wednesday 2026-10-07.

| Input | Value |
|---|---|
| Busy (primary) | Wed 13:00–14:00, 15:30–16:00; Thu 09:00–12:00 |
| Already placed Wed | 1 TaskFlow event (counts toward the cap of 4) |
| Pending | A "dentist forms", 30 min, deadline Fri 23:59 · B "plan birthday", 60 min, no deadline, `needsReview` · C "call the bank", 15 min, no deadline, older than B |

Free windows Wednesday, after widening busy blocks by 10 minutes and starting at 12:15: 12:15–12:50,
14:10–15:20, 16:10–18:00. Order: A (deadline), then C (older), then B.

| Task | Placement | Why |
|---|---|---|
| A | Wed 12:15–12:45 | first window ≥ 30 min, ends before Friday |
| C | Wed 14:10–14:25 | 12:45–12:50 is too short |
| B | Wed 14:25–15:20 is 55 min, too short → Wed 16:10–17:10 | fourth TaskFlow event Wednesday, cap reached |

`needsReview` does not hold B back; the event title carries no marker, and the review card in the app lets
the user fix the title, which patches the event on the next run.

### Failure semantics
| Failure | Behavior |
|---|---|
| Google 429 or 403 `rateLimitExceeded`, any 5xx | throw; message returns after the visibility timeout; 3 receives then `plan-dlq` |
| Crash after insert, before the task update | next run finds the event by `tfTaskId` in step 7 and completes the writes; no duplicate event |
| User edits the event during a run | step 3 of the next run reconciles; the lease prevents two runs racing |
| Grant revoked mid-run | treated like step 2: placements already written stay; the rest wait for reconnect |

#### D-TF-10 · Greedy first-fit placement
Placements are easy to explain ("the earliest slot that fits before the deadline"), the run is linear in
tasks × windows, and v1 users have tens of pending tasks, not thousands.
Rejected: a constraint solver such as OR-Tools CP-SAT (better packing, but placements become hard to
explain, runs get slower, and it adds a native dependency to a Lambda).
