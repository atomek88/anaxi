---
anaxi: "@format"
depth: D3
risk: 2·2·1·0
about: [format]
uses: ["@method"]
caveats: levels are read from prose by heuristics; a mark quoted as an example can look like a real one
parts:
  - "../../../FORMAT.md (D3)"
built: yes (2026-10-31)
code: [../../../tools/lib/parse.mjs, ../../../tools/lib/read.mjs]
---
# The markup

**Why.** The marks have to live in markdown people already write and read on GitHub, in an IDE and in an LLM,
without a renderer. If adopting Anaxi means rewriting docs into a new structure, nobody adopts it. It worked when
a team's existing TDD becomes an item by adding one line.

**What.** Four ways to declare an item (front matter, a `>` tag line, a heading badge, an HTML comment), all with
the same fields. Badges and icons with one meaning each. References as `@id` or as links to tagged docs. Which
level a piece of text is at: an explicit mark (a `D2` heading, a badge, a bold lead-in, a comment), else the
heading's name, else the section above. Item checklists, the canvas, parts kept in other files (marked `part-of:` there, or
listed on the item as `parts:` when the file shouldn't carry marks), and lifecycle marks. Out of scope: any required section order or template.

**Shape.** Accept every form and give each exactly one meaning, chosen over one canonical syntax that would force
docs to be rewritten. Heading names map to levels through a table a project can extend (`sections`). The risky
part is the heuristics: dogfooding found lead-ins quoted in inline code counted as levels, and `<!-- D3 -->`
comments ignored when measuring; both are fixed and self-tested. Parts can be listed from the item's side so a design folder
stays self-contained: no marks in specs, READMEs or code (decided 2026-10-30). The parser is `tools/lib/parse.mjs` and
`tools/lib/read.mjs` (@engine).
