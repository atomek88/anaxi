# Broken fixture: every node breaks at least one Strata rule on purpose

## BK.need · Find my notes again
> state: settled

I want my notes sorted into folders automatically so I can find any of them later without searching.

## BK.system · Over-long system node (S11)
> up: BK.need · state: settled

The system accepts notes from the user and assigns each note to a folder. It keeps a list of folders, a set
of rules per folder, and a history of moves so that the user can undo a move. It shows the folders in the app
and lets the user correct a folder, which teaches the rules. It also exports everything as plain files on
demand, and imports existing notes from a directory the user picks during setup.

## BK.store · Vendor name in a capability (S06); needs contract but stops at architecture (G01)
> up: BK.system · state: settled · needs: contract

Notes are stored in DynamoDB, one item per note, with the folder as an attribute. The store keeps every
version of a note so a correction can be undone, and it answers "all notes in folder X" in one read.

## BK.sort · Settled with an open question (S12)
> up: BK.system · state: settled

Each new note is matched against folder rules and moved into the best match; ties go to the newest folder.
A correction by the user adds the note's keywords to the target folder's rules. Sorting never deletes.

- ⚑ Q-BK-01 · Which folders exist before the user creates any?

## BK.search · Parked until the store settles, and it has (G02)
> up: BK.system · state: parked · grow-when: BK.store

Full-text search across notes.

## BK.misplaced · An architecture node at depth 2 (S02)
> up: BK.system · kind: architecture · state: draft

Directly under the system node, where only capabilities and resources belong.

## BK.sort-engine · Code in architecture (S07), ghost edge (S10), no Rejected (S09), no state (S14)
> up: BK.sort · links: reads→BK.store-db

```js
sortNote(note, rules)
```

#### D-BK-01 · Keyword rules instead of a classifier
Because it is simple. See the retired [[BK.old-sorter]] for history.

## BK.store-db · Too short (W01)
> up: BK.store · state: draft

One table.

## BK.orphan · Parent does not exist (S03)
> up: BK.missing · state: draft

Nobody owns this node.

## BK.engine-contract · Contract for the sort engine
> up: BK.sort-engine · kind: contract · state: draft

The engine exposes one function, sortNote, which returns a folder id and a confidence.

## BK.leaf · Decides in a build node (S08), cites itself (S13), dangling reference (S04)
> up: BK.engine-contract · kind: build · state: draft · decided-by: D-BK-02

#### D-BK-02 · Use a regex library
Rejected: none considered.

Details in [[BK.ghost]].

## BK.backslide · A contract under a build node (S02)
> up: BK.leaf · kind: contract · state: draft

Kinds may repeat or move toward build, never back up.

## BK.weird · Unknown kind (S14)
> up: BK.sort-engine · kind: blueprint · state: draft

Not a kind Strata knows.

## BK.need · Duplicate of the root (S01)
> state: draft

A second root with the same ID.
