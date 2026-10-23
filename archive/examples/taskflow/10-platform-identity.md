# TaskFlow — platform and identity

Parents in [00-spine.md](00-spine.md): [[TF.platform]], [[TF.identity]].

## TF.aws-runtime · Serverless runtime on AWS
> up: TF.platform · state: settled

The backend is a set of AWS Lambda functions behind one Amazon API Gateway HTTP API, with Amazon SQS for
buffering, Amazon EventBridge Scheduler for timed jobs, and one Amazon DynamoDB table per environment.
Infrastructure is AWS CDK (TypeScript) in one repository, one stack per environment (dev, prod). Function
code is TypeScript on the Node.js 22 runtime. The iOS app is the only first-party client.

Timed work follows one pattern everywhere: an hourly schedule invokes a sweep function, the sweep reads the
items due in the current UTC hour from a sparse index, and fans out one message per user. Planning
([[TF.scheduler]]), nudges ([[TF.notifications]]) and the overdue-outcome check ([[TF.outcomes]])
all use it, so a new timed job is a new sweep, not a new mechanism.

#### D-TF-01 · Serverless AWS for the whole backend
Load is small and bursty: a few submissions per user per day and planning three times a day. Pay-per-request
compute and storage cost close to nothing at rest, and the ordered queue, scheduler, and speech-to-text
services that intake and scheduling need sit in one account and one permission model.
Rejected: containers on ECS Fargate (always-on cost and more operations for this load); Firebase (no
per-user ordered queue, and speech-to-text would live in a second cloud).

#### D-TF-02 · One DynamoDB table, partitioned by user
Partition key `PK = USER#<userId>`, sort key `SK = <ENTITY>#<id>`. Every user-facing access pattern is per
user, so one partition per user gives isolation and keeps a user's data one query away. Sweeps use a sparse
global secondary index `GSI1` with `GSI1PK = <KIND>DUE#<UTC hour>`: an item carries the attribute only while
it is waiting for that kind of work. Revisit write sharding of the hour bucket above roughly 50,000 users.
Rejected: Aurora Serverless v2 (no joins needed; minimum capacity costs money at rest).

Observability: every function logs JSON with `userId`, `taskId`, `submissionId` and `correlationId`. Metrics
use CloudWatch Embedded Metric Format: `SubmissionAccepted`, `TaskPlaced`, `NudgeSent`, `OutcomeRecorded`.

## TF.auth · Sign-in with Cognito
> up: TF.identity · state: settled · links: sends-via→TF.channel-gateway

The iOS app signs users in through an Amazon Cognito user pool with three providers: Sign in with Apple,
Google, and email/password (Cognito native users with email verification). The app opens the Cognito hosted
UI in `ASWebAuthenticationSession` using the authorization-code flow with PKCE, and keeps the refresh token
in the Keychain. Every API call carries the access token. The API Gateway HTTP API validates it with a JWT
authorizer, so functions receive a verified `sub` claim and never parse tokens themselves. The `sub` is the
TaskFlow `userId`; no function accepts a user ID from a request body.

Phone binding: the user enters a number in the app; the backend sends a six-digit code by SMS through
[[TF.channel-gateway]] and stores the number as verified only when the code matches within ten minutes.
A verified number is written to the account and to a lookup item `PK = PHONE#<E.164>` so inbound SMS can be
resolved to a user in one read. One number binds to one account; binding it elsewhere unbinds it here.

#### D-TF-03 · Cognito user pool is the identity provider of record
One token format reaches the API regardless of how the user signed in, and federation, verification, and
token rotation are managed rather than built.
Rejected: Firebase Auth (a second cloud and a second token format at the API); a custom auth service
(password storage and refresh-token rotation are not where TaskFlow should spend effort).

## TF.calendar-access · Calendar grants
> up: TF.identity · state: draft · links: alerts→TF.notifications

Google Calendar is connected server-side, separately from sign-in. The app starts an OAuth 2.0
authorization-code flow for a dedicated Google OAuth client with the scopes `calendar.freebusy` and
`calendar.events`, and the backend exchanges the code. The refresh token is encrypted with a KMS key and
stored on the account as `SK = GRANT#google`. TaskFlow only modifies events that carry its private extended
property `tfApp = 1`; the scope allows more, the code does not.

A refresh that fails with `invalid_grant` marks the grant `revoked`, pauses planning for that user, and
asks [[TF.notifications]] to send a reconnect nudge. Reconnecting replaces the grant and resumes planning
on the next sweep.

- ⚑ Q-TF-01 · Apple (iCloud) calendars have no server API that fits: CalDAV works only with an app-specific
  password the user must create by hand. Options: (a) Google-only for v1; (b) an on-device EventKit bridge
  that uploads free/busy and writes events locally when the planner pushes a placement; (c) CalDAV with an
  app-specific password. Blocks this node's contract and the Apple half of scheduling.

## TF.token-cache · Google access-token cache
> up: TF.calendar-access · kind: contract · state: settled · decided-by: D-TF-13 · links: uses→TF.keyspaces

Every planning run needs a Google access token, and the stored grant only holds the refresh token. A refresh
costs a round trip to Google's token endpoint (and counts against its quota) for a token that lives an hour.
Planning runs three times a day plus every do-now, so most refreshes are avoidable.

### Contract
```ts
/** A valid access token for the user's Google grant, refreshing at most once. */
export async function googleAccessToken(userId: string): Promise<string>;

export class GrantRevoked extends Error {}   // refresh returned invalid_grant; the grant is now marked revoked
```

| Step | Behavior |
|---|---|
| 1 | `getValue(token:v1:google:<userId>)` ([[TF.keyspaces]]). Hit → decrypt (AES-GCM, key from KMS data key cached per container) and return |
| 2 | Miss or `KvUnavailable` → load `GRANT#google`, decrypt the refresh token, `POST https://oauth2.googleapis.com/token` with `grant_type=refresh_token` |
| 3 | `200` → `putValue(token:v1:google:<userId>, encrypt(access_token), expires_in − 300)`, ignoring `KvUnavailable`; return the token |
| 4 | `400 invalid_grant` → mark the grant `revoked`, send `{kind: "reconnect"}` to `notify-requests`, throw `GrantRevoked` |
| 5 | `429` or `5xx` → throw; the caller's queue retry handles it |

The 300-second margin means a token read from the cache is valid for at least five minutes, longer than any
planning run. A token is never cached for less than 60 seconds; when `expires_in − 300` falls below that,
it is returned without caching.

### Invalidation
- Grant revoked or replaced (reconnect): `DEL token:v1:google:<userId>` in the same handler that writes the
  grant, before it returns.
- Google returns `401` on a calendar call made with a cached token (revoked outside TaskFlow): the caller
  deletes the cache key, calls `googleAccessToken` once more, and treats a second `401` as `GrantRevoked`.

### Why the token is encrypted in the cache
An access token grants calendar access for up to an hour. The store is only reachable from inside the VPC,
but encrypting with the same KMS-derived key as the grant means a cache dump or a debug `MONITOR` session
does not expose usable tokens. The cost is one AES-GCM operation per run.

### Tests
| Case | Expect |
|---|---|
| cache hit | no call to Google; decrypted token returned |
| cache miss | one refresh; key written with TTL `expires_in − 300` |
| store down | one refresh per call; no error surfaces to the planner |
| `invalid_grant` | grant `revoked`, one reconnect message queued, `GrantRevoked` thrown |
| reconnect | old key deleted before the new grant is used |
| `expires_in` = 320 | token returned, nothing cached |
