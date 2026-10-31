# Appendix

Detail kept out of the TDDs so they stay short. Each section below belongs to the item named in its tag line
and counts as that item's own content.

## Recurring tasks: series record `D3`
> part-of: @recurring

Draft, while @recurring is at D2. The record the daily job reads:

| Field | Type | Notes |
|---|---|---|
| `seriesId` | UUID | stable; part of every occurrence's `submissionId` |
| `revision` | integer | starts at 1, raised by every edit; part of every occurrence's `submissionId` |
| `rule` | `weekly` · `monthly` | caveat: no custom rules yet |
| `startsOn` | local date | the user's time zone when created |
| `pausedAt` | timestamp or null | paused series make no occurrences |
