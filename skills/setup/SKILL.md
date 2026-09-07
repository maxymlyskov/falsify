---
name: setup
description: Configure falsify for this repository by interview — tracker, tests, base branch, UI, handoff — verifying every answer by running it. Once per repo.
argument-hint: (no args)
allowed-tools: Bash(git:*), Bash(gh:*), Bash(node:*), Bash(npx:*), Bash(npm:*), Bash(cat:*), Bash(ls:*), Read, Write
disable-model-invocation: true
---

## Context
- Output: `.claude/falsify.config.json` (keys in `../task/references/recipes.md §config`). An existing file is read first; every question is pre-filled with its current value and the diff is printed before writing.
- Detection sources: `package.json` (scripts, devDependencies), lockfile, `tsconfig.json` (root and first-level dirs), `gh repo view --json defaultBranchRef`, `git remote`, `gh auth status`, env (`LINEAR_API_KEY`, `JIRA_*`), `docker-compose*.yml` under `test/`, `.env.example`, `CLAUDE.md`/`AGENTS.md` lines containing `always` / `never`.
- Rule: nothing is written until every verification passed or the user explicitly accepted a failure (recorded as `"verified": "accepted-unverified: <why>"`). A skipped optional section makes the dependent gate report `[—] not configured` — never an error.

## Inputs
- No arguments. Anything after `/falsify:setup` is ignored.

## Steps
Ask one question at a time, detected default first, recommendation and a one-line trade-off. Verify each answer by running it before the next question.
```
1 Tracker       GitHub Issues · Linear · Jira · local files. Detect from gh auth / env. Ask for one real ticket id
                → run tracker.fetch with it → show the title. Writes tracker.{kind, idPattern, fetch, comment}.
2 Test command  Detect runner from devDependencies (mocha/jest/vitest/node:test) → propose test.command with
                {spec} {grep} {db} slots and test.failRegex, test.specGlob. Ask which spec to try → run the
                command with {grep} = one test name from that file → the output must match the runner's pass
                grammar. Writes test.{command, failRegex, specGlob}.
3 Test database Detect docker-compose under test/, DATABASE_URL in .env.example. Ask: setup command (or none),
                readiness check (or none), the env var the suite reads for its database name (or none), a
                create-database command with {db} (or none), a test-database URL for migration proofs (or none).
                Run setup → run readiness → create `<name>_setup_check` → drop it. Writes test.{setup,
                readyCheck, dbNameEnv, dbCreate}, db.url.
4 Git           Detect default branch and remote. Ask base branch, branch template ({id} {slug}), commit template
                ({type} {what} {id}). Run `git fetch <remote> <base>` and `git merge-base <remote>/<base> HEAD`.
                Writes git.{remote, base, branchTemplate, commitTemplate}.
5 Type check    Detect tsconfig roots. Propose typecheck.roots and typecheck.command. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/typegate"
                <base> --roots … --tsc …` → RESULT must be ok:true. Writes typecheck.{roots, command}.
6 UI            Detect playwright / a dev-server script. Ask: screenshot command with {route} {expect} {out}, or
                none. Run it against one route → a PNG exists at {out}; Read it. Writes ui.screenshot.
7 Evidence      Detect `bin/*` or `.claude/skills/*-cli/*.sh`. Ask which are read-only lookups safe for a bug
                investigation; each gets {name, command ({q}), readOnly: true}. Run one with a harmless query.
                Writes evidence[] (may be empty).
8 Handoff       Ask where the diagnosis goes: pr (PR body only) · tracker (tracker.comment) · none; and an optional
                docs directory for learnings. tracker → dry-run: print the comment, post nothing. Writes handoff.
9 Rules         Scan CLAUDE.md / AGENTS.md for always/never lines → propose ≤5 invariants for coders and ≤10 house
                rules for QA; user edits. Ask for static fan-out rules (`when` regex → `expect` templates) or
                none. Writes invariants[], houseRules[], gates.fanout.rules.
10 Thresholds   Show gates.{size 400/200, complexity 10/15, mutation 6/4, fanout 0.5/3/30, regression 2/12,
                clean} with their provenance from ../task/references/why.md; accept or change; a changed
                threshold records `"provenance": "user-set: <reason>"`. Writes gates.
11 Write        Print the full config and the diff vs the existing file. Confirm → write
                `.claude/falsify.config.json` with every `verified` field. Create `.claude/falsify-qa-calibration.md`
                from the template if absent. Add `.claude/.cache/` to .gitignore if missing.
```

## Output
```
## /falsify:setup
tracker     <kind> — verified: <ticket> "<title>"
test        <command> — verified: <spec> → <pass line>
test db     <setup | none> · ready <check | none> · per-agent db <env | none> · migrations <db.url | none>
git         <remote>/<base> · branches <template> · commits <template> — verified: merge-base <sha>
typecheck   roots <…> — verified: TYPES_RESULT base <n> errors
ui          <command | none> — verified: <path.png> | skipped
evidence    <n> read-only tools | none
handoff     <pr | tracker | none> · docs <dir | none>
rules       <n> invariants · <n> house rules · <n> fan-out rules
gates       size <halt>/<warn> · complexity <c>/<g> · mutation <max>/<small> · fanout <conf>/<support>/<window> · regression <depth>/<max> · clean <command | none>
Written: .claude/falsify.config.json   Next: /falsify:task <ticket>
```

## Halt rules
- A verification fails and the user does not accept it → re-ask that question; never write a config with an unverified required key (tracker, test, git, typecheck).
- `gh auth status` fails when GitHub is the tracker or the PR target → halt `GH_NOT_AUTHENTICATED: run gh auth login`.
- If any fact a summary line needs is not in a captured command output → halt with `MISSING_FACT: <name>.` Do not infer.

## Self-check before reporting DONE
- Every key in the config carries a `verified` value (a real result or an explicit `accepted-unverified`).
- No question was asked whose answer the detection step already established with certainty; every question showed its detected default.
- Nothing was posted to the tracker; the handoff verification was a dry run.
- The printed diff matches the written file.

## Anti-rambling
Do not use any other tools or do anything else.
Do not send any other text or messages besides these tool calls.
