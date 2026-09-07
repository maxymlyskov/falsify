# ADR-0005 — Ship as a Claude Code plugin; keep the contract portable

**Status:** accepted · 2026-09-07

## Context

The first draft of this repo (Sep 2) was a patterns document: "nothing to install, port it into your
harness". A pattern with no runnable artifact cannot be tested, cannot be installed in one line, and
cannot show a scorecard from a real run. A plugin can. But a plugin locks the idea to one CLI.

## Decision

Both. `skills/task/references/contract.md` is the implementation-agnostic checklist (verdicts, probe,
worklist, scope, halt codes) and stays readable without Claude Code. The plugin (`.claude-plugin/`,
`skills/`, `bin/`) is the reference implementation of that contract for Claude Code, installable with
`/plugin marketplace add maxymlyskov/burden` and configured once per repo by `/burden:setup`.

Structure follows the plugin documentation: `skills/<name>/SKILL.md` (not `commands/`), gate CLIs in
`bin/` so they are on PATH while the plugin is enabled, heavy material in `references/` loaded on demand.
Repo hygiene follows mattpocock/skills: ADRs, an out-of-scope ledger, changesets, one human-facing doc per
skill, a setup skill that interviews rather than a config file to hand-edit.

## Consequences

- A Codex manifest (`agents/openai.yaml`) per skill is possible later without changing the contract.
- `bin/*` are zero-dependency Node scripts and are testable in isolation from any agent.
- Everything repo-specific (tracker, test command, base branch, UI, invariants) is a key in
  `.claude/burden.config.json`, written by `setup` after verifying each answer by running it.

## Evidence

Anthropic, *Create plugins* (code.claude.com/docs/en/plugins): components at plugin root, `skills/` over
`commands/`, `bin/` on PATH, `claude plugin validate`. mattpocock/skills: `.agents/adr/`, `.out-of-scope/`,
`setup-matt-pocock-skills`.
