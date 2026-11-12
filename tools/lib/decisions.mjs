// Who decides, and who decided (@decided): the list of an item's questions with who decides each, the one edit that
// records an answer (`decide`, shared by anaxi-check, the reader and later MCP), and who answered what, from git.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { whoDecides } from './config.mjs';
import { gate, dependents } from './engine.mjs';

const isBuilt = (it) => it.built === 'yes' || it.built === 'partly';
/** The gate holds it: not built, code planned, not ready. */
export const isHeld = (model, it) => !isBuilt(it) && it.codePaths?.length > 0 && !gate(model, it).ready;

/** An item's questions, numbered from 1 in the order they're written, with who decides each. */
export function questionsOf(model, it) {
  return it.checklist.map((q, i) => ({ n: i + 1, item: it.id || it.title, key: it.key, file: q.file || it.file, line: q.line, level: q.level,
    text: q.text, decideBy: whoDecides(it.cfg || model.cfg, q), checked: q.checked,
    proposal: !q.checked && q.answer ? q.answer.replace(/^proposed:\s*/i, '') : null, ...(q.decided ? { decided: q.decided } : {}) }));
}

/** Open questions across items, each with what answering it would help unblock, sorted by that. */
export function openDecisions(model, items = model.items) {
  const notReady = (x) => !isBuilt(x) && !gate(model, x).ready;
  const out = [];
  for (const it of items) {
    const unblocks = [...new Set([it, ...dependents(model, it).map((d) => d.item)].filter(notReady).map((x) => x.id || x.title))];
    for (const q of questionsOf(model, it)) if (!q.checked) out.push({ ...q, unblocks: notReady(it) ? unblocks : [] });
  }
  return out.sort((a, b) => b.unblocks.length - a.unblocks.length || (a.decideBy === 'person' ? -1 : 0) - (b.decideBy === 'person' ? -1 : 0));
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const gitName = (cwd) => { try { return execFileSync('git', ['config', 'user.name'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

/** One question line, answered: `[ ]` → `[x]`, `→ proposed: …` → `→ decided: who day: answer`. */
export function answerLine(line, answer, who, day = today()) {
  const m = line.match(/^(\s*[-*+]\s+)\[ \](\s+)(.*)$/);
  if (!m) throw new Error('that question is already answered');
  const am = m[3].match(/^(.*?)\s+(?:→|->)\s+(.*)$/);
  const q = am ? am[1] : m[3];
  return `${m[1]}[x]${m[2]}${q} → decided: ${who} ${day}: ${answer}`;
}

/**
 * Record an answer to question n of an item. `answer` is the text, or null with `accept` to take the proposal.
 * Returns { file, line, before, after }; writes unless dryRun.
 */
export function decide(model, it, n, { answer = null, accept = false, who, dryRun = false } = {}) {
  const q = questionsOf(model, it).find((x) => x.n === Number(n));
  if (!q) throw Object.assign(new Error(`${it.id || it.title} has no question ${n} (anaxi-check decisions ${it.id || ''} lists them)`), { code: 1 });
  if (q.checked) throw Object.assign(new Error(`question ${n} of ${it.id || it.title} is already answered`), { code: 1 });
  if (!who) throw Object.assign(new Error('no name to record: pass --as NAME, or set git config user.name'), { code: 2 });
  const text = accept ? q.proposal : answer;
  if (!text) throw Object.assign(new Error(accept ? `question ${n} has no proposal to accept` : 'give the answer, or --accept the proposal'), { code: 2 });
  const abs = path.join(model.cfg.root, q.file), lines = fs.readFileSync(abs, 'utf8').split('\n');
  const before = lines[q.line - 1], after = answerLine(before, text, who);
  lines[q.line - 1] = after;
  if (!dryRun) fs.writeFileSync(abs, lines.join('\n'));
  return { file: q.file, line: q.line, before, after };
}

const AGENTS = /claude|codex|cursor|copilot/i;
/** Answered questions with who answered them and the flags: agent-ticked (a person's question, answered by an agent:
 *  its name says `(agent)`, or no name and an agent's Co-Authored-By on the commit that wrote the line), agent-recorded
 *  (a person's name, written in an agent's commit: check they said it) and unrecorded (no `decided:` name). */
export function decidedReport(model, items = model.items) {
  const root = model.cfg.root, extra = (model.cfg.decisions?.agentTrailers || []).map((r) => new RegExp(r, 'i'));
  const git = (args) => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
  const commits = new Map();
  const commitOf = (file, line) => {
    const b = git(['blame', '--porcelain', '-L', `${line},${line}`, '--', file]);
    const sha = b?.split(' ')[0];
    if (!sha || /^0+$/.test(sha)) return null;
    if (!commits.has(sha)) {
      const body = git(['show', '-s', '--format=%an%x00%B', sha]) || '';
      const [author, msg = ''] = body.split('\0');
      const trailers = msg.split('\n').filter((l) => /^co-authored-by:/i.test(l));
      commits.set(sha, { sha: sha.slice(0, 8), author: author.trim(), agent: trailers.some((t) => AGENTS.test(t) || extra.some((r) => r.test(t))) });
    }
    return commits.get(sha);
  };
  const out = [];
  for (const it of items) for (const q of questionsOf(model, it)) {
    if (!q.checked) continue;
    const c = commitOf(q.file, q.line), flags = [];
    if (q.decideBy === 'person' && (q.decided?.agent || (c?.agent && !q.decided))) flags.push('agent-ticked');
    else if (q.decideBy === 'person' && c?.agent) flags.push('agent-recorded'); // a person's name, written in an agent's commit
    if (!q.decided) flags.push('unrecorded');
    out.push({ ...q, by: q.decided?.by || c?.author || null, day: q.decided?.day || null, commit: c, flags });
  }
  return out;
}
