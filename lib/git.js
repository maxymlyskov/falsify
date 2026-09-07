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
function changedFiles(ref, { cwd = process.cwd(), exts = null } = {}) {
  const root = repoRoot(cwd);
  const base = mergeBase(ref, root);
  const extOk = (p) => !exts || exts.some((e) => p.endsWith(e));
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

function readAt(ref, p, cwd) {
  try { return sh(`git show ${ref}:${JSON.stringify(p)}`, cwd); } catch (e) { return null; }
}

module.exports = { sh, repoRoot, mergeBase, parseUnifiedDiff, changedFiles, readAt };
