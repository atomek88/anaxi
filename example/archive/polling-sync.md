---
anaxi: "@polling-sync"
depth: D2
risk: 1·1·0·0
superseded-by: "@scheduler (an event-driven planner replaced the per-minute poll)"
archived-from: "shared/polling-sync.md"
---
# Polling sync

The first design for getting tasks into the calendar. Kept because it explains why the planner is event-driven:
[the scheduler](../shared/scheduler.md) replaced it.

## Context

Clients asked the server every minute whether anything needed scheduling.

## Design

A cron job per user that re-planned everything on each tick. It cost a full plan per user per minute, and the
calendar provider rate-limited us at around 2,000 users.
