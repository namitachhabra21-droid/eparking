> Historical prototype documentation. The current application has an authenticated API and persistent PostgreSQL storage; see ../../README.md and ../fullstack.md. Measurements and defect descriptions below refer to the original frontend version.

# Software Engineering Lab — ParkFlow (E-Parking Management System)

All twelve experiments use one case study: **ParkFlow**, the multi-facility parking
management web app in this repository. Diagrams are written in Mermaid. They render on GitHub,
in VS Code with a Mermaid preview extension, and at <https://mermaid.live>.

| # | Experiment | File |
|---|---|---|
| 1 | Problem statement, Agile process model, requirements | [01-problem-statement.md](01-problem-statement.md) |
| 2 | Software Requirement Specification (SRS) | [02-srs.md](02-srs.md) |
| 3 | Effort & cost estimation (FP, COCOMO) | [03-estimation.md](03-estimation.md) |
| 4 | Use case diagram & scenarios | [04-use-cases.md](04-use-cases.md) |
| 5 | Class & sequence diagrams | [05-class-sequence.md](05-class-sequence.md) |
| 6 | E-R, state-chart & activity diagrams | [06-er-state-activity.md](06-er-state-activity.md) |
| 7 | Coding implementation | [07-implementation.md](07-implementation.md) |
| 8 | DevOps, cloud, virtualization | [08-devops.md](08-devops.md) |
| 9 | Software quality, SQA, CMM | [09-quality.md](09-quality.md) |
| 10 | Test case development & implementation | [10-test-cases.md](10-test-cases.md) |
| 11 | Test coverage & structural complexity | [11-coverage-complexity.md](11-coverage-complexity.md) |
| 12 | Test suites & Selenium | [12-selenium.md](12-selenium.md) |

## Running the practical parts

```bash
npm install          # installs selenium-webdriver (dev only)
npm start            # serve the app at http://localhost:3000
npm test             # 24 unit tests            (Experiment 10)
npm run coverage     # coverage report          (Experiment 11)
npm run test:e2e     # 73 Selenium tests, headless Chrome (Experiment 12)
python3 scripts/estimate.py  # measured LOC, FP worksheet, COCOMO/cost report (Experiment 3)
```

Experiment 3 uses the delivered website source, with explicit assumptions for
function points and cost. Its [report](03-estimation.md),
[reviewed inputs](estimation-inputs.json) and
[machine-readable results](results/estimation.json) can be reproduced with the
command above. Python 3, Perl and network access are required; use
`--cloc /path/to/cloc-2.06.pl` with a local pinned copy for offline execution.
