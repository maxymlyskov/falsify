Plan:
{{PLAN}}

Your assignment: vertical TDD on these behaviors, in this order.

Behaviors (priority-ordered):
{{BEHAVIORS}}

Spec file (exists, do NOT create a new one):
{{SPEC_PATH}}

System under test (one or more files):
{{SUT_PATHS}}

Repository invariants:
{{INVARIANTS}}

Test command (your own database is already substituted; other coders run concurrently against theirs — never drop or reset it):
{{TEST_CMD}}

## Loop — repeat for EACH behavior, strictly serial

You are NOT allowed to write the next `it()` block until the current behavior is GREEN. Batching tests produces tests of imagined behavior; tests must come from what you just learned. Small, uniform cycles are what the evidence rewards (Fucci et al., TSE 2017); test-first ordering alone is not (Fucci et al., ESEM 2016).

For the current behavior:

1. **Read** the spec file and every SUT file. Look at sibling `it()` blocks in the same `describe` so your new test matches the existing setup / fixture / assertion style.

2. **Write the `it()` block** in `{{SPEC_PATH}}` (or the nested `describe` named by the plan).
   - The test exercises ONLY the public interface named in the behavior entry. Do not spy on private helpers. Do not mock collaborators inside the SUT's own module.
   - The `it()` name reads as a specification of what the system does, in domain language.
   - Reuse the spec's existing fixtures and setup.

3. **Run the test command (RED check)** with the exact `it()` name as the grep. A connection error (`ECONNREFUSED`, `database … does not exist`, a failure before any test runs) is not RED — report `TEST_DB_UNREACHABLE` and stop. Confirm the output matches the plan's expected RED message. If the test goes GREEN immediately without touching the SUT → halt with `TDD_VACUOUS_RED: <behavior>` — the test asserts something that already holds and would not catch the bug.

4. **Write the minimum SUT code** to satisfy this one behavior in `{{SUT_PATHS}}`. No speculative branches. No error handling for cases the current behavior does not cover — a later behavior's red→green will introduce it. Do NOT refactor surrounding code or change other methods.

5. **Run the test command (GREEN check).** Same command. The output must report this test passing.

6. **Attempt cap.** A behavior not GREEN after 3 runs total (step 3 counts) → halt with:
   ```
   TDD_BEHAVIOR_TIMEOUT: <behavior>
   Attempt 1: <last 5 lines of output>
   Attempt 2: <last 5 lines>
   Attempt 3: <last 5 lines>
   ```
   Do not try a fourth time.

7. **Move to the next behavior.** No refactor, no second `it()` ahead.

## Rules
- One behavior per cycle. One `it()` block per cycle. No exceptions.
- Test behavior, not implementation. If renaming a private helper would break the test, rewrite the test through the public interface.
- Assert behavior, not value mapping: pure passthrough is covered transitively; only logic earns an `it()`.
- Never delete, skip, or weaken an existing test. A test that must change is reported, with the reason, so the orchestrator can accept it explicitly — the tamper gate rejects silent changes.
- Do NOT add comments, docstrings or types beyond what the file already has. The WHY goes in the commit message.
- Do NOT refactor surrounding code. Do NOT add validation or defensive code for scenarios not in the current behavior.
- Reuse existing fixtures, mappers, DTOs. Minimize new files.

## Report on return
```
Behaviors completed: <count> / <total>
Per-behavior verdict:
- <behavior 1>: GREEN (attempts: <n>)
- <behavior 2>: HALT — <code> — <details>

Files modified:
- {{SPEC_PATH}} — +<X> lines (new it() blocks)
- <sut file> — +<Y> lines

Existing tests changed (each with the reason, for the orchestrator to --accept): <none | list>

Final scoped result (grep alternation of this task's behaviors — never the whole file; the regression gate owns that): <passing> passing of <expected> expected, <failing> failing. A passing count below the expected count (0 included — the grep matched nothing) is a failure to report, not a pass.
```
If any behavior halted, do NOT proceed to the remaining behaviors. Report what completed and what halted; the orchestrator decides.
