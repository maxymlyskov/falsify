# Out of scope — a coverage-percentage gate

Not built, deliberately. Coverage says a line executed; it does not say a test would notice if the line
changed. Inozemtseva & Holmes (ICSE 2014) found low-to-moderate correlation between coverage and suite
effectiveness once suite size is controlled; Just et al. (FSE 2014) found mutant detection correlates
with real-fault detection independently of coverage. A percentage is also the single most gameable number
in software — an agent under pressure can raise it without asserting anything.

What stands in its place: G6 mutation (survivor review, no threshold — ADR-0004) and the tamper gate's
"removed expect" rule (Zhang & Mesbah, ESEC/FSE 2015: assertions predict effectiveness).

Would reopen if: per-function coverage became cheaply available in the test runner, in which case the real
CRAP metric (Savoia & Evans 2007, `cc² × (1 − cov)³ + cc`) becomes computable and could inform G5.
