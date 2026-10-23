#!/usr/bin/env node
// strata-check — validates Strata-layered docs, renders views, traces impact, exports the graph.
// Zero dependencies, Node 18+. Convention: STRATA.md (same folder).
//
//   node strata-check.mjs <dir>                          check: profile, branches, findings (exit 1 on errors)
//   node strata-check.mjs <dir> --view 2 [--root ID]     render nodes down to depth 2
//   node strata-check.mjs <dir> --gate TF.intake         is this subtree buildable? (exit 1 when blocked)
//   node strata-check.mjs <dir> --impact TF.kv-store [--hops 1]   everything that depends on this subtree
//   node strata-check.mjs <dir> --export json|mermaid|html [--out file]
//   node strata-check.mjs <dir> --update-ledger          append new IDs to strata.ids
//   node strata-check.mjs --selftest                     examples pass; examples/broken trips every rule

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Kinds and their rank. Depth 0–2 are anchored; from depth 3 the kind may only stay or move down the ranks.
const KIND_RANK = { intent: 0, system: 1, capability: 2, resource: 2, architecture: 3, contract: 4, build: 5 };
const DEEP_KINDS = new Set(['architecture', 'contract', 'build']);

const DEFAULTS = {
  budgets: {
    intent: [10, 100], system: [30, 250], capability: [60, 400], resource: [40, 400],
    architecture: [150, 900], contract: [300, 1800], build: [400, 4000],
  },
  growth: [2, 8],
  vendorTerms: [],
  vendorFreeKinds: ['intent', 'system', 'capability'],
  codeFreeKinds: ['intent', 'system', 'capability', 'resource', 'architecture'],
  diagramKinds: ['capability', 'resource', 'architecture'],
  decisionKinds: ['architecture', 'contract'],
};

const NODE_RE = /^#{1,6}\s+([A-Z][A-Z0-9]*\.[a-z0-9][a-z0-9-]*)\s+·\s+(.+?)\s*$/;
const DEC_RE = /^#{1,6}\s+(D-[A-Z][A-Z0-9]*-\d+)\s+·\s+(.+?)\s*$/;
const Q_RE = /^\s*[-*]\s+(⚑|✓)\s+(Q-[A-Z][A-Z0-9]*-\d+)\b/;
const REF_RE = /\[\[([^\]\s]+)\]\]/g;
const FENCE_RE = /^\s*(```|~~~)\s*([\w-]*)/;
const META_RE = /^>\s*[\w-]+:/;
const HEADING_RE = /^#{1,6}\s/;
const STATES = new Set(['draft', 'settled', 'verified', 'parked']);

const list = (v) => (v ? v.split(/\s*,\s*/).filter(Boolean) : []);
const countWords = (lines) => lines.join(' ').split(/\s+/).filter(Boolean).length;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tag = (n) => `[L${n.depth ?? '?'}·${n.kind ?? '?'}]`;

function loadConfig(dir) {
  const p = path.join(dir, 'strata.config.json');
  const cfg = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  return { ...DEFAULTS, ...cfg, budgets: { ...DEFAULTS.budgets, ...(cfg.budgets || {}) } };
}

function parseMeta(line) {
  const meta = {};
  for (const part of line.replace(/^>\s*/, '').split(/\s+·\s+/)) {
    const m = part.match(/^([\w-]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return meta;
}

function parseLinks(v) {
  return list(v).map((s) => {
    const m = s.match(/^([\w-]+)\s*(?:→|->)\s*(\S+)$/);
    return m ? { type: m[1], to: m[2] } : { type: '?', to: s, malformed: true };
  });
}

function parseDir(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
  const nodes = [];
  const defs = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    let cur = null;
    let dec = null;
    let inFence = false;
    lines.forEach((line, i) => {
      const loc = `${file}:${i + 1}`;
      const fence = line.match(FENCE_RE);
      if (fence) {
        if (!inFence && cur) cur.fences.push({ lang: fence[2], loc });
        inFence = !inFence;
        if (cur) { cur.body.push(line); if (dec) dec.text.push(line); }
        return;
      }
      if (!inFence) {
        const nm = line.match(NODE_RE);
        if (nm) {
          cur = { id: nm[1], title: nm[2], file, line: i + 1, loc, meta: {}, awaitMeta: true,
            body: [], prose: [], fences: [], refs: [], decisions: [], openQ: [], children: [] };
          nodes.push(cur);
          dec = null;
          defs.push({ id: cur.id, kind: 'node', node: cur, loc });
          return;
        }
        if (!cur) return;
        if (cur.awaitMeta && line.trim() !== '') {
          cur.awaitMeta = false;
          if (META_RE.test(line)) { cur.meta = parseMeta(line); return; }
        }
        const dm = line.match(DEC_RE);
        if (dm) {
          dec = { id: dm[1], title: dm[2], node: cur, loc, text: [] };
          cur.decisions.push(dec);
          defs.push({ id: dm[1], kind: 'decision', node: cur, loc });
          cur.body.push(line);
          return;
        }
        if (HEADING_RE.test(line)) dec = null;
        const qm = line.match(Q_RE);
        if (qm) {
          defs.push({ id: qm[2], kind: 'question', node: cur, loc });
          if (qm[1] === '⚑') cur.openQ.push(qm[2]);
        }
        for (const r of line.matchAll(REF_RE)) cur.refs.push({ id: r[1], loc });
        cur.prose.push(line);
      }
      if (cur) { cur.body.push(line); if (dec) dec.text.push(line); }
    });
  }
  return { nodes, defs };
}

function readTombstones(dir) {
  const map = new Map();
  const p = path.join(dir, '_tombstones.md');
  if (!fs.existsSync(p)) return map;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*[-*]\s+(\S+)\s+(?:→|->)\s+(\S+)/);
    if (m) map.set(m[1], m[2] === 'retired' ? null : m[2]);
  }
  return map;
}

function readLedger(dir) {
  const p = path.join(dir, 'strata.ids');
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
}

const subtree = (n) => [n, ...n.children.flatMap(subtree)];
const leavesOf = (n) => (n.children.length ? n.children.flatMap(leavesOf) : [n]);

function check(dir) {
  const cfg = loadConfig(dir);
  const { nodes, defs } = parseDir(dir);
  const tomb = readTombstones(dir);
  const ledger = readLedger(dir);
  const findings = [];
  const add = (code, loc, msg, node) => findings.push({ code, sev: code[0], loc, msg, node: node?.id });

  // S01 — every ID is defined once
  const defById = new Map();
  for (const d of defs) {
    if (defById.has(d.id)) add('S01', d.loc, `duplicate ID ${d.id} (first defined at ${defById.get(d.id).loc})`, d.node);
    else defById.set(d.id, d);
  }
  const nodeById = new Map();
  for (const n of nodes) if (defById.get(n.id)?.node === n) nodeById.set(n.id, n);
  const live = [...nodeById.values()];

  // Tree: parents resolve (S03), state is valid (S14)
  for (const n of live) {
    n.words = countWords(n.body);
    if (!STATES.has(n.meta.state)) add('S14', n.loc, `${n.id} needs state: draft | settled | verified | parked`, n);
    if (!n.meta.up) continue;
    const p = nodeById.get(n.meta.up);
    if (!p) { add('S03', n.loc, `${n.id} up: ${n.meta.up} does not exist (orphan)`, n); continue; }
    n.parent = p;
    p.children.push(n);
  }

  // Depth comes from the tree, never from the ID. Kind is declared or defaulted from depth and parent.
  const roots = live.filter((n) => !n.meta.up);
  const assign = (n, depth) => {
    n.depth = depth;
    const declared = n.meta.kind;
    if (declared && !(declared in KIND_RANK)) add('S14', n.loc, `${n.id} kind "${declared}" is not one of ${Object.keys(KIND_RANK).join(', ')}`, n);
    n.kind = declared && declared in KIND_RANK ? declared
      : depth === 0 ? 'intent' : depth === 1 ? 'system' : depth === 2 ? 'capability'
      : DEEP_KINDS.has(n.parent.kind) ? n.parent.kind : 'architecture';
    n.children.forEach((c) => assign(c, depth + 1));
  };
  roots.forEach((r) => assign(r, 0));
  for (const n of live) {
    if (n.depth === undefined && n.parent) add('S03', n.loc, `${n.id} is not connected to a root (its ancestor chain is broken or cyclic)`, n);
  }
  const placed = live.filter((n) => n.depth !== undefined);

  // S02 — anchored kinds at depth 0–2; below that, kinds only move toward build
  for (const n of placed) {
    const expect = n.depth === 0 ? ['intent'] : n.depth === 1 ? ['system'] : n.depth === 2 ? ['capability', 'resource'] : null;
    if (expect && !expect.includes(n.kind)) add('S02', n.loc, `${n.id} is at L${n.depth} so it must be ${expect.join(' or ')}, not ${n.kind}`, n);
    if (!expect && !DEEP_KINDS.has(n.kind)) add('S02', n.loc, `${n.id} is at L${n.depth}; below L2 a node is architecture, contract or build, not ${n.kind}`, n);
    if (!expect && n.parent && KIND_RANK[n.kind] < KIND_RANK[n.parent.kind]) {
      add('S02', n.loc, `${n.id} is ${n.kind} under ${n.parent.kind} ${n.parent.id}; along a path kinds only move toward build`, n);
    }
  }

  const resolve = (id, loc, ctx, node) => {
    if (defById.has(id)) return defById.get(id);
    if (tomb.has(id)) {
      const to = tomb.get(id);
      add('W04', loc, `${ctx} ${id} is tombstoned → ${to ?? 'retired'}; update the reference`, node);
      return to ? defById.get(to) : null;
    }
    add('S04', loc, `${ctx} ${id} does not resolve`, node);
    return null;
  };

  const branchOf = (n) => {
    let x = n;
    while (x && x.depth > 2) x = x.parent;
    return x && x.depth === 2 ? x : null;
  };
  const exempt = (b) => b.kind === 'resource' || b.meta.scope === 'cross-cutting';
  const l2pairs = new Set();
  for (const n of placed) {
    if (n.depth !== 2) continue;
    for (const l of parseLinks(n.meta.links)) { l2pairs.add(`${n.id}|${l.to}`); l2pairs.add(`${l.to}|${n.id}`); }
  }

  const edges = [];
  for (const n of placed) {
    for (const r of n.refs) resolve(r.id, r.loc, 'reference', n);

    // S04 / S10 — links resolve, and cross-branch links are visible at L2
    for (const l of parseLinks(n.meta.links)) {
      if (l.malformed) { add('S14', n.loc, `malformed link "${l.to}"; use type→ID`, n); continue; }
      const d = resolve(l.to, n.loc, `link ${l.type}→`, n);
      if (!d) continue;
      if (d.kind !== 'node') { add('S04', n.loc, `link ${l.type}→${l.to} must target a node, not a ${d.kind}`, n); continue; }
      edges.push({ from: n.id, to: d.node.id, type: l.type, rel: 'link' });
      const a = branchOf(n);
      const b = branchOf(d.node);
      if (a && b && a !== b && !exempt(a) && !exempt(b) && !l2pairs.has(`${a.id}|${b.id}`)) {
        add('S10', n.loc, `ghost edge: ${n.id} ${l.type}→${d.node.id} crosses ${a.id} ↔ ${b.id}, but no L2 link connects those branches`, n);
      }
    }

    // S04 / S13 — decided-by cites a decision made higher up
    for (const id of list(n.meta['decided-by'])) {
      const d = resolve(id, n.loc, 'decided-by', n);
      if (!d) continue;
      if (d.kind !== 'decision') { add('S04', n.loc, `decided-by ${id} is a ${d.kind}, not a decision`, n); continue; }
      edges.push({ from: n.id, to: d.node.id, type: id, rel: 'decided-by' });
      if (d.node.depth >= n.depth) add('S13', n.loc, `${n.id} (L${n.depth}) cites ${id}, made at L${d.node.depth}; decisions bind downward only`, n);
    }

    // S04 / G02 — a parked node waits for its triggers; once they settle, it is due to deepen
    const triggers = list(n.meta['grow-when']);
    const resolved = triggers.map((id) => resolve(id, n.loc, 'grow-when', n)).filter(Boolean);
    for (const d of resolved) if (d.kind === 'node') edges.push({ from: n.id, to: d.node.id, type: 'grow-when', rel: 'grow-when' });
    if (n.meta.state === 'parked' && triggers.length && resolved.length === triggers.length &&
        resolved.every((d) => d.kind === 'node' && ['settled', 'verified'].includes(d.node.meta.state))) {
      add('G02', n.loc, `${n.id} is parked until ${triggers.join(', ')}, which ${triggers.length > 1 ? 'are' : 'is'} now settled: deepen it`, n);
    }

    // S06 — vendor names stay out of intent, system and capability nodes
    if (cfg.vendorFreeKinds.includes(n.kind)) {
      const prose = n.prose.join('\n').replace(REF_RE, '');
      for (const term of cfg.vendorTerms) {
        if (new RegExp(`(^|[^\\w])${escapeRe(term)}(?![\\w])`).test(prose)) {
          add('S06', n.loc, `altitude leak: ${n.kind} node ${n.id} names "${term}"; technology names belong in resource, architecture or deeper nodes`, n);
        }
      }
    }

    // S07 — code only in contract and build nodes (diagrams allowed from capability down)
    if (cfg.codeFreeKinds.includes(n.kind)) {
      for (const f of n.fences) {
        if (!(f.lang === 'mermaid' && cfg.diagramKinds.includes(n.kind))) {
          add('S07', f.loc, `code block (${f.lang || 'plain'}) in the ${n.kind} node ${n.id}; code belongs in contract or build nodes`, n);
        }
      }
    }

    // S08 / S09 — decisions live in architecture/contract nodes and record what was rejected
    for (const d of n.decisions) {
      if (!cfg.decisionKinds.includes(n.kind)) add('S08', d.loc, `${d.id} is decided in the ${n.kind} node ${n.id}; decisions live in architecture or contract nodes. Raise it, or record a "Local choice:"`, n);
      if (!/Rejected:/i.test(d.text.join('\n'))) add('S09', d.loc, `${d.id} has no "Rejected:" line`, n);
    }

    // S12 — open questions keep a node out of settled/verified
    if (n.openQ.length && ['settled', 'verified'].includes(n.meta.state)) {
      add('S12', n.loc, `${n.id} is ${n.meta.state} with open ${n.openQ.join(', ')}`, n);
    }

    // S11 / W01 — size budget per kind (parked nodes are allowed to be thin)
    const [min, max] = cfg.budgets[n.kind] || [0, Infinity];
    if (n.words > max) add('S11', n.loc, `${n.id} has ${n.words} words; the ${n.kind} ceiling is ${max}. Split it into siblings`, n);
    else if (n.words < min && n.meta.state !== 'parked') add('W01', n.loc, `${n.id} has ${n.words} words; the ${n.kind} floor is ${min}`, n);
  }

  // W02 — children together hold 2–8× the parent (intent → system is a translation and exempt)
  for (const n of placed) {
    if (n.depth < 1 || !n.children.length) continue;
    n.growth = n.children.reduce((s, c) => s + c.words, 0) / Math.max(n.words, 1);
    const [lo, hi] = cfg.growth;
    if (n.growth < lo) add('W02', n.loc, `${n.id} children hold ${n.growth.toFixed(1)}× its words (< ${lo}×): the level below adds too little`, n);
    if (n.growth > hi) add('W02', n.loc, `${n.id} children hold ${n.growth.toFixed(1)}× its words (> ${hi}×): the parent no longer summarizes them; enrich or split it`, n);
  }

  // S14 / G01 — needs: <kind> is optional; when set, every non-parked leaf must reach that kind
  for (const n of placed) {
    if (!n.meta.needs) continue;
    const want = n.meta.needs;
    if (!DEEP_KINDS.has(want)) { add('S14', n.loc, `${n.id} needs: ${want}; use architecture, contract or build`, n); continue; }
    for (const leaf of leavesOf(n)) {
      if (leaf.meta.state === 'parked') continue;
      if (KIND_RANK[leaf.kind] < KIND_RANK[want]) add('G01', leaf.loc, `depth gap: ${leaf.id} stops at ${leaf.kind}; ${n.id} needs ${want}`, leaf);
    }
  }

  // S05 / W03 — the ledger is append-only: nothing ever issued may vanish
  for (const [from, to] of tomb) if (to && !defById.has(to)) add('S04', '_tombstones.md', `tombstone ${from} → ${to} points nowhere`);
  if (ledger) {
    const L = new Set(ledger);
    for (const id of L) if (!defById.has(id) && !tomb.has(id)) add('S05', 'strata.ids', `${id} was issued but is neither defined nor tombstoned; every link to it is now broken`);
    for (const [id, d] of defById) if (!L.has(id)) add('W03', d.loc, `${id} is not in the ledger; run --update-ledger`, d.node);
  } else {
    add('W03', 'strata.ids', 'no ledger yet; run --update-ledger');
  }

  return { dir, cfg, nodes: placed, roots, nodeById, defById, edges, findings, branchOf };
}

function branchRows(r) {
  return r.nodes.filter((n) => n.depth === 2).map((b) => {
    const sub = subtree(b);
    const ids = new Set(sub.map((n) => n.id));
    const leaves = leavesOf(b);
    const has = (codes) => r.findings.filter((f) => codes.includes(f.sev) && ids.has(f.node)).length;
    const drafts = sub.filter((n) => n.meta.state === 'draft').length;
    const parked = sub.filter((n) => n.meta.state === 'parked').length;
    const openQ = sub.reduce((s, n) => s + n.openQ.length, 0);
    const errors = has(['S']);
    const gaps = has(['G']);
    return {
      b, nodes: sub.length, errors, gaps, drafts, parked, openQ,
      depth: `L${Math.min(...leaves.map((l) => l.depth))}–L${Math.max(...leaves.map((l) => l.depth))}`,
      status: errors || gaps || drafts || openQ ? 'blocked' : parked ? 'parked' : 'ready',
    };
  });
}

function report(r) {
  const E = r.findings.filter((f) => f.sev === 'S');
  const G = r.findings.filter((f) => f.sev === 'G');
  const W = r.findings.filter((f) => f.sev === 'W');
  console.log(`Strata check: ${path.relative(process.cwd(), r.dir) || '.'}\n`);
  const maxDepth = Math.max(...r.nodes.map((n) => n.depth));
  console.log('Depth profile');
  console.log('  depth  nodes   words  kinds');
  for (let d = 0; d <= maxDepth; d++) {
    const ns = r.nodes.filter((n) => n.depth === d);
    const kinds = Object.entries(ns.reduce((a, n) => ({ ...a, [n.kind]: (a[n.kind] || 0) + 1 }), {})).map(([k, c]) => `${k} ${c}`).join(', ');
    console.log(`  L${d}     ${String(ns.length).padStart(5)} ${String(ns.reduce((a, n) => a + n.words, 0)).padStart(7)}  ${kinds}`);
  }
  console.log('\nBranches (L2)          kind        needs         leaves   nodes  draft  parked  ⚑  gaps  status');
  for (const x of branchRows(r)) {
    console.log(`  ${x.b.id.padEnd(21)} ${x.b.kind.padEnd(11)} ${(x.b.meta.needs || '—').padEnd(12)}  ${x.depth.padEnd(7)}  ${String(x.nodes).padStart(5)}  ${String(x.drafts).padStart(5)}  ${String(x.parked).padStart(6)}  ${x.openQ}  ${String(x.gaps).padStart(4)}  ${x.status}`);
  }
  for (const [label, items] of [['Errors', E], ['Depth signals', G], ['Warnings', W]]) {
    if (!items.length) continue;
    console.log(`\n${label} (${items.length})`);
    for (const f of items) console.log(`  ${f.code}  ${f.loc}  ${f.msg}`);
  }
  console.log(`\n${E.length} errors · ${G.length} depth signals · ${W.length} warnings`);
  return E.length === 0;
}

function view(r, max, rootId) {
  const roots = rootId ? [r.nodeById.get(rootId)].filter(Boolean) : r.roots;
  const out = [];
  const walk = (n) => {
    if (n.depth - (roots[0]?.depth ?? 0) > max && rootId) return;
    if (!rootId && n.depth > max) return;
    out.push(`${'#'.repeat(Math.min(n.depth + 1, 6))} ${n.id} · ${n.title}  ${tag(n)}`);
    out.push(`> ${Object.entries(n.meta).map(([k, v]) => `${k}: ${v}`).join(' · ')}`);
    out.push(n.body.join('\n').trim(), '');
    const cut = rootId ? n.depth - roots[0].depth === max : n.depth === max;
    if (cut && n.children.length) out.push(`↳ deeper: ${n.children.map((c) => `[[${c.id}]]`).join(', ')}`, '');
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  console.log(out.join('\n'));
}

function gate(r, id) {
  const root = r.nodeById.get(id);
  if (!root) { console.log(`gate: ${id} not found`); return false; }
  const sub = subtree(root);
  const ids = new Set(sub.map((n) => n.id));
  const blockers = [
    ...r.findings.filter((f) => (f.sev === 'S' || f.sev === 'G') && ids.has(f.node)).map((f) => `${f.code}  ${f.msg}`),
    ...sub.filter((n) => n.meta.state === 'draft').map((n) => `draft   ${n.id}`),
    ...sub.filter((n) => n.meta.state === 'parked').map((n) => `parked  ${n.id}`),
    ...sub.flatMap((n) => n.openQ.map((q) => `⚑       ${q} on ${n.id}`)),
  ];
  console.log(`gate ${id}: ${blockers.length ? 'BLOCKED' : 'READY'} (${sub.length} nodes)`);
  for (const b of [...new Set(blockers)]) console.log(`  ${b}`);
  return blockers.length === 0;
}

// Reverse dependency closure: who links to anything in this subtree, then who links to them, and so on.
function impactOf(r, id, maxHops = Infinity) {
  const root = r.nodeById.get(id);
  if (!root) return null;
  const inbound = new Map();
  for (const e of r.edges) {
    if (e.rel === 'decided-by') continue;
    if (!inbound.has(e.to)) inbound.set(e.to, []);
    inbound.get(e.to).push(e);
  }
  const inside = new Set(subtree(root).map((n) => n.id));
  const seen = new Map();
  let frontier = [...inside];
  for (let dist = 1; frontier.length && dist <= maxHops; dist++) {
    const next = [];
    for (const t of frontier) {
      for (const e of inbound.get(t) || []) {
        if (inside.has(e.from) || seen.has(e.from)) continue;
        seen.set(e.from, { dist, via: e });
        next.push(e.from);
      }
    }
    frontier = next;
  }
  return { root, inside, hits: [...seen].map(([nid, v]) => ({ node: r.nodeById.get(nid), ...v })) };
}

function impact(r, id, maxHops) {
  const res = impactOf(r, id, maxHops);
  if (!res) { console.log(`impact: ${id} not found`); return; }
  console.log(`impact of ${id} ${tag(res.root)} — ${res.inside.size} nodes in its subtree, ${res.hits.length} dependents outside it\n`);
  for (const h of res.hits.sort((a, b) => a.dist - b.dist || a.node.depth - b.node.depth)) {
    const b = r.branchOf(h.node);
    console.log(`  ${h.dist === 1 ? 'direct  ' : `hop ${h.dist}   `} ${h.node.id.padEnd(24)} ${tag(h.node).padEnd(18)} ${(b ? b.id : '').padEnd(16)} ${h.via.type}→${h.via.to}`);
  }
}

function toGraph(r) {
  const impactCount = (n) => impactOf(r, n.id).hits.length;
  return {
    format: 'strata-graph/1',
    system: r.cfg.system || null,
    source: path.relative(process.cwd(), r.dir),
    generatedAt: new Date().toISOString(),
    nodes: r.nodes.map((n) => ({
      id: n.id, title: n.title, kind: n.kind, depth: n.depth, state: n.meta.state ?? null,
      parent: n.parent?.id ?? null, children: n.children.map((c) => c.id), branch: r.branchOf(n)?.id ?? null,
      file: n.file, line: n.line, words: n.words, needs: n.meta.needs ?? null, scope: n.meta.scope ?? null,
      growWhen: list(n.meta['grow-when']), openQuestions: n.openQ,
      decisions: n.decisions.map((d) => ({ id: d.id, title: d.title })), dependents: impactCount(n),
    })),
    edges: r.edges,
    findings: r.findings.map(({ code, sev, loc, msg, node }) => ({ code, sev, loc, msg, node: node ?? null })),
  };
}

function toMermaid(r) {
  const safe = (id) => id.replace(/[^A-Za-z0-9]/g, '_');
  const out = ['graph LR'];
  for (const n of r.nodes) out.push(`  ${safe(n.id)}["${n.title.replace(/"/g, "'")}<br/><small>L${n.depth} · ${n.kind}</small>"]:::${n.kind}`);
  for (const n of r.nodes) if (n.parent) out.push(`  ${safe(n.parent.id)} --> ${safe(n.id)}`);
  for (const e of r.edges) if (e.rel === 'link') out.push(`  ${safe(e.from)} -. ${e.type} .-> ${safe(e.to)}`);
  for (const e of r.edges) if (e.rel === 'grow-when') out.push(`  ${safe(e.from)} -. grow-when .-> ${safe(e.to)}`);
  out.push('  classDef resource stroke-dasharray:4 2;');
  return out.join('\n');
}

function exportGraph(r, format, outFile) {
  let text;
  if (format === 'json') text = JSON.stringify(toGraph(r), null, 2);
  else if (format === 'mermaid') text = toMermaid(r);
  else if (format === 'html') {
    const template = fs.readFileSync(path.join(HERE, 'strata-viewer.html'), 'utf8');
    const data = JSON.stringify(toGraph(r)).replace(/</g, '\\u003c');
    text = template.replace('const EMBEDDED = null;', `const EMBEDDED = ${data};`);
  } else { console.error(`unknown export format ${format}; use json, mermaid or html`); process.exit(2); }
  if (outFile) { fs.writeFileSync(outFile, text); console.log(`wrote ${outFile}`); } else console.log(text);
}

function updateLedger(dir, r) {
  const p = path.join(dir, 'strata.ids');
  const existing = readLedger(dir) || [];
  const have = new Set(existing);
  const missing = [...r.defById.keys()].filter((id) => !have.has(id));
  const header = fs.existsSync(p) ? '' : '# Strata ID ledger: append-only. Never delete a line; tombstone the ID in _tombstones.md instead.\n';
  fs.appendFileSync(p, header + missing.map((s) => `${s}\n`).join(''));
  console.log(`ledger: +${missing.length} IDs (${existing.length + missing.length} total)`);
}

function selftest() {
  const base = path.join(HERE, 'examples');
  let ok = true;
  for (const name of ['taskflow', 'deep']) {
    const r = check(path.join(base, name));
    const errors = r.findings.filter((f) => f.sev === 'S');
    if (errors.length) ok = false;
    console.log(`examples/${name}: ${errors.length ? 'FAIL' : 'PASS'} (${errors.length} errors, ${r.nodes.length} nodes, max depth L${Math.max(...r.nodes.map((n) => n.depth))})`);
    for (const f of errors) console.log(`  ${f.code}  ${f.loc}  ${f.msg}`);
  }
  const bad = check(path.join(base, 'broken'));
  const expected = fs.readFileSync(path.join(base, 'broken', 'EXPECTED'), 'utf8').split(/\s+/).filter(Boolean);
  console.log('examples/broken: each rule must fire');
  for (const code of expected) {
    const hit = bad.findings.find((f) => f.code === code);
    if (!hit) ok = false;
    console.log(`  ${hit ? '✓' : '✗'} ${code}  ${hit ? `${hit.loc}  ${hit.msg}` : 'NOT DETECTED'}`);
  }
  console.log(ok ? '\nSELFTEST PASS' : '\nSELFTEST FAIL');
  return ok;
}

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
if (args.includes('--selftest')) process.exit(selftest() ? 0 : 1);
const withValue = new Set(['--view', '--root', '--gate', '--impact', '--hops', '--export', '--out']);
let target = '.';
for (let i = 0; i < args.length; i++) {
  if (withValue.has(args[i])) { i++; continue; }
  if (!args[i].startsWith('--')) { target = args[i]; break; }
}
const dir = path.resolve(target);
const result = check(dir);
if (args.includes('--update-ledger')) { updateLedger(dir, result); process.exit(0); }
if (opt('--view') !== undefined) { view(result, Number(opt('--view')), opt('--root')); process.exit(0); }
if (opt('--impact')) { impact(result, opt('--impact'), Number(opt('--hops') ?? Infinity)); process.exit(0); }
if (opt('--export')) { exportGraph(result, opt('--export'), opt('--out')); process.exit(0); }
if (opt('--gate')) process.exit(gate(result, opt('--gate')) ? 0 : 1);
process.exit(report(result) ? 0 : 1);
