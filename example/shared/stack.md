# Shared: project stack

## Stack
> @stack · depth: D2 🎯 · risk: 2·1·0·0 · about: infra

**Why.** Every item would otherwise re-argue the same technology choices. This item holds them once; items say
only what is new or different. Not a goal: coding standards (those live in the repo).

**What.** Applies to every item that `uses: @stack`. A change here (an upgrade, a replacement) is a change for
all of them, so each one gets a recheck nudge.

**Shape.**

| Layer | Choice | Why | Rejected |
|---|---|---|---|
| iOS app | Swift 6, SwiftUI, SwiftData, iOS 17+ | one platform at launch; SwiftData gives the offline outbox for free | React Native (offline outbox and widgets need native code anyway) |
| Backend | TypeScript on AWS Lambda, API Gateway, SQS, DynamoDB | spiky load, no servers to run, per-user partitioning fits DynamoDB | a container service (always-on cost for a few thousand requests a day) |
| Validation | `zod` | one schema for types and runtime checks | hand-written guards |
| Infrastructure | AWS CDK (TypeScript) | same language as the backend | Terraform (a second language for a small team) |

Risky part: Lambda cold starts on the "do now" path; measured before D3 of any latency-sensitive item.
Exact versions are D4 in each item (`D4.plan`), not here.

### Upgrade policy `D2 🎯`

Minor versions are taken as they come; major versions of anything in the table get their own item, which
`uses: @stack`, so every feature built on it gets a recheck nudge.
