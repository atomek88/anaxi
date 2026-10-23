// The question set: core (QUESTIONS.md §4), the profile's and project's changes, project questions (§5.1).
import fs from 'node:fs';
import path from 'node:path';
import { METHOD_DIR, lv } from './config.mjs';
import { splitTop } from './parse.mjs';

const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

/** Rows of the table under `### Core` in QUESTIONS.md. */
export function readCore(file = path.join(METHOD_DIR, 'QUESTIONS.md')) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const at = lines.findIndex((l) => /^###\s+Core\b/.test(l));
  if (at < 0) throw new Error(`${file}: no "### Core" table`);
  const out = [];
  for (let i = at + 1; i < lines.length && !/^#{1,3}\s/.test(lines[i]); i++) {
    if (!lines[i].startsWith('|')) continue;
    const [id, text, why] = cells(lines[i]);
    if (!/^D\d\.[\w-]+$/.test(id)) continue; // header and separator rows
    out.push({ id, level: id.slice(0, 2), text, why, source: 'core' });
  }
  return out;
}

/** The project's `anaxi-questions.md`: Added, Changes to core, Principles. Missing file → empty. */
export function readProject(file) {
  const res = { added: [], reword: {}, skipAll: {}, principles: [], errors: [] };
  if (!file || !fs.existsSync(file)) return res;
  let section = null, n = 0;
  const text = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')); // comments are notes
  text.split('\n').forEach((line, i) => {
    const h = line.match(/^##\s+(.*)$/);
    if (h) { section = h[1].trim().toLowerCase(); return; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (!li) return;
    const where = `${path.basename(file)}:${i + 1}`;
    const body = li[1].trim();
    if (section === 'added') {
      const parts = splitTop(body, '·');
      let id = null, level = null;
      const head = parts.shift() || '';
      const idm = head.match(/^\*\*(D\d)\.([\w-]+)\*\*$/) || head.match(/^(D\d)\.([\w-]+)$/);
      if (idm) { level = idm[1]; id = `${idm[1]}.${idm[2]}`; }
      else if (/^D\d$/.test(head)) { level = head; id = `${head}.p${++n}`; }
      else { res.errors.push(`${where}: an added question starts with its level or ID (e.g. "**D2.pci** · …")`); return; }
      const q = { id, level, text: parts.shift() || '', when: [], why: null, optional: false, source: 'project' };
      for (const p of parts) {
        const kv = p.match(/^(when|why):\s*(.*)$/);
        if (kv?.[1] === 'when') q.when = splitTop(kv[2]).map((x) => x.toLowerCase());
        else if (kv?.[1] === 'why') q.why = kv[2];
        else if (p === 'opt') q.optional = true;
      }
      res.added.push(q);
    } else if (section === 'changes to core') {
      const rw = body.match(/^reword:\s*(D\d\.[\w-]+)\s*(?:→|->)\s*(.+)$/);
      const sk = body.match(/^skip-all:\s*(D\d\.[\w-]+)\s*(?:·\s*(.*))?$/);
      if (rw) res.reword[rw[1]] = rw[2].trim();
      else if (sk) {
        if (!sk[2]?.trim()) res.errors.push(`${where}: skip-all: ${sk[1]} needs a reason ("skip-all: ID · reason")`);
        res.skipAll[sk[1]] = sk[2]?.trim() || null;
      } else res.errors.push(`${where}: a change to core is "reword: ID → text" or "skip-all: ID · reason"`);
    } else if (section === 'principles') {
      res.principles.push(body);
    }
  });
  return res;
}

/** The full set for a project: core with profile then project changes, plus project questions. */
export function questionSet(cfg) {
  const core = readCore();
  const project = readProject(cfg.questions ? path.join(cfg.root, cfg.questions) : null);
  const reword = { ...(cfg.core?.reword || {}), ...project.reword };
  const skipAll = { ...(cfg.core?.['skip-all'] || {}), ...project.skipAll };
  const errors = [...project.errors];
  for (const id of [...Object.keys(reword), ...Object.keys(skipAll)]) {
    if (!core.some((q) => q.id === id)) errors.push(`anaxi-questions.md: "${id}" is not a core question`);
  }
  const list = core.map((q) => ({ ...q, text: reword[q.id] || q.text, reworded: !!reword[q.id],
    skippedAll: q.id in skipAll ? skipAll[q.id] || '(no reason)' : null }));
  const onLadder = (q) => lv(q.level) >= 0; // core questions for a level the project dropped don't apply
  return { list: [...list, ...project.added].filter(onLadder), principles: project.principles, errors };
}

/** Questions that apply to one item: skip-all and `when:` filtered, item `skip:` marked. */
export function questionsFor(item, set) {
  const skips = Object.fromEntries((item.skip || []).map((s) => [s.id, s.reason]));
  return set.list
    .filter((q) => !q.skippedAll)
    .filter((q) => !q.when?.length || q.when.some((t) => item.about.includes(t)))
    .map((q) => ({ ...q, skipped: q.id in skips ? skips[q.id] || '(no reason)' : null }));
}
