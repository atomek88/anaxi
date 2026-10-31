// Settings: method defaults → profile → anaxi.json (PROFILES.md §1). Item fields are applied by the engine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOME = process.env.ANAXI_HOME;
export const METHOD_DIR = HOME
  ? path.resolve(HOME)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// The ladder. A project can rename levels, redefine "done when", drop the top ones or add D5, D6… in anaxi.json
// (`levels`); settingsFor() rewrites LEVELS in place so every module sees the project's ladder.
export const LEVELS = ['D0', 'D1', 'D2', 'D3', 'D4'];
export const top = () => LEVELS.length - 1;
export const lv = (s) => (s == null ? null : LEVELS.indexOf(s));
export const LV = (n) => (n == null || n < 0 ? null : LEVELS[Math.min(n, top())]);

export const DEFAULTS = {
  profile: 'default',
  stage: 'pre-build',
  docs: ['**/*.md'],
  ignore: [],
  shared: 'shared',
  questions: 'anaxi-questions.md',
  index: 'INDEX.md',
  archive: 'archive', // superseded and retired docs moved out of the way; RETIRED.md in it lists deleted ids
  out: '_anaxi',
  sections: {},
  levels: {
    D0: { name: 'Why', done: 'someone could argue for or against doing it' },
    D1: { name: 'What', done: 'QA could write the acceptance tests' },
    D2: { name: 'Shape', done: 'a lead could estimate it and find the risky part' },
    D3: { name: 'Contract', done: 'two people could build the two sides separately' },
    D4: { name: 'Build', done: 'an agent could build it without asking' },
  },
  rubric: {
    factors: { base: ['blast', 'reversibility', 'novelty', 'certainty'], add: [] },
    floors: {},
    thresholds: { D1: [0, 1], D2: [2, 3], D3: [4, 5], D4: [6, 8] },
  },
  targets: { min: null, max: null, rules: [] },
  caps: {
    focus: { now: null, next: 'D2', later: 'D1' },
    stage: { discovery: 'D1', shaping: 'D2' },
  },
  nudges: { off: [], severity: {}, untaggedWords: 80, levelWords: 10 },
  hooks: { sessionStart: true, afterEdit: false, codeMap: true }, // the Claude Code plugin's hooks
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function merge(a, b) {
  if (!isObj(a) || !isObj(b)) return b === undefined ? a : b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(a[k]) ? merge(a[k], v) : v;
  return out;
}

export function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`${p}: ${e.message}`);
  }
}

export function loadProfile(name) {
  const p = path.join(METHOD_DIR, 'profiles', `${name}.json`);
  if (!fs.existsSync(p)) throw new Error(`unknown profile "${name}" (no ${p})`);
  return readJson(p);
}

// Where a project keeps its design folder when anaxi.json isn't at the repo root: the docs stay in one folder, with
// their settings, and nothing outside it changes.
export const DESIGN_DIRS = ['docs/design', 'docs', 'design', 'doc', '.anaxi'];

/** Find anaxi.json searching upward from `start`, then in `start`'s design folder (DESIGN_DIRS, first match). The project
 *  root is its folder (or `start` if none). */
export function findRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'anaxi.json'))) return { root: dir, file: path.join(dir, 'anaxi.json') };
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  for (const d of DESIGN_DIRS) {
    const f = path.join(path.resolve(start), d, 'anaxi.json');
    if (fs.existsSync(f)) return { root: path.dirname(f), file: f };
  }
  return { root: path.resolve(start), file: null };
}

/** Settings for a project: defaults, then its profile, then its anaxi.json. */
export function loadConfig(start) {
  const { root, file } = findRoot(start);
  const project = file ? readJson(file) : {};
  return { root, file, ...settingsFor(project) };
}

export function settingsFor(project) {
  const profile = loadProfile(project.profile || 'default');
  const merged = merge(merge(DEFAULTS, profile), project);
  merged.profile = project.profile || 'default';
  merged.core = profile.core || {}; // the profile's changes to core; the project's come from anaxi-questions.md
  setLevels(merged);
  return merged;
}

/** Apply `levels` (null drops a level). They must run D0, D1, … with no gaps. */
function setLevels(cfg) {
  for (const [k, v] of Object.entries(cfg.levels || {})) if (v == null) delete cfg.levels[k];
  const keys = Object.keys(cfg.levels).sort((a, b) => a.slice(1) - b.slice(1));
  keys.forEach((k, i) => {
    if (k !== `D${i}`) throw new Error(`anaxi.json: levels must be D0, D1, … with no gaps (got ${keys.join(', ')})`);
  });
  if (keys.length < 2) throw new Error('anaxi.json: a ladder needs at least two levels');
  LEVELS.splice(0, LEVELS.length, ...keys);
}

/** Settings for one item with `profile:` set: its profile's targets and rubric, over the project's. */
export function itemSettings(cfg, profileName) {
  if (!profileName || profileName === cfg.profile) return cfg;
  const p = loadProfile(profileName);
  return merge(cfg, { rubric: p.rubric || {}, targets: p.targets || {}, nudges: p.nudges || {} });
}

export function factorNames(cfg) {
  return [...cfg.rubric.factors.base, ...(cfg.rubric.factors.add || []).map((f) => f.id)];
}

// Minimal glob: ** (any folders), * (within a name), ?. Paths are relative with '/'.
export function globRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.claude']);

/** Every markdown file under root matching `docs`, minus `ignore`, the questions file, the index, the output folder
 *  and any folder with its own anaxi.json (a separate project). */
export function docFiles(cfg) {
  const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const res = list(cfg.docs).map(globRe);
  const ign = list(cfg.ignore).map(globRe);
  const exclude = new Set([cfg.questions, cfg.index, retiredFile(cfg)].filter(Boolean).map((p) => path.normalize(p)));
  const inArchive = (r) => cfg.archive && (r + '/').startsWith(`${path.normalize(cfg.archive)}/`);
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(cfg.root, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || path.normalize(r) === path.normalize(cfg.out) || ign.some((x) => x.test(r) || x.test(`${r}/`))) continue;
        if (fs.existsSync(path.join(cfg.root, r, 'anaxi.json'))) continue;
        walk(r);
      } else if (r.endsWith('.md') && !exclude.has(path.normalize(r)) && (res.some((x) => x.test(r)) || inArchive(r)) && !ign.some((x) => x.test(r))) out.push(r);
    }
  };
  walk('');
  return out.sort();
}

/** The archive's list of deleted ids (ROADMAP step 6): `<archive>/RETIRED.md`. */
export const retiredFile = (cfg) => (cfg.archive ? path.posix.join(cfg.archive, 'RETIRED.md') : null);
