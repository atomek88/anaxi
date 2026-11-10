#!/usr/bin/env node
// PreToolUse (Write|Edit|MultiEdit|NotebookEdit): the hard gate (@hard-gate). Any error means allow.
// - A code file that an item maps in `code:`, where the item isn't built yet and isn't ready: refused.
// - The gate can't be lifted from inside a session: an edit to anaxi.json that turns the gate off or makes a blocked
//   item ready through settings alone, or an edit to a doc that marks a blocked item built or drops its `code:`, is
//   refused. Designing it (answering its questions, writing its levels) is the way through, and stays open.
// - Who decides (@decided): on an item the gate holds, an agent can't tick a person's question (`(decide: person)`, or
//   D0–D1 by default), add one already ticked, or make it anyone's; it writes `→ proposed:` and asks. Elsewhere it's
//   only called out (N29, `anaxi-check decisions --who`).
// A person turns the gate off for a project by editing anaxi.json themselves: "hooks": { "gate": false }.
import fs from 'node:fs';
import path from 'node:path';
import { PLUGIN_ROOT, input, project, quiet } from './lib.mjs';

/** The file's text after the edit, or null when the tool's input can't be read. */
function after(abs, tool, t) {
  if (tool === 'Write') return t.content ?? null;
  let s; try { s = fs.readFileSync(abs, 'utf8'); } catch { return null; }
  const one = (x, e) => (e.replace_all ? x.split(e.old_string).join(e.new_string) : x.replace(e.old_string, e.new_string));
  if (tool === 'Edit') return t.old_string == null ? null : one(s, t);
  if (tool === 'MultiEdit') return Array.isArray(t.edits) ? t.edits.reduce(one, s) : null;
  return null;
}

quiet(async () => {
  const { cwd = process.cwd(), tool_name: tool = '', tool_input: t = {} } = await input();
  const file = t.file_path || t.notebook_path || t.path;
  if (!file) return;
  const abs = path.resolve(cwd, file);
  const cfg = (await project(path.dirname(abs))) || (await project(cwd));
  if (!cfg) return;
  const { evaluate, gateFor, gate } = await import(path.join(PLUGIN_ROOT, 'tools/lib/engine.mjs'));
  const { settingsFor, whoDecides } = await import(path.join(PLUGIN_ROOT, 'tools/lib/config.mjs'));
  const deny = (reason) => console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
  const rel = path.relative(cfg.root, abs).split(path.sep).join('/');
  const isConfig = cfg.file && abs === cfg.file;
  if (cfg.hooks?.gate === false && !isConfig) return;

  const model = evaluate(cfg);
  // what the gate holds back now: unbuilt items with planned code that aren't ready
  const held = model.items.filter((it) => it.codePaths?.length && it.built !== 'yes' && it.built !== 'partly' && !gate(model, it).ready);
  const PROPOSE = (it, n) => `Write your answer as a proposal on the unchecked line (→ proposed: …) and ask the user; they record it with: ! node ${path.join(PLUGIN_ROOT, 'tools/anaxi-check.mjs')} decide ${it.id} ${n} "answer" (or --accept), or in their editor.`;
  const LIFT = 'The gate is lifted by designing the item (answer its open questions, write its missing levels) or by the user editing anaxi.json themselves, not from inside this session. Tell the user what is missing and ask.';

  if (isConfig) {
    const text = after(abs, tool, t); if (text == null) return;
    let next; try { next = JSON.parse(text); } catch { return; }
    if (cfg.hooks?.gate !== false && next.hooks?.gate === false) return deny(`Anaxi's gate: this edit turns the hard gate off. ${LIFT}`);
    if ((cfg.gate?.commit || 'warn') === 'block' && next.gate?.commit && next.gate.commit !== 'block') return deny(`Anaxi's gate: this edit stops the commit gate from blocking. ${LIFT}`);
    const cfgN = settingsFor(next);
    const lowered = held.flatMap((it) => it.checklist.filter((q) => !q.checked && whoDecides(it.cfg, q) === 'person' && whoDecides(cfgN, q) !== 'person').map(() => it.id));
    if (lowered.length) return deny(`Anaxi's gate: this edit makes open decisions on ${[...new Set(lowered)].join(', ')} anyone's, while the gate holds ${lowered.length > 1 ? 'them' : 'it'}. Those are a person's to decide. ${LIFT}`);
    if (!held.length) return;
    const cfg2 = { ...cfg, ...settingsFor(next), root: cfg.root, file: cfg.file };
    const m2 = evaluate(cfg2, { read: (r) => fs.readFileSync(path.join(cfg.root, r), 'utf8') });
    const opened = held.filter((it) => { const x = m2.byId.get(it.id) || m2.all.find((y) => y.key === it.key); return x && gate(m2, x).ready; });
    if (opened.length) return deny(`Anaxi's gate: this settings change would make ${opened.map((x) => x.id).join(', ')} ready without designing ${opened.length > 1 ? 'them' : 'it'}. ${LIFT}`);
    return;
  }

  if (/\.(md|markdown)$/i.test(file)) {
    if (!held.some((it) => it.file === rel)) return;
    const text = after(abs, tool, t); if (text == null) return;
    const m2 = evaluate(cfg, { read: (r) => (r === rel ? text : fs.readFileSync(path.join(cfg.root, r), 'utf8')) });
    for (const it of held.filter((x) => x.file === rel)) {
      const x = m2.byId.get(it.id) || m2.all.find((y) => y.key === it.key);
      if (!x) continue;
      if ((x.built === 'yes' || x.built === 'partly') && !gate(m2, x).ready) return deny(`Anaxi's gate: ${it.id} isn't built and isn't ready; marking it built: ${x.built} would open the gate without designing it. Mark it built only after it's built from a ready design. ${LIFT}`);
      if ((x.codePaths || []).length < it.codePaths.length && !gate(m2, x).ready) return deny(`Anaxi's gate: removing ${it.id}'s planned code: paths would let its code be written before it's designed. ${LIFT}`);
      // who decides: a person's question ticked, added ticked, or handed to anyone, on an item the gate holds
      const person = (y, q) => whoDecides(y.cfg, q) === 'person';
      const was = new Map(it.checklist.map((q) => [q.text, q]));
      const n = (q) => it.checklist.indexOf(was.get(q.text)) + 1;
      for (const q of x.checklist) {
        const p = was.get(q.text);
        if (p && !p.checked && person(it, p) && q.checked) return deny(`Anaxi's gate: ${it.id} is held, and question ${n(q)} ("${q.text}", ${p.level || 'no level'}) is a person's to decide. ${PROPOSE(it, n(q))}`);
        if (p && !p.checked && person(it, p) && !person(x, q)) return deny(`Anaxi's gate: ${it.id} is held, and question ${n(q)} ("${q.text}") is a person's to decide; this edit would make it anyone's. ${PROPOSE(it, n(q))}`);
        if (!p && q.checked && person(x, q)) return deny(`Anaxi's gate: ${it.id} is held, and this adds "${q.text}" (${q.level}) already answered, but it's a person's to decide. Add it unchecked, with your answer as → proposed: …, and ask the user.`);
      }
      // a person's open question removed or reworded away, and the gate would open: that decides it too
      const gone = it.checklist.filter((p) => !p.checked && person(it, p) && !x.checklist.some((q) => q.text === p.text));
      if (gone.length && gate(m2, x).ready) return deny(`Anaxi's gate: this edit removes ${it.id}'s open person decision "${gone[0].text}" and would open its gate without the user deciding. ${PROPOSE(it, it.checklist.indexOf(gone[0]) + 1)}`);
    }
    return;
  }

  const blocking = gateFor(model, rel);
  if (!blocking.length) return;
  const doc = (f) => path.relative(cwd, path.resolve(cfg.root, f));
  deny([`Anaxi's gate: ${path.relative(cwd, abs)} is where ${blocking.map((b) => b.id).join(', ')} will be built, and ${blocking.length > 1 ? "they aren't" : "it isn't"} designed enough yet.`,
    ...blocking.map((b) => `- ${b.id} (${b.title}, ${doc(b.file)}): ${b.depth} of ${b.target || '—'}; ${b.why.join('; ')}`),
    `Every file under ${[...new Set(blocking.flatMap((b) => model.byId.get(b.id)?.codePaths || []))].map((p) => path.relative(cwd, path.resolve(cfg.root, p))).join(', ')} is refused until then, so stop trying files there. Don't write this code, and don't look for another way to write it (no shell commands, no other path). Draft the missing design as proposals on the open questions, or ask the user to decide them; build once the gate passes. ${LIFT}`].join('\n'));
});
