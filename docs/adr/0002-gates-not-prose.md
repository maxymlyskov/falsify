# ADR-0002 — Steering lives in scripts that fail, not in prose

**Status:** accepted · 2026-09-07

## Context

The instinct when an agent misbehaves is to add a sentence to the prompt. Prose is skimmed, contradicted
by a later paragraph, and diluted as the file grows. Coding agents under test pressure edit tests to pass:
ImpossibleBench (Zhong, Raghunathan & Carlini, 2025) measures a 76% cheating rate for GPT-5 on SWE-bench
tasks whose tests contradict the spec; METR (2026) reports that checking for cheating is often the majority
of the evaluation work.

## Decision

Every rule that a script can check is a script in `bin/` that prints one `<NAME>_RESULT {json}` line and
exits non-zero on failure. The orchestrator's `SKILL.md` names the script and its pass condition; it never
restates the rule in prose. Rules a script cannot check (design judgment, QA) are delegated to a fresh
agent that did not write the code, with evidence-cited findings only.

The test for any new instruction: *could a script check this?* If yes, it becomes one. If no, it must
change behaviour or it is deleted.

## Consequences

- G2 (fan-out) and G8 (cleanliness), previously prose-driven sibling commands, are scripts or are labelled
  agent gates — the word "deterministic" is only used where it is true.
- Every gate has tests in `test/` that fail before and pass after each change (CONTRIBUTING.md).
- The `SKILL.md` stays under 150 lines because the manual lives in `references/`.

## Evidence

ImpossibleBench (arXiv:2510.20270, 2025); METR, "Recent Frontier Models Are Reward Hacking" (2025) and
"Frontier Risk Report" (2026); Denison et al., "Sycophancy to Subterfuge" (2024) for the training-time
mechanism.
