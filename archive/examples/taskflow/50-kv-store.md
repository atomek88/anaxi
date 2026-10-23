# TaskFlow — shared key-value store

A **resource** branch: one shared dependency, declared once at L2, used by several capabilities. The
resource owns the keyspace contract (names, TTLs, failure behavior). Each consumer owns how it uses its
keyspace, inside its own branch. `--impact TF.kv-store` lists every consumer.

## TF.kv-store · Shared in-memory key-value store
> up: TF.system · kind: resource · state: settled · needs: contract

A Redis-compatible in-memory store for short-lived keys that many parts of TaskFlow need and none should own
alone: deduplication markers for at-least-once queues, cached third-party access tokens, and, once caching
is designed, response cache entries. Every key has a TTL. Nothing in it is a source of truth: losing the
whole store costs extra work (a token refresh, a duplicate check falling back), never data.

Consumers: [[TF.keyspaces]] lists them. Today: planning runs, notifications, calendar tokens. Waiting:
[[TF.caching]].

## TF.redis · ElastiCache Serverless for Valkey
> up: TF.kv-store · state: settled

One ElastiCache Serverless cache per environment, Valkey engine (Redis OSS–compatible), TLS required,
reachable only from inside the TaskFlow VPC. Clients use `ioredis` with TLS, a 200 ms command timeout, and
no automatic retries: a consumer decides what a failed command means, as listed in [[TF.keyspaces]].

Adding the store changes the runtime of [[TF.aws-runtime]] in one place that matters: every function that
talks to it runs inside the VPC. Today that is `plan`, `notify` and the calendar token path. Those functions
also call Google and APNs, so the VPC has a NAT gateway for outbound internet, plus gateway endpoints for
DynamoDB and interface endpoints for SQS so AWS traffic does not pay NAT data charges. Functions that never
touch the store (`normalize`, `submitTask`, `smsInbound`) stay outside the VPC and keep their cold-start
times.

Capacity: serverless scaling with a cap of 1 GB data and 5,000 ECPUs per second for v1, alarming at 70 %.
Eviction is not part of the plan: keys are small, short-lived, and bounded per user. An eviction alarm on any
non-zero `Evictions` metric treats eviction as an incident, because a lost dedupe key can mean a duplicate
nudge.

#### D-TF-13 · ElastiCache Serverless (Valkey) as the shared short-lived key store
Sub-millisecond reads for token lookups on every planning run, atomic `SET NX EX` for dedupe markers, and no
cluster sizing for a small, spiky load. Valkey is wire-compatible with Redis and priced lower on ElastiCache.
Rejected: DynamoDB items with TTL (TTL deletion can lag by up to days, so every read must also check expiry,
and conditional writes cost more per marker than an in-memory `SET NX`); Upstash Redis over HTTP (no VPC
needed, but a third vendor holding tokens); a self-managed Redis on EC2 (patching and failover for a cache).

## TF.keyspaces · Keyspace contract and failure behavior
> up: TF.redis · kind: contract · state: settled · decided-by: D-TF-02, D-TF-13

### Keyspaces
Every key is `<keyspace>:<version>:<parts>`. The version lets a consumer change its value format by bumping
the version, without a flush.

| Keyspace | Key | Value | TTL | Owner (consumer node) | When the store is unavailable |
|---|---|---|---|---|---|
| `dedupe` (plan) | `dedupe:v1:plan:<userId>:<nextPlanAt epoch>` | `1` | 2 h | [[TF.placement]] | run anyway; the per-user lease and event lookup by `tfTaskId` still prevent duplicate events |
| `dedupe` (notify) | `dedupe:v1:notify:<userId>:<kind>:<dedupeKey>` | message id | 48 h | [[TF.notifications]] | send anyway; a rare duplicate nudge is better than a missing one |
| `token` | `token:v1:google:<userId>` | access token, AES-GCM encrypted | `expires_in − 300 s` | [[TF.token-cache]] | refresh from the stored grant on every run |
| `cache` | reserved | — | — | [[TF.caching]], parked | — |

`<dedupeKey>` per notification kind: `placed` → `taskId`; `morning` and `endOfDay` → local date; `idle` →
local date of the last submission; `reconnect` → grant revocation timestamp.

### Operations
Consumers use only these three helpers from `shared/kv.ts`; no consumer calls the client directly.

```ts
/** True if this caller claimed the marker; false if it was already claimed. Throws KvUnavailable. */
export async function claimOnce(key: string, ttlSeconds: number, value = '1'): Promise<boolean> {
  return (await kv().set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
}
/** Value or null. Throws KvUnavailable. */
export async function getValue(key: string): Promise<string | null> { return kv().get(key); }
/** Overwrites with a TTL. Throws KvUnavailable. */
export async function putValue(key: string, value: string, ttlSeconds: number): Promise<void> {
  await kv().set(key, value, 'EX', ttlSeconds);
}
```

The client is created once per Lambda container, outside the handler, and reused across invocations:
`new Redis(url, { tls: {}, lazyConnect: true, connectTimeout: 500, commandTimeout: 200,
maxRetriesPerRequest: 0, enableOfflineQueue: false })`. With the offline queue disabled, a command issued
while the connection is down fails immediately instead of waiting, which is what makes the fallback columns
cheap. A frozen container that resumes with a dead socket gets one failed command, then reconnects on the next call.

`KvUnavailable` wraps timeouts, connection errors and `READONLY`/`LOADING` replies. Each consumer catches it and
applies the "when unavailable" column above. It never retries inline, so a store outage adds at most one 200 ms
timeout per call.

### Ordering for dedupe markers
Claim the marker before the side effect, and release it (`DEL`) if the side effect fails with a retryable
error. Otherwise a failed send would leave a marker that blocks the retry for the whole TTL:

| Step | `notify` handler |
|---|---|
| 1 | `claimOnce(dedupe:v1:notify:…, 48h)`; `false` → acknowledge the SQS message, done |
| 2 | send push or SMS |
| 3 | on retryable send failure: `DEL` the marker, throw so SQS redelivers |
| 4 | on permanent failure (APNs 410): keep the marker, delete the device token |

### Operational limits
Keys per user stay under about 50 (one token, one plan marker per slot, a few nudge markers per day). At
100,000 users that is about 5 million small keys, well inside the 1 GB cap. A consumer that needs a keyspace
not in the table adds a row here first. A new row is a change to this contract, reviewed with the store's
owner.

### Local development and tests
Local runs use the `valkey/valkey:8` container on port 6379 without TLS (`KV_TLS=false`). Integration
tests get a unique key prefix per test file (`test:<file hash>:`) through the same helpers, so tests can run
in parallel against one container and clean up with `SCAN` + `DEL` on their prefix. Unit tests replace
`shared/kv.ts` with an in-memory map that implements the same three helpers and can be switched to throw
`KvUnavailable`, which is how every "when the store is unavailable" row above is tested.
