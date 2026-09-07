# Why each gate exists — sources

Every citation was checked against its primary source on 2026-09-07 (title, venue, year, the quoted
finding). A threshold that is a tool default or a practitioner number says so; nothing here is presented
as stronger than its grade.

Grade: **P** peer-reviewed · **R** technical report / standard · **V** vendor or practitioner · **B** book.

| Gate | Source | Grade | Finding used |
|---|---|---|---|
| all | Kaner & Bond, "Software Engineering Metrics: What Do They Measure and How Do We Know?", METRICS 2004 — https://kaner.com/pdfs/metrics2004.pdf | P | construct validity: say what the number measures and how you know |
| all | Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS 2023 — https://arxiv.org/abs/2306.05685 | P | position, verbosity, self-enhancement bias in LLM judges |
| all | Panickssery, Bowman, Feng, "LLM Evaluators Recognize and Favor Their Own Generations", NeurIPS 2024 | P | self-preference bias scales with self-recognition |
| tamper | Zhong, Raghunathan, Carlini, "ImpossibleBench", arXiv:2510.20270, 2025 | P (preprint) | GPT-5 cheats on 76% of SWE-bench tasks whose tests contradict the spec |
| tamper | METR, "Recent Frontier Models Are Reward Hacking", 2025-06-05; "Frontier Risk Report", 2026-05-19 — metr.org | R | models patch evaluators; checking for cheating is most of the work |
| tamper | Denison et al., "Sycophancy to Subterfuge", arXiv:2406.10162, 2024 | P (preprint) | reward tampering generalises from simpler gaming (mechanism) |
| tamper | Zhang & Mesbah, "Assertions Are Strongly Correlated with Test Suite Effectiveness", ESEC/FSE 2015 — doi:10.1145/2786805.2786858 | P | assertions, not statement coverage, predict effectiveness |
| G0 | Rigby & Bird, "Convergent Contemporary Software Peer Review Practices", ESEC/FSE 2013 — doi:10.1145/2491411.2491444 | P | median change 25–78 lines; 2 reviewers optimal; ~15–21 h turnaround |
| G0 | Cohen (ed.), *Best Kept Secrets of Peer Code Review*, SmartBear 2006, "Code Review at Cisco Systems" | V | < 200 LOC, never > 400; < 60 min, never > 90 |
| G1 | Gao, Bird, Barr, "To Type or Not to Type", ICSE 2017 — doi:10.1109/ICSE.2017.75 | P | 15% of public JS bugs detectable by TypeScript (CI 11.5–18.5%) |
| G2 | Zimmermann, Weißgerber, Diehl, Zeller, "Mining Version Histories to Guide Software Changes", ICSE 2004 / TSE 2005 — doi:10.1109/TSE.2005.72 | P | co-change prediction: 26% of files, > 70% top-3 hit rate |
| G2 | Chidamber & Kemerer, TSE 1994 — doi:10.1109/32.295895; Henry & Kafura, TSE 1981 — doi:10.1109/TSE.1981.231113 | P | coupling / fan-out as risk |
| G3 | Fucci et al., "A Dissection of the Test-Driven Development Process", TSE 2017 — doi:10.1109/TSE.2016.2616877 | P | granularity + uniformity matter; order does not |
| G3 | Fucci et al., "An External Replication on the Effects of Test-driven Development", ESEM 2016 — doi:10.1145/2961111.2962592 | P | randomized, blind: no test-first vs test-last difference |
| G3 | Nagappan, Maximilien, Bhat, Williams, ESE 2008 — doi:10.1007/s10664-008-9062-z | P (observational) | 40–90% lower pre-release defect density reported; 15–35% time is an estimate |
| G4 | Rothermel & Harrold, "A Safe, Efficient Regression Test Selection Technique", TOSEM 1997 — doi:10.1145/248233.248262 | P | definition of safe selection |
| G4 | Gligoric, Eloussi, Marinov, "Practical Regression Test Selection with Dynamic File Dependencies", ISSTA 2015 — doi:10.1145/2771783.2771784 | P | file-dependency RTS; 32% avg time saved |
| G5 | McCabe, "A Complexity Measure", TSE 1976 — doi:10.1109/TSE.1976.233837 | P | cyclomatic complexity; upper bound 10 |
| G5 | Watson & McCabe, NIST SP 500-235 *Structured Testing*, 1996 | R | 10, up to 15 with written justification |
| G5 | Campbell, *Cognitive Complexity*, SonarSource white paper (2016, v1.7 2023); TechDebt 2018 — doi:10.1145/3194164.3194186 | V / P | the metric; 15 is SonarQube rule S3776's default |
| G5 | Savoia & Evans, "Pardon My French, But This Code Is C.R.A.P.", Artima 2007 | V | CRAP formula; threshold 30 "a starting point" |
| G6 | DeMillo, Lipton, Sayward, "Hints on Test Data Selection", IEEE Computer 1978 — doi:10.1109/C-M.1978.218136 | P | mutation analysis; coupling effect |
| G6 | Inozemtseva & Holmes, "Coverage Is Not Strongly Correlated with Test Suite Effectiveness", ICSE 2014 — doi:10.1145/2568225.2568271 | P | why not coverage |
| G6 | Just et al., "Are Mutants a Valid Substitute for Real Faults?", FSE 2014 — doi:10.1145/2635868.2635929 | P | mutants ↔ real faults, independent of coverage |
| G6 | Petrović & Ivanković, "State of Mutation Testing at Google", ICSE-SEIP 2018 — doi:10.1145/3183519.3183521 | P (industry) | diff-based, 1 mutant/line, arid lines, AOR/LCR/ROR/SBR/UOI |
| G6 | Petrović, Ivanković, Fraser, Just, "Does mutation testing improve testing practices?", ICSE 2021 — doi:10.1109/ICSE43902.2021.00087; "Practical Mutation Testing at Scale", TSE 2021 — doi:10.1109/TSE.2021.3107634 | P | exposure → more tests; 70% of high-priority bugs coupled |
| G7 | Zeller, *Why Programs Fail*, Morgan Kaufmann 2005 / 2009 | B | reproduce first; scientific debugging loop |
| G7 | Ambler & Sadalage, *Refactoring Databases*, Addison-Wesley 2006; Sato, "ParallelChange", martinfowler.com 2014 | B / V | transition period; expand → migrate → contract |
| G8/QA | Bacchelli & Bird, "Expectations, Outcomes, and Challenges of Modern Code Review", ICSE 2013 | P | defects 14% of comments; value is understanding + transfer |
| QA | Luo, Hariri, Eloussi, Marinov, "An Empirical Analysis of Flaky Tests", FSE 2014 — doi:10.1145/2635868.2635920 | P | async wait 45%, concurrency 20%, order dependency 12% |
| later | Forsgren, Humble, Kim, *Accelerate*, IT Revolution 2018 | B | four key metrics incl. change failure rate — the outcome layer, deferred |

Caution for the README: Berger et al., "On the Impact of Programming Languages on Code Quality: A Reproduction
Study", TOPLAS 2019 — the broad "static typing → fewer defects" association did not survive reproduction. Cite Gao
et al.'s 15% for JS specifically; do not generalise it.
