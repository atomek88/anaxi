# Shared: Task API

## Task API
> @task-api · depth: D3 🎯 · risk: 2·2·0·0 · about: api · uses: [@stack](stack.md)
> caveats: no batch submit · later: v2 batch endpoint (when bulk import is planned)

**Why.** Every way of capturing a task (typed, voice, SMS) needs one durable way to hand it to the backend,
so a task is never lost and never created twice. Not a goal: scheduling. The API accepts tasks; it doesn't
place them.

**What.** A client submits a task and gets "queued" back as soon as it is stored durably, never "scheduled".
Resubmitting the same task returns the same answer and creates nothing new. Acceptance: a task submitted
offline and retried ten times shows up exactly once.

**Shape.** `POST /v1/tasks` on the TaskFlow API, writing to the `intake.fifo` queue; the project stack, nothing
new (@stack). Decision: the client generates the `submissionId` and the queue deduplicates on it. Rejected:
server-generated IDs (a retry after a lost response would create a duplicate). Risky part: duplicates on
retry, which that decision handles.

**Contract.**

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `POST /v1/tasks` | `{submissionId, text, title?, durationMinutes?, deadline?, doNow}` | `202 {submissionId, status: "queued"}` | `400` invalid · `401` · `409` same id, different body · `429` |

Auth: every call carries the user's bearer token; the user ID comes from the token, never from the body.
Failure: the client retries on network errors, `429` and `5xx` with backoff (2 s, doubling, capped at 5 min),
always with the same `submissionId`. Versioning: `/v1/` is frozen; any breaking change is `/v2/`, because old
app versions stay installed.

### Decision log

> superseded-by: the client-generated `submissionId` above

Before 2026-09: the server generated task IDs and returned them in the `201`. Replaced because a retry after a
lost response created a duplicate task; @recurring, which retries each occurrence, made it common. Kept so nobody
proposes it again; never counted.
