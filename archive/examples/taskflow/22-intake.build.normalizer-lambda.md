# TaskFlow — build leaf: normalizer Lambda

Parent: [[TF.submission-envelope]] in [20-intake.md](20-intake.md). This leaf makes no design decisions; it
implements the ones it cites and records only local choices.

## TF.normalizer-lambda · TypeScript normalizer, store write, do-now trigger, and wiring
> up: TF.submission-envelope · kind: build · state: settled · decided-by: D-TF-01, D-TF-02, D-TF-05, D-TF-08 · links: triggers→TF.placement, sends-via→TF.notifications

### Module layout
```
functions/normalize/
  handler.ts      SQS FIFO consumer, partial batch response
  envelope.ts     envelope v1 schema (zod)
  rules.ts        the six normalization rules of TF.submission-envelope, in order
  store.ts        profile read, conditional task put
  do-now.ts       async invoke of the planner
  confirm.ts      confirmation per channel
infra/intake-stack.ts   queue, DLQ, function, event source, alarm
```

### Envelope schema
```ts
// envelope.ts
import { z } from 'zod';

export const EnvelopeV1 = z.object({
  v: z.literal(1),
  submissionId: z.string().uuid(),
  userId: z.string().min(1),
  channel: z.enum(['app', 'sms', 'voice']),
  receivedAt: z.string().datetime({ offset: true }),
  text: z.string().max(2000),
  hints: z
    .object({
      title: z.string().max(120).optional(),
      durationMinutes: z.number().int().min(5).max(480).optional(),
      deadline: z.string().datetime({ offset: true }).optional(),
      doNow: z.boolean().default(false),
    })
    .default({}),
  sourceConfidence: z.number().min(0).max(1),
  replyTo: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
  correlationId: z.string(),
});
export type EnvelopeV1 = z.infer<typeof EnvelopeV1>;
```

### Handler
```ts
// handler.ts
import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { EnvelopeV1 } from './envelope';
import { normalize } from './rules';
import { getProfile, putTask } from './store';
import { triggerDoNow } from './do-now';
import { confirmAdded, confirmDiscarded } from './confirm';
import { log, metric } from '../shared/observability';

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const failures: { itemIdentifier: string }[] = [];
  for (const record of event.Records) {
    // FIFO: after the first failure, report every later message too, so no message overtakes an earlier one.
    if (failures.length) {
      failures.push({ itemIdentifier: record.messageId });
      continue;
    }
    try {
      const env = EnvelopeV1.parse(JSON.parse(record.body));
      const profile = await getProfile(env.userId);
      const task = normalize(env, profile.timeZone, new Date(env.receivedAt));
      if (!task) {
        await confirmDiscarded(env);
        continue;
      }
      const created = await putTask(env.userId, task);
      if (!created) {
        log.info('replay ignored', { submissionId: env.submissionId, correlationId: env.correlationId });
        continue;
      }
      if (task.doNow) await triggerDoNow(env.userId, task.taskId);
      await confirmAdded(env, task);
      metric('SubmissionAccepted', 1, { channel: env.channel, needsReview: String(task.needsReview) });
    } catch (err) {
      log.error('normalize failed', { messageId: record.messageId, err });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
};
```

### Rules
```ts
// rules.ts
import * as chrono from 'chrono-node';
import type { EnvelopeV1 } from './envelope';
import { endOfLocalDay, offsetMinutes } from '../shared/time';

export const REVIEW_THRESHOLD = 0.6;                       // D-TF-08
const DO_NOW = /^\s*(now|asap)\s*:\s*/i;
const DURATION = /\b(\d{1,3})\s*(minutes|mins|min|m|hours|hrs|hr|h)\b/i;
const WORD_DURATIONS: [RegExp, number][] = [[/\bhalf an hour\b/i, 30], [/\ban hour\b/i, 60]];
const DANGLING = /\b(by|before|on)\s*$/i;

export interface NormalizedTask {
  taskId: string; title: string; durationMinutes: number; deadline?: string; doNow: boolean;
  needsReview: boolean; confidence: number; channel: EnvelopeV1['channel']; sourceText: string;
}

export function normalize(env: EnvelopeV1, timeZone: string, ref: Date): NormalizedTask | null {
  // 1. whitespace; empty means nothing to create
  let text = env.text.replace(/\s+/g, ' ').trim();
  if (!text && !env.hints.title) return null;

  // 2. do now
  let doNow = env.hints.doNow;
  if (DO_NOW.test(text)) { doNow = true; text = text.replace(DO_NOW, ''); }

  // 3. duration
  let duration = env.hints.durationMinutes;
  if (duration === undefined) {
    const m = text.match(DURATION);
    if (m) {
      duration = Number(m[1]) * (/^h/i.test(m[2]) ? 60 : 1);
      text = text.replace(m[0], '');
    } else {
      for (const [re, mins] of WORD_DURATIONS) {
        if (re.test(text)) { duration = mins; text = text.replace(re, ''); break; }
      }
    }
  }
  const durationMinutes = Math.min(480, Math.max(5, duration ?? 30));

  // 4. deadline, read in the user's zone
  let deadline = env.hints.deadline;
  let parseConfidence = 1;
  if (!deadline) {
    const [hit] = chrono.parse(text, { instant: ref, timezone: offsetMinutes(timeZone, ref) }, { forwardDate: true });
    if (hit) {
      let date = hit.start.date();
      if (!hit.start.isCertain('hour')) date = endOfLocalDay(date, timeZone);
      if (date > ref) {
        deadline = date.toISOString();
        if (!hit.start.isCertain('day')) parseConfidence = 0.7;
        text = (text.slice(0, hit.index) + text.slice(hit.index + hit.text.length)).trim().replace(DANGLING, '');
      }
    }
  }

  // 5. title
  const rest = text.replace(/\s+/g, ' ').replace(/[\s,.;:-]+$/, '').trim();
  const title = env.hints.title ?? (sentenceCase(rest.slice(0, 120)) || 'Untitled task');

  // 6. confidence
  const confidence = Number((env.sourceConfidence * parseConfidence).toFixed(3));
  return {
    taskId: env.submissionId, title, durationMinutes, deadline, doNow,
    needsReview: confidence < REVIEW_THRESHOLD, confidence, channel: env.channel, sourceText: env.text,
  };
}

const sentenceCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
```

### Store and do-now
```ts
// store.ts
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { NormalizedTask } from './rules';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },        // deadline is optional
});
const TABLE = process.env.TABLE_NAME!;

export async function getProfile(userId: string): Promise<{ timeZone: string }> {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: 'PROFILE' } }));
  return { timeZone: Item?.timeZone ?? 'UTC' };
}

/** True when written; false when this submissionId already exists (a replay past the FIFO dedup window). */
export async function putTask(userId: string, t: NormalizedTask, now = new Date()): Promise<boolean> {
  try {
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: { PK: `USER#${userId}`, SK: `TASK#${t.taskId}`, entity: 'task', status: 'pending', ...t, createdAt: now.toISOString() },
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    return true;
  } catch (e) {
    if (e instanceof ConditionalCheckFailedException) return false;
    throw e;
  }
}
```
```ts
// do-now.ts: payload is exactly the doNow row of TF.placement's input table
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
const lambda = new LambdaClient({});

export async function triggerDoNow(userId: string, taskId: string): Promise<void> {
  await lambda.send(new InvokeCommand({
    FunctionName: process.env.PLAN_FUNCTION_NAME,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify({ trigger: 'doNow', userId, taskId })),
  }));
}
```
`confirm.ts` writes `{userId, kind: "added" | "discarded", payload}` to `notify-requests`
([[TF.notifications]]). SMS confirmations carry `replyTo`; the SMS provider itself stays behind the
`SmsSender` port until [[Q-TF-02]] is answered.

### Wiring (CDK)
```ts
// infra/intake-stack.ts (excerpt)
const dlq = new sqs.Queue(this, 'IntakeDlq', {
  fifo: true, queueName: 'intake-dlq.fifo', retentionPeriod: Duration.days(14),
});
const intake = new sqs.Queue(this, 'Intake', {
  fifo: true, queueName: 'intake.fifo',
  visibilityTimeout: Duration.seconds(60),                 // 6 × function timeout
  deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
});
const normalizeFn = new NodejsFunction(this, 'Normalize', {
  entry: 'functions/normalize/handler.ts',
  runtime: lambda.Runtime.NODEJS_22_X,
  timeout: Duration.seconds(10),
  environment: { TABLE_NAME: table.tableName, PLAN_FUNCTION_NAME: planFn.functionName, NOTIFY_QUEUE_URL: notifyQueue.queueUrl },
});
normalizeFn.addEventSource(new SqsEventSource(intake, { batchSize: 10, reportBatchItemFailures: true }));
table.grantReadWriteData(normalizeFn);
planFn.grantInvoke(normalizeFn);
notifyQueue.grantSendMessages(normalizeFn);
new cloudwatch.Alarm(this, 'IntakeDlqNotEmpty', {
  metric: dlq.metricApproximateNumberOfMessagesVisible(),
  threshold: 1, evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
});
```

### Interop with neighbors
| Neighbor | Contract this leaf honors | Defined in |
|---|---|---|
| App, SMS, voice producers | accepts only envelope v1; `userId` was set by a trusted producer, never by a request body | [[TF.submission-envelope]] |
| Planner | `{trigger: "doNow", userId, taskId}` by async invoke; Lambda retries twice on planner errors | [[TF.placement]] |
| Notifications | one message per confirmation on `notify-requests`; quiet hours apply, the daily cap does not | [[TF.notifications]] |
| Table | `TASK#<submissionId>` under `USER#<userId>`; the planner reads `status: pending` tasks from the same partition | [[D-TF-02]] |

### Local choices
- Local choice: `chrono-node` for date phrases. It is used only inside rule 4; replacing it touches
  `rules.ts` alone.
- Local choice: stop the whole batch at the first failure instead of tracking failures per message group.
  Simpler, still order-preserving, and the cost is a few extra re-deliveries for other users.
- Local choice: a missing profile falls back to `UTC` with a warning instead of failing the message; the
  user can fix a wrong deadline, but a message stuck in the DLQ is a lost task until someone looks.

### Tests (vitest)
| Input (`channel`, text, other) | Expected |
|---|---|
| app, `"now: call the bank 15 min"` | `doNow` true, 15 min, title `"Call the bank"`, confidence 1 |
| sms, `"dentist forms by friday"`, received Wed 2026-10-07 18:00 `America/Chicago` | deadline Fri 2026-10-09 23:59 local, title `"Dentist forms"`, confidence 1 |
| voice, `"plan mom's birthday next week"`, `sourceConfidence` 0.82 | parse confidence 0.7 → 0.574 → `needsReview` true |
| app, `"read the novel 900 min"` | duration clamped to 480 |
| voice, `""` | `normalize` returns null → discarded notice, no task |
| any, same `submissionId` replayed after 10 min | `putTask` false → no confirmation, no planner invoke |
| batch of 4, message 2 throws | `batchItemFailures` = messages 2, 3, 4 |
| app, `"buy milk by yesterday"` | past date ignored: no deadline, title keeps the phrase |
