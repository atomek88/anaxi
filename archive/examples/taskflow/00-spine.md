# TaskFlow — spine (intent, system, capabilities)

Worked Strata example. This file is always readable top to bottom: intent, the system, and every capability.
Deeper strata live in [10-platform-identity.md](10-platform-identity.md), [20-intake.md](20-intake.md),
[30-scheduling.md](30-scheduling.md), [40-nudges-tracking.md](40-nudges-tracking.md), the build leaves (`*.build.*.md`), and the shared key-value store [50-kv-store.md](50-kv-store.md).

## TF.need · Get my tasks into my calendar
> state: settled

I keep a running list of things I need to do, and most of them never get a time. I need a tool that takes
tasks from me however they come to mind (typed, texted, or spoken) and finds days and times when I can
actually do them. It should nudge me when I have not given it anything, and tell me honestly how many tasks
I finished versus let slide.

## TF.system · Multi-channel task intake with calendar scheduling
> up: TF.need · state: settled

A user submits tasks to TaskFlow from the mobile app, by SMS, or by voice. Each submission becomes a
normalized task owned by one authenticated user. A scheduler compares pending tasks with the user's calendar
availability and preferences, then places each task into a free window as a calendar event, or into the next
free window right away when the user marks it "do now". TaskFlow prompts users who have gone quiet, and
records the outcome of every placed task (completed, missed, rescheduled, cancelled) to report a completion
ratio over time.

Boundary: TaskFlow owns tasks, schedules, and outcomes. The user's calendar provider owns calendar events;
TaskFlow reads free/busy time and writes only the events it creates. Inside the box, one shared key-value
store holds short-lived keys (dedupe markers, cached tokens) for several capabilities; it is never a source of
truth.

Success measure: the share of submitted tasks that get a calendar slot within 24 hours, and the trend of the
completion ratio.

## TF.platform · Shared runtime
> up: TF.system · state: settled · scope: cross-cutting

All capabilities run on one backend reached through a single authenticated HTTPS API. Work that does not
need an immediate answer (parsing a submission, planning a day, sending a nudge) runs as asynchronous,
event-driven jobs, so a slow dependency delays work instead of failing a user request. Every record is
partitioned by user, and no job reads across users except the timed sweeps that find due work. Each
capability emits structured logs and a small set of metrics (submissions accepted, tasks placed, nudges
sent, outcomes recorded) so the success measure in [[TF.system]] comes from telemetry, not estimates.

## TF.identity · Accounts, sign-in, and channel bindings
> up: TF.system · state: settled · needs: contract · links: guards→TF.intake, guards→TF.scheduling, alerts→TF.nudges

Every task, calendar connection, and outcome belongs to exactly one user account. The user signs in on the
mobile app with a federated identity or with email and password; the backend sees only a verified user ID on
each request and never handles passwords for federated users.

An account also holds channel bindings. A verified phone number lets SMS submissions resolve to the account.
A calendar connection grants TaskFlow scoped access: read free/busy time, and create, update, and delete the
events TaskFlow created. Unbound channels are rejected, never guessed: an SMS from an unknown number gets a
reply explaining how to link the number in the app.

Interactions: intake attributes every submission through identity; scheduling uses the stored calendar
grant; when a grant is revoked or expires, scheduling pauses for that user and nudges asks them to reconnect.

## TF.intake · Task capture
> up: TF.system · state: settled · needs: build · links: feeds→TF.scheduling, uses→TF.identity, records→TF.tracking

Users submit tasks through three channels: typed entry in the app, an SMS to TaskFlow's service number, or a
spoken note recorded in the app and converted to text by a speech-to-text service. All three channels
produce the same raw submission, and one normalizer turns it into a task: title, duration estimate, optional
deadline, "do now" flag, and the source channel.

A submission is written to a durable queue, ordered per user, before TaskFlow acknowledges it, so a
submission is never lost when downstream processing is slow or down. The user gets a confirmation once the
submission is queued, not once it is scheduled. When parsing is uncertain, the task is kept with defaults
and flagged for review in the app instead of being rejected.

- ✓ Q-TF-03 · Reject low-confidence parses, or keep them? → keep, flagged for review ([[D-TF-08]]).

Interactions: identity resolves the owner of every submission; scheduling consumes normalized tasks, and a
"do now" task skips the wait for the next planning run; nudges lead users back here. Not every inbound SMS is
a task: a "done" reply is an outcome report and is handed to tracking.

## TF.scheduling · Finding and placing time
> up: TF.system · state: settled · needs: contract · links: feeds→TF.tracking, uses→TF.identity, informs→TF.nudges

A planning job runs several times a day in each user's time zone. It reads the user's free/busy time for the
next seven days, applies their preferences (working hours, maximum tasks per day, buffer between tasks), and
places pending tasks into windows long enough to hold them: earliest deadline first, then oldest first. Each
placement becomes a calendar event that TaskFlow owns and tags with the task ID.

A "do now" task skips the schedule and is placed in the first free window starting now; if nothing fits in
the next two hours, the user is told and the task joins the next normal run. When the user moves or deletes
a TaskFlow event in their calendar, the next run treats the calendar as the truth: a moved event keeps its
new time, and a deleted one returns the task to pending.

Interactions: every placement opens an outcome record in tracking; placement results ("placed", "couldn't
fit") reach the user through nudges, and the morning summary reads today's placements.

## TF.nudges · Prompts and reminders
> up: TF.system · state: settled · links: prompts→TF.intake, collects→TF.tracking

TaskFlow reaches out on the user's preferred channel (push notification or SMS) in four cases: no
submissions for three days; a morning summary of today's placed tasks; a reconnect request when the calendar
grant stops working; and an end-of-day check asking whether each of today's tasks was done. Answers to the
end-of-day check go to tracking. Every nudge respects quiet hours and a daily cap, and a nudge that opens the
app lands on the screen that answers it.

## TF.tracking · Outcomes and completion ratio
> up: TF.system · state: settled · links: feeds→TF.scheduling

Every placed task ends in one of four outcomes: completed, missed, rescheduled, or cancelled. The user marks
a task completed from the app, by replying "done" to an SMS, or by answering the end-of-day check. A task
whose event ended more than twelve hours ago without a completion is marked missed and returns to pending,
so the next planning run can place it again, unless the user cancels it.

The completion ratio is completed ÷ (completed + missed) over rolling 7-day and 30-day windows. Rescheduled
and cancelled tasks are excluded from the ratio and counted separately, so moving a task never counts
against the user.

## TF.caching · Response caching
> up: TF.system · state: parked · grow-when: TF.kv-store

Read-heavy screens (today's schedule, the stats view) may serve cached answers for a short time instead of
reading every record per request. Parked until the shared key-value store exists, because caching needs a
place for short-lived entries that every function can reach and that can be lost without harm.
