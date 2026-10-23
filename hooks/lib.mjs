// Shared by the plugin hooks. Hooks never fail a session or an edit: any problem means "say nothing".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function input() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

/** The project's anaxi.json settings, or null when the folder isn't an Anaxi project. */
export async function project(start) {
  const { findRoot, loadConfig } = await import(path.join(PLUGIN_ROOT, 'tools/lib/config.mjs'));
  if (!findRoot(start).file) return null;
  return loadConfig(start);
}

/** Remember where the plugin lives, so the git pre-commit hook can find the checker (~/.anaxi/home). */
export function rememberHome() {
  try {
    const dir = path.join(os.homedir(), '.anaxi');
    const file = path.join(dir, 'home');
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').trim() === PLUGIN_ROOT) return;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, `${PLUGIN_ROOT}\n`);
  } catch { /* not important enough to complain about */ }
}

export const quiet = (fn) => fn().catch(() => {}).finally(() => process.exit(0));
