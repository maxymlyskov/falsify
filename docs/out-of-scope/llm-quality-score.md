# Out of scope — an LLM "code quality 1–10" gate

Not built. Two reasons. Construct: nobody can say what a 7 measures or how they would know (Kaner & Bond,
METRICS 2004). Evaluator: LLM judges favour their own output (Panickssery, Bowman & Feng, NeurIPS 2024)
and show position and verbosity bias (Zheng et al., NeurIPS 2023); the model that wrote the code is the
worst-placed grader of it.

What stands in its place: deterministic gates with named defect classes, and a fresh QA agent that is
handed the reasoning and told to falsify it, reporting only evidence-cited findings.

Would reopen if: a judge with measured agreement against real post-merge outcomes on this pipeline's own
runs existed — which requires outcome tracking first (see `outcome-tracking.md`).
