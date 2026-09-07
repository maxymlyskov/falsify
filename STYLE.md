# Skill file style guide

Reference for anyone editing a `SKILL.md` or a prompt under `skills/`. Apply the rubric; cite the
canonical examples when in doubt. `scripts/check-skills.sh` enforces the parts a script can check.

## Frontmatter contract

Every `SKILL.md` starts with YAML frontmatter:

```yaml
---
name: <kebab-case; becomes /falsify:<name>>
description: <one sentence, third person, says what AND when; <=160 chars; this is the trigger>
argument-hint: <args spec; appears in autocomplete>
allowed-tools: <scoped tool filters; the narrowest set that works>
---
```

Optional, only when needed:
- `disable-model-invocation: true` — only a person can start it. Every skill that writes, commits, or
  posts carries this.
- `user-invocable: false` — reference material, hidden from the `/` menu.
- `model: opus | sonnet | haiku` — aliases, never dated model ids.

## Body structure

Read-only one-shot skills MAY use just:

1. `## Context` — pre-fetched state (`` !`<bash>` `` injection, `@<path>` includes). Never narration.
2. `## Your task` — imperative instructions, numbered.

Any skill that mutates state (branch, commit, PR, post, edit) OR spans more than one shell call MUST have,
in this order:

3. `## Inputs` — typed `$ARGUMENTS` slots. Each has a name, type, required/optional, and a verbatim halt
   message if invalid. No "you should check" — only "if X, halt with `<message>`".
4. `## Steps` — every decision reduces to a literal command + pattern match. Replace adjectives ("risky",
   "critical", "safe") with greppable regex or a script exit code.
5. `## Output` — a fenced template with literal headers. The model fills slots; it does not reshape it.
6. `## Halt rules` — every ALL_CAPS halt code with its verbatim message, plus the catch-all: `If any fact
   required by a step is not in a captured command output → halt with MISSING_FACT: <name>. Do not infer.`
7. `## Self-check before reporting DONE` — one to five bullets re-read before declaring success.
8. `## Anti-rambling` — the two verbatim lines below.

No `## Overview`, no `## When to use` (frontmatter handles that), no `## Tips`.

Heavy material — recipes, tables, incident notes, sources — lives in `references/` and is read only when
a step names the file. A `SKILL.md` is the flow, not the manual.

## Argument substitution

- `$ARGUMENTS` — full argument string as typed; `$1`, `$2` positional.
- Multi-word args must be quoted at invocation: `/falsify:task "two words" three`.

## Prompts for subagents (`skills/*/prompts/*.md`)

- Every `{{SLOT}}` a prompt uses appears in the owning skill's placeholder table with its source and the
  step that fills it. `grep -oh "{{[A-Z_]*}}"` over the prompts must equal that table.
- A subagent receives the slice it needs and nothing else — never the raw ticket, never the thread.
- A prompt states its report format as a fenced template.

## Voice

- Imperative. "Read X, then do Y." Not "you should consider reading X."
- No role preamble ("You are an expert in…").
- No marketing prose. Every sentence sets context, names a tool or file, or issues a verb.
- No emojis, no ASCII banners, no verdict tables built from ✅/❌ — use first-match-wins conditional text.
- A rule that exists because of an incident links the incident (`references/incidents.md`). A threshold
  states its provenance (`references/why.md`).

## Length budget

- One-shot skills: under 60 lines.
- Multi-phase orchestration: 150 lines max, enforced. Longer means the manual leaked into the flow —
  move it to `references/`.

## Canonical examples

Anthropic's production commands, read before writing or editing:

- [`commit.md`](https://github.com/anthropics/claude-code/blob/main/plugins/commit-commands/commands/commit.md) — 18 lines; `!`-injection, scoped `allowed-tools`, anti-rambling clause.
- [`review-pr.md`](https://github.com/anthropics/claude-code/blob/main/plugins/pr-review-toolkit/commands/review-pr.md) — `argument-hint` + `$ARGUMENTS` + subagent dispatch; the first 60 lines.

In this repo: `skills/setup/SKILL.md` is the canonical interview; `skills/task/SKILL.md` the canonical
orchestration.

## Anti-patterns

- Frontmatter without `description` or `allowed-tools` → not surfaced, prompts on every Bash call.
- "You are a [role]" preamble → wasted tokens.
- Bullet trees of nouns → checklist for a human, not instructions for a model. Convert to imperatives.
- Restating the skill's purpose in `## Context` → context is pre-fetched state, not narration.
- A rule in prose that a script could check → write the script (ADR-0002).

## Anti-rambling clause

When behaviour matters (commits, PRs, posts, mutations), end the task section with:

```
Do not use any other tools or do anything else.
Do not send any other text or messages besides these tool calls.
```
