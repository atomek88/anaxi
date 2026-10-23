# TaskFlow — nudges and tracking

Parents in [00-spine.md](00-spine.md): [[TF.nudges]], [[TF.tracking]]. Both branches stop at architecture:
they are low-risk, reversible, and follow patterns already decided above. Those leaves are complete.

## TF.notifications · Push and SMS nudges
> up: TF.nudges · state: settled · links: uses→TF.channel-gateway, records→TF.outcomes, reads→TF.scheduler, uses→TF.keyspaces

All outbound messages go through one `notify` Lambda that consumes the standard SQS queue
`notify-requests` (`{userId, kind, payload}`). It picks the channel from the user's preference, enforces
quiet hours (default 21:00–08:00 local), drops redeliveries with a dedupe marker ([[TF.keyspaces]]), and a cap of three nudges per local day (counter item
`SK = NUDGECAP#<local date>`), and then sends. Transactional messages (placement results, verification
codes, reconnect requests) skip the cap but not quiet hours, except verification codes, which skip both.

Push goes straight to APNs over HTTP/2 with token-based auth: the `.p8` key lives in Secrets Manager and the
function signs a fresh ES256 JWT every 50 minutes. Device tokens are stored per user as
`SK = DEVICE#<token>`; an APNs `410 Unregistered` deletes the item. SMS goes through the `SmsSender` port of
[[TF.channel-gateway]].

Timed nudges use the sweep pattern of [[TF.aws-runtime]]: `nudgeSweep` runs hourly and enqueues the morning
summary at 07:30 local (today's placed tasks, read from the planner's task records, numbered so SMS users
can reply `done 2`), the end-of-day check at 20:00 local, and the idle nudge after three days without a
submission. The end-of-day push uses a notification category with "Done" and "Missed" actions; tapping one
calls `POST /v1/tasks/{taskId}/outcome` without opening the app ([[TF.outcomes]]). Reconnect requests come
from [[TF.calendar-access]].

#### D-TF-11 · Direct APNs, no push intermediary
One platform, one integration: a direct HTTP/2 client is about 80 lines and removes a second registry of
devices to keep in sync.
Rejected: SNS mobile push (per-device platform endpoints to create, update and clean up, for no benefit with
a single platform); a third-party push service (another vendor holding user device tokens).

## TF.outcomes · Outcome records and completion ratio
> up: TF.tracking · state: settled · links: returns→TF.scheduler

Each placement creates `SK = OUTCOME#<taskId>` with `status: pending`, `slotEnd`, `dueCheckAt` and the sparse
key `GSI1PK = CHECKDUE#<UTC hour of dueCheckAt>` ([[TF.placement]]). An outcome leaves `pending` in one of
three ways:

- the user reports it: `POST /v1/tasks/{taskId}/outcome` with `{outcome: "completed" | "cancelled"}` from
  the app or a notification action, or an SMS `done` / `done <n>` routed by [[TF.channel-gateway]];
- the hourly `outcomeSweep` finds it past `dueCheckAt` and marks it `missed`, then sets the task back to
  `pending` so the next planning run places it again ([[TF.scheduler]]);
- the planner sees the event deleted or moved and marks it `rescheduled`.

Setting any final status removes `GSI1PK`, so the sweep never sees it again. A user may correct an outcome
(missed → completed) within 7 days; the record keeps `correctedAt`.

The ratio is computed on read: `GET /v1/stats?window=7d|30d` queries the user's `OUTCOME#` items resolved in
the window and returns `{completed, missed, rescheduled, cancelled, ratio}`, where ratio = completed ÷
(completed + missed), or `null` when both are zero (never 0, which would read as a failing week).

#### D-TF-12 · Compute the ratio on read
A user resolves a few hundred outcomes a month; reading them is cheap, and corrections need no compensating
writes.
Rejected: running counters on the profile (every correction and every late sweep needs a compensating
update, and counters drift silently when one is missed).
