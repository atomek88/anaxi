# Project questions: TaskFlow

Borrowed from the library's "Mobile apps", "UI" and "APIs" sections, the ones this project keeps needing.

## Added
- **D1.offline** · What works offline, and what happens to actions taken offline? · when: ui · why: half our users capture tasks on the move
- **D1.in-progress** · What does the user see while this is in progress? · when: ui · why: we once showed "Scheduled" before anything was placed
- **D3.app-versions** · Which app versions still in the field call this, and what do they need from it? · when: api · why: old versions can't be updated by a deploy
- D2 · Which third-party calendar quota or rate limit does this touch? · when: integration · why: Google throttled the planner in beta

## Changes to core
- reword: D1.acceptance → How will we know it behaves that way, on the oldest app version we still support?

## Principles
- **Old app versions are users too.** Anything the app calls is a public contract.
