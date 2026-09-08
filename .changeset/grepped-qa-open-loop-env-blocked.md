---
"falsify": patch
---

`/falsify:task` — three fixes to the back half of the run:

- QA agents grep every test run from the task's own `it()` names. No whole spec file, no whole suite: G4
  already ran the specs that can regress this round, so a QA rerun cost minutes and proved nothing.
- Only `HIGH` ends the loop. `MEDIUM`, `LOW` and `NOT SHIPPABLE` all return to the battery, no PR opens
  below `HIGH` without the user's word, and the score step is never left without `HIGH` or an explicit
  answer.
- A gate or QA check whose tool is missing, unconfigured or not running prints `ENV_BLOCKED` and asks the
  user (`references/gates.md` §Environment) instead of being absorbed as `[—]`, `[B]` or `UNVERIFIED`.
  `[—]` now means structurally inapplicable and nothing else.
