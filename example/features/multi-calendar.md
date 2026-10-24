# Feature: multiple calendars

## Multiple calendars
> @multi-calendar · depth: D3 · risk: 2·1·2·2 · about: integration · focus: later · uses: [@scheduler](../shared/scheduler.md)

**Why.** Some users keep work and personal calendars apart and want both counted as busy.

**What.** Connect a second calendar in the settings screen (@settings); events from every connected calendar block time in the plan.
**Shape.** One `CalendarSource` per account, polled by the scheduler and merged into a single busy list.

**Contract.** (a full sync contract follows, written before anything in focus: now is ready)
