'use strict';
// Shared git helpers. Every gate diffs against the merge-base of <ref> and HEAD (never the tip of <ref>,
// so a moved base branch cannot make foreign commits look like this branch's changes) and sees
// untracked files as fully added (staging happens after the battery, so new files would otherwise be
// invisible to every gate).

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function sh(cmd, cwd = process.cwd()) {
  return execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}

function repoRoot(cwd = process.cwd()) {
  return sh('git rev-parse --show-toplevel', cwd).trim();
}

function mergeBase(ref, cwd) {
  try { return sh(`git merge-base ${ref} HEAD`, cwd).trim(); } catch (e) { return ref; }
}

// Parse `git diff -U0` into per-file added-line numbers (new side), deleted counts and rename origins.
function parseUnifiedDiff(text) {
  const files = new Map();
  let current = null;
  let oldPath = null;
  for (const line of text.split('\n')) {
    const o = line.match(/^--- (?:a\/(.+)|\/dev\/null)$/);
    if (o) { oldPath = o[1] || null; continue; }
    const n = line.match(/^\+\+\+ (?:b\/(.+)|\/dev\/null)$/);
    if (n) {
      current = n[1] || null;
      if (current) files.set(current, { path: current, oldPath, added: [], deleted: 0 });
      continue;
    }
    if (!current) continue;
    const h = line.match(/^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (h) {
      const start = parseInt(h[2], 10);
      const count = h[3] === undefined ? 1 : parseInt(h[3], 10);
      const del = h[1] === undefined ? 1 : parseInt(h[1], 10);
      const f = files.get(current);
      for (let i = 0; i < count; i++) f.added.push(start + i);
      f.deleted += del;
    }
  }
  return [...files.values()];
}

// Changed files vs the merge-base, tracked and untracked, filtered by extension. Untracked files are
// reported with every line as added so gates that look at "lines this branch added" see them.
function isNodeScript(root, p) {
  const abs = path.join(root, p);
  let firstLine;
  try { firstLine = fs.readFileSync(abs, 'utf8').split('\n', 1)[0]; } catch (e) { return false; }
  return /^#!.*\bnode(js)?\b/.test(firstLine);
}

function changedFiles(ref, { cwd = process.cwd(), exts = null } = {}) {
  const root = repoRoot(cwd);
  const base = mergeBase(ref, root);
  const extOk = (p) => {
    if (!exts) return true;
    if (exts.some((e) => p.endsWith(e))) return true;
    if (exts.includes('.js') && !path.basename(p).includes('.') && isNodeScript(root, p)) return true;
    return false;
  };
  const tracked = parseUnifiedDiff(sh(`git diff ${base} -U0 --no-color`, root)).filter((f) => extOk(f.path));
  const untracked = sh('git ls-files --others --exclude-standard', root)
    .split('\n').map((s) => s.trim()).filter(Boolean).filter(extOk)
    .map((p) => {
      const abs = path.join(root, p);
      const n = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').split('\n').length : 0;
      return { path: p, oldPath: null, added: Array.from({ length: n }, (_, i) => i + 1), deleted: 0, untracked: true };
    });
  return { root, base, files: [...tracked, ...untracked] };
}

// Full -U0 hunk content for one file: added lines with new numbers, removed lines with old numbers.
function parseHunks(text) {
  const added = []; const removed = [];
  let newLine = 0; let oldLine = 0; let inHunk = false;
  for (const line of text.split('\n')) {
    const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) { oldLine = parseInt(h[1], 10); newLine = parseInt(h[2], 10); inHunk = true; continue; }
    if (!inHunk) continue;
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) { added.push({ line: newLine++, text: line.slice(1) }); continue; }
    if (line.startsWith('-')) { removed.push({ line: oldLine++, text: line.slice(1) }); continue; }
    if (line.startsWith('\\')) continue; // "\ No newline at end of file"
    inHunk = false;
  }
  return { added, removed };
}

function readAt(ref, p, cwd) {
  try { return sh(`git show ${ref}:${JSON.stringify(p)}`, cwd); } catch (e) { return null; }
}

// 'own' when the viewer has write access AND the repo is not a fork (a fork's PRs target the parent).
// Anything else — read/triage access, or no answer at all — is 'foreign'.
function ownership(view) {
  if (!view) return 'foreign';
  const hasWrite = ['ADMIN', 'MAINTAIN', 'WRITE'].includes(view.viewerPermission);
  return hasWrite && !view.isFork ? 'own' : 'foreign';
}

// Appends any of `lines` missing from `file` (creating its parent dir if needed) and returns the ones
// actually added this call — [] when every line was already present (idempotent).
function ensureLines(file, lines) {
  let existing = '';
  try { existing = fs.readFileSync(file, 'utf8'); } catch (e) { existing = ''; }
  const have = new Set(existing.split('\n').map((l) => l.trim()));
  const toAdd = lines.filter((l) => !have.has(l));
  if (toAdd.length) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const prefix = existing && !existing.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(file, `${prefix}${toAdd.join('\n')}\n`);
  }
  return toAdd;
}

// Own repos get `.claude/.cache/` in the tracked .gitignore. Foreign repos (fork/read-only/unknown)
// never touch a tracked file — falsify's own paths go in the local, untracked exclude file instead.
function writeIgnores(cwd, kind) {
  if (kind === 'own') {
    const file = path.join(repoRoot(cwd), '.gitignore');
    return { file: '.gitignore', added: ensureLines(file, ['.claude/.cache/']) };
  }
  const rel = sh('git rev-parse --git-path info/exclude', cwd).trim();
  const file = path.resolve(cwd, rel);
  const added = ensureLines(file, ['.claude/falsify.config.json', '.claude/falsify-qa-calibration.md', '.claude/.cache/']);
  return { file, added };
}

module.exports = {
  sh, repoRoot, mergeBase, parseUnifiedDiff, parseHunks, changedFiles, readAt, ownership, writeIgnores,
};
