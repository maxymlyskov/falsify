'use strict';
// Shared helpers for the run-record files the Stop hook reads (`.claude/.cache/falsify-run-*.json` in
// the repository under test — shape in skills/task/references/scorecard.md). The only writers of the
// fields the hook reads are bin/runrec (question | halt | end | score) and bin/stop-hook itself
// (session claim, stop bookkeeping, halt on NO_PROGRESS/STOP_BUDGET/OVER_BUDGET).

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

function recordsDir(root) {
  return path.join(root, '.claude', '.cache');
}

// [{file, rec}] for every falsify-run-*.json under recordsDir(root) that parses and has no `ended`.
// A missing cache dir or an unparsable file is not an error here — it just isn't an open record.
function listOpen(root) {
  let names;
  try { names = fs.readdirSync(recordsDir(root)); } catch (e) { return []; }
  const out = [];
  for (const name of names) {
    if (!/^falsify-run-.+\.json$/.test(name)) continue;
    const file = path.join(recordsDir(root), name);
    let rec;
    try { rec = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { continue; }
    if (rec.ended) continue;
    out.push({ file, rec });
  }
  return out;
}

function save(file, rec) {
  fs.writeFileSync(file, `${JSON.stringify(rec, null, 2)}\n`);
}

function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex');
}

// sha1 of the working tree's deviation from HEAD, run in `root`. Empty string (not a thrown error) when
// git itself fails — an untracked scratch dir given as `root` still gets a stable, hashable fingerprint.
function treeHash(root) {
  let text = '';
  try {
    text += execSync('git status --porcelain', { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    text += execSync('git diff HEAD', { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { text = ''; }
  return sha1(text);
}

// Fingerprint of "everything that would make re-scoring or re-stopping produce a different answer":
// which steps have started, how many grill rounds ran, every gate's tier/round/pass, the last recorded
// score/verdict, any halt, and the working tree. `score` and `verdict` are read as plain score.score /
// score.verdict (not the whole `rec.score` object) so this never has to hash its own output: bin/runrec
// computes this fingerprint before it decides what to put in rec.score.fingerprint, and any later
// recomputation (by bin/stop-hook, once rec.score is fully saved) reads the same two primitives and gets
// the same hash, as long as nothing else about the run changed.
function fingerprint(rec, root) {
  const steps = Object.keys(rec.steps || {})
    .filter((k) => rec.steps[k] && rec.steps[k].started)
    .sort((a, b) => Number(a) - Number(b));
  const gates = Object.entries(rec.gates || {})
    .map(([name, g]) => [name, (g && g.tier) || null, (g && g.round) || null, !!(g && g.result && g.result.pass)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const payload = {
    steps,
    rounds: rec.rounds || 0,
    gates,
    score: rec.score ? rec.score.score : null,
    verdict: rec.score ? rec.score.verdict : (rec.verdict || null),
    halt: rec.halt || null,
    tree: treeHash(root),
  };
  return sha1(JSON.stringify(payload));
}

module.exports = { recordsDir, listOpen, save, fingerprint };
