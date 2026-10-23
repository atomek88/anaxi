# Question library

**Non-binding.** Nothing here applies to a project until someone copies it into the project's
`anaxi-questions.md`, or into an item's checklist. It is a place to borrow from, for people and for agents
generating an item's questions ([SKILL.md](../SKILL.md), procedure 3).

Each line is already in the project-file format ([../../QUESTIONS.md §5.1](../../QUESTIONS.md#51-project-questions)),
so it can be pasted as-is. Nothing here is required; everything here was useful somewhere. Add `when: <topic>` if it should apply only to some items.

Contributions: add good project questions here when they could help other projects. Low bar: a question, and
the failure it prevents.

## Core extras

The narrower questions that were core before 0.4. Each is a specific angle on a core question. Borrow them
when an item or a project keeps missing that angle.

- D0 · Who has this problem, and how often or how much? · why: sizes the effort; names the users
- D0 · Why now, and what happens if we don't do it? · why: lets planning compare items
- D1 · What is in scope, and what is explicitly out? · why: keeps later levels from designing for things nobody asked for
- D1 · Are there words here that mean something specific, or could be read two ways? · why: one word meaning two things causes most review arguments
- D2 · Which qualities matter here (latency, scale, availability, cost), with numbers where they matter? · why: unstated quality needs get met by accident or not at all
- D2 · Which languages, frameworks, libraries and vendors are new to the project, and why? · why: new technology is where estimates go wrong
- D4 · Which exact packages and versions are added or upgraded, and what configuration do they need? · why: "use library X" isn't buildable
- D4 · Which tests should be written, including the edge and failure cases above? · why: turns the design into checks

## By concern

### APIs (anything other code calls)
- D3 · How is this versioned, and what must stay backward compatible? · why: public contracts are one-way doors
- D3 · How does a caller prove who it is, and what is it allowed to call? · why: auth added late is added inconsistently
- D3 · What are the limits: sizes, rates, timeouts, quotas? · why: unstated limits get discovered in production
- D3 · One worked example through the contract, end to end. · why: catches contracts that are consistent on paper only

### Data and storage
- D1 · What information is created, changed or owned, in domain words? · why: names the data before anyone picks a store
- D3 · What are the schemas, keys, constraints and indexes? · why: stored data is the hardest thing to change
- D3 · How long is the data kept, and how is it deleted? · why: retention decided late is a compliance problem

### UI
- D1 · Which screens or states does the user move through? · why: design and engineering agree before building
- D1 · What does the user see while this is in progress (loading, pending, partial)? · why: a confirmation shown before the work is done
- D2 · How does this work with a screen reader, larger text, and keyboard only? · why: accessibility retrofits cost more

### Queues, jobs, events, schedules
- D3 · What states can things be in, and what moves them between states? · why: lifecycle bugs come from unwritten state machines
- D3 · What are the ordering and delivery guarantees, and what makes processing safe to repeat? · why: duplicates and reordering are the default

### Third-party integrations
- D2 · Why this vendor, what does it cost, and what would leaving it take? · why: lock-in is decided here, rarely on purpose
- D3 · What do we do when the vendor is down, slow, rate-limits us or changes its API? · why: their outage becomes ours

### Security and privacy
- D1 · Who may do this, and who must not? · why: access rules decided late are decided badly
- D2 · How are identity, personal data and secrets handled, and where are they stored? · why: the most expensive thing to get wrong
- D3 · How could this be misused, and what stops it? · why: abuse cases are rarely in the happy path

### Infrastructure and operations
- D2 · How will we know it is working in production: logs, metrics, alerts? · why: silent failures last longest
- D2 · What does this cost to run at the expected load, and what makes the cost grow? · why: cost surprises arrive monthly
- D4 · What configuration, infrastructure or wiring is needed, per environment? · why: "works on my machine"

### Changes to existing systems
- D2 · What changes for existing data or users, and how do we move from old to new? · why: brownfield work is mostly migration
- D4 · How is this rolled out and rolled back: flags, stages, backfill? · why: a change without a way back is a one-way door

### ML and LLM features
- D1 · How is "good output" judged, and what is good enough to ship? · why: without an evaluation, every change is a guess
- D2 · Which model or approach, and what was compared? · why: the choice outlives the comparison
- D3 · What happens when the model is wrong, slow or unavailable? · why: models fail in new ways

### Planning
- D2 · Roughly how big is this, and can it be split? · why: planning input

## By kind of project

### Mobile apps
- D1 · What works offline, and what happens to actions taken offline? · why: devices lose connection constantly
- D3 · Which app versions still in the field call this, and what do they need from it? · why: old versions can't be updated by a deploy

### Libraries and SDKs
- D3 · Which names, types and behaviors are public, and which are internal? · why: everything public is a promise
- D3 · Which changes are breaking, and how are they released and announced? · why: consumers upgrade on their own schedule

### Data pipelines and analytics
- D2 · Where does each field come from, and who uses it downstream? · why: a silent upstream change corrupts every downstream report
- D3 · What data-quality checks run, and what happens when one fails? · why: bad data spreads before anyone notices

### Spikes and prototypes
- D0 · What question does this spike answer, and what result would change our plan? · why: spikes without a question never end
