#!/usr/bin/env node
// Angular commit convention check. Zero dependencies.
// Usage:
//   node scripts/check-commit-msg.mjs <file>            # commit-msg hook: file holds the message
//   node scripts/check-commit-msg.mjs --range [a..b]    # CI: every commit in the range (default origin/main..HEAD)
// Header: <type>(<scope>)?: <subject>   ≤ 72 chars, imperative, no trailing period, lower-case subject start.
// Body lines ≤ 100 chars, separated from the header by a blank line.
// Footer: "BREAKING CHANGE: ..." and/or references ("Closes #12", "Refs ADR-0003") and trailers.

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TYPES = ['build', 'chore', 'ci', 'docs', 'feat', 'fix', 'perf', 'refactor', 'revert', 'style', 'test'];
const HEADER = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9][a-z0-9-]*\\))?(!)?: [a-z0-9\`'"\\[].*[^.]$`);

function check(message) {
  const problems = [];
  const lines = message.replace(/\r/g, '').split('\n').filter((l) => !l.startsWith('#'));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const [header, sep, ...rest] = lines;
  if (!header) return ['empty message'];
  if (header.length > 72) problems.push(`header is ${header.length} chars (max 72)`);
  if (!HEADER.test(header)) {
    problems.push(`header must match <type>(<scope>)?: <subject> with type in {${TYPES.join(', ')}}, subject lower-case, no trailing period — got "${header}"`);
  }
  if (rest.length && sep !== '') problems.push('blank line required between header and body');
  for (const line of rest) {
    if (line.length > 100 && !/https?:\/\//.test(line)) problems.push(`body line over 100 chars: "${line.slice(0, 40)}…"`);
  }
  return problems;
}

function main() {
  const [arg, range] = process.argv.slice(2);
  if (arg === '--range') {
    const r = range || 'origin/main..HEAD';
    const shas = execSync(`git rev-list --no-merges ${r}`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    let failed = 0;
    for (const sha of shas) {
      const msg = execSync(`git log -1 --format=%B ${sha}`, { encoding: 'utf8' });
      const problems = check(msg);
      if (problems.length) {
        failed++;
        console.error(`✘ ${sha.slice(0, 7)} ${msg.split('\n')[0]}`);
        for (const p of problems) console.error(`    ${p}`);
      }
    }
    console.log(`${shas.length - failed}/${shas.length} commits conform`);
    process.exit(failed ? 1 : 0);
  }
  const msg = readFileSync(arg, 'utf8');
  const problems = check(msg);
  if (problems.length) {
    console.error('Commit message rejected (Angular convention, see CONTRIBUTING.md):');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

main();
