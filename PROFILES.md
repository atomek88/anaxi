# Anaxi profiles and settings

Two files adjust Anaxi for a project:

| File | Holds | Format |
|---|---|---|
| **`anaxi.json`** | settings: profile, stage, where docs live, rubric, targets, caps, nudges, heading names | JSON, read by the tools |
| **`anaxi-questions.md`** | the project's questions, and its changes to core questions | markdown ([QUESTIONS.md §5.1](QUESTIONS.md#51-project-questions)) |

Questions are kept in markdown so people and agents edit them like any other doc. Settings are kept in JSON
because only the tools need them.

The ladder (D0–D4), the rubric and the core questions are defaults; a project can change all of them
([METHOD.md §0](METHOD.md#0-defaults-not-rules)). Projects that share items with each other should keep the same
ladder, so `uses: @their-api (D3)` means the same thing on both sides. *How to choose* is in [QUESTIONS_REFERENCE.md](QUESTIONS_REFERENCE.md).

## 1. Where settings come from

Later layers override earlier ones:

```
method defaults      METHOD.md, QUESTIONS.md
  → profile          profiles/<name>.json
    → project        anaxi.json + anaxi-questions.md at the docs root
      → folder       anaxi.json in a sub-folder (optional; e.g. mobile/ and services/; not read by the scripts yet)
        → item       the tag: profile:, target:, skip:, focus:
```

## 2. `anaxi.json`

```json
{
  "profile": "service",
  "stage": "pre-build",
  "docs": ["docs/**/*.md"],
  "shared": "docs/shared",
  "questions": "docs/anaxi-questions.md",
  "index": "docs/INDEX.md",
  "out": "docs/_anaxi",

  "sections": { "D2": ["Shape of it"], "canvas": ["Scratchpad"] },

  "rubric": {
    "factors": { "add": [{ "id": "compliance", "label": "Compliance exposure", "scale": ["none", "internal policy", "regulated"] }] },
    "floors": { "novelty": 0 },
    "thresholds": { "D1": [0, 1], "D2": [2, 4], "D3": [5, 7], "D4": [8, 10] }
  },

  "targets": {
    "min": "D1",
    "max": "D4",
    "rules": [ { "about": "security", "min": "D3" }, { "about": "agent", "min": "D4" } ]
  },

  "caps": {
    "focus": { "now": null, "next": "D2", "later": "D1" },
    "stage": { "discovery": "D1", "shaping": "D2" }
  },

  "nudges": { "off": ["N13"], "severity": { "N07": "block" } }
}
```

Every key is optional. A project with no `anaxi.json` gets the defaults.

| Key | Effect |
|---|---|
| `profile` | the profile to start from (default `default`) |
| `stage` | `discovery` · `shaping` · `pre-build` · `building` · `change`; caps targets for now ([METHOD §3.1](METHOD.md#31-effective-target-what-is-needed-now)) |
| `docs` / `shared` | where tagged docs live, and where shared items usually live |
| `questions` | path of the project questions file (default `anaxi-questions.md` at the docs root) |
| `index` / `out` | where the generated index goes, and where rendered documents go |
| `sections` | extra heading names that map to a level, or to the canvas ([FORMAT.md §4](FORMAT.md#4-what-level-a-piece-of-content-is-at)), to match your TDD template |
| `levels` | the ladder: `{ "D2": { "name": "Design", "done": "…" } }` renames or redefines a level, `"D4": null` drops it, `"D5": {…}` adds one. Levels run D0, D1, … with no gaps |
| `rubric.factors.base` | the risk factors (default blast · reversibility · novelty · certainty). Replace the list to use your own |
| `rubric.factors.add` | extra risk factors, scored 0–2. Widen `thresholds` to the new maximum |
| `rubric.floors` | `{ "factor": n }`: a factor never scores below n |
| `rubric.thresholds` | score range for each target level. A range for a dropped level gives the top level |
| `targets.min` / `max` / `rules` | a floor and ceiling for every item, or for items with a given `about:` topic |
| `caps.focus` / `caps.stage` | change the default caps; `null` means no cap |
| `nudges.off` / `severity` | switch nudges off, or change their severity. N09 (gate) can't be switched off |

## 3. Built-in profiles

A profile is a starting set of settings. Profiles also **suggest** sections of the
[question library](skills/anaxi/references/question-library.md). The skill offers them when setting up a project,
but they apply only if someone copies them into `anaxi-questions.md`.

| Profile | For | Settings | Suggests from the library |
|---|---|---|---|
| `default` | anything | none | — |
| `service` | backend services and APIs | `api` items at least D3 | APIs, queues, infrastructure, core extras |
| `mobile` | app features | — | mobile apps, UI, APIs |
| `data` | pipelines, analytics | `data` items at least D3 | data pipelines, data and storage |
| `integration` | third-party integrations | novelty never scores below 1 | integrations, queues |
| `library` | libraries, SDKs, frameworks | every item at least D3 | libraries and SDKs, APIs |
| `spike` | prototypes, investigations | maximum target D2; N07 and N08 `block` | spikes |
| `regulated` | PII, payments, health | `security` and `data` items at least D3 | security and privacy, data and storage |

The profile files are in [profiles/](profiles/), in the same format as `anaxi.json`, plus
`"core"` (changes to core questions, the same as "Changes to core" in the project file) and `"suggest"`
(library sections).

## 4. Per-item overrides

| Tag field | Use |
|---|---|
| `profile: spike` | one investigation inside a service project |
| `target: D3 (reason)` | the rubric is wrong for this item; the reason is required |
| `skip: ID (reason)` | one question doesn't apply to this item |
| `focus: next` | not in the current plan; caps the effective target |

If the same override keeps appearing, change the project settings instead. N16 points this out.
