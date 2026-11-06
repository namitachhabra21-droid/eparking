# Experiment 9 — Software Quality: Product & Process Quality, SQA, CMM

## Aim
Study software product and process quality, plan Software Quality Assurance for ParkFlow,
and assess the project against the Capability Maturity Model.

## 1. Product quality (ISO/IEC 25010) applied to ParkFlow

| Characteristic | Sub-characteristics | ParkFlow evidence / measure |
|---|---|---|
| Functional suitability | completeness, correctness | SRS traceability (Exp. 2 § 4); 24 unit tests on business rules; 2 open defects (DEF-01/02) |
| Performance efficiency | time behaviour, resource use | No framework; page switch < 1 s; 4 s tick touches ≤ 3 bays |
| Compatibility | interoperability | Standard ES modules; data layer can be swapped for a REST API |
| Usability | learnability, accessibility | ≤ 3-click tasks, Ctrl+K palette, dark mode, `role="dialog"`, Esc closes modals |
| Reliability | maturity, fault tolerance | Seeded data; `metrics()` safe for empty facilities (UT-13) |
| Security | confidentiality, integrity | `esc()` on all interpolated text (XSS); HTTPS via Vercel |
| Maintainability | modularity, testability | 15 JS modules, each < 270 LOC; 100 % line coverage of `store.js` |
| Portability | installability | Static files; Vercel or Docker/nginx |

## 2. Process quality

Process quality is the quality of *how* the software is built. A repeatable,
measured process produces predictable product quality.

| Process area | ParkFlow practice |
|---|---|
| Requirements | User stories + IEEE 830 SRS with IDs |
| Design | UML models before coding (Exp. 4–6) |
| Configuration management | Git; one feature per branch; pull-request review |
| Verification | Code review checklist (below), automated tests in CI |
| Measurement | LOC, FP, coverage, cyclomatic complexity, defect density |
| Improvement | Sprint retrospectives |

## 3. Software Quality Assurance (SQA) plan

**Purpose:** make sure ParkFlow meets its SRS and that the defined process is followed.

| SQA activity | When | Owner | Output |
|---|---|---|---|
| SRS review | Before Sprint 1 | PO + team | Signed-off SRS |
| Design walkthrough | Sprint planning | Team | Updated UML |
| Code review | Every pull request | Peer developer | Approved pull request |
| Unit testing | Every commit | Developer | `npm test` green |
| Coverage gate | CI | CI | ≥ 90 % line coverage of `core/` |
| UI regression | Every pull request | CI | `npm run test:e2e` green |
| Defect tracking | Continuous | QA | Defect log |
| Audit of process | End of each release | SQA lead | Audit report |

### Code review checklist
- [ ] All user-visible strings go through `esc()`
- [ ] New view returns a cleanup function if it subscribes to the store
- [ ] No new runtime dependency
- [ ] Works in light **and** dark theme and at 360 px width
- [ ] Unit or Selenium test added for new behaviour

### Defect log (found during this lab)

| ID | Severity | Module | Description | Status |
|---|---|---|---|---|
| DEF-01 | Major | views/dashboard.js `sessionModal` | **Extend 1h** and **Check Out** only show a toast; the session's `status`, `mins` and `amount` are not changed (FR-3.4) | Open |
| DEF-02 | Major | views/bookings.js | **Check In** and **Cancel Booking** only show a toast; reservation `status` is not changed and the bay is not freed (FR-5) | Open |
| DEF-03 | Minor | views/lotmap.js | **Hold** shows a toast but the bay has no *maintenance* state, unlike the state chart in Exp. 6 | Open |
| DEF-04 | Minor | views/booking.js | The booking wizard ignores the chosen **start time**; arrival is always set to now + 10 min | Open |
| DEF-05 | Trivial | views/lotmap.js | **Reserve Bay** stores plate `PENDING` and doesn't ask for a plate | Open |
| DEF-06 | Minor | app.js `updateMeter` | Sidebar alert badge and Estate Load meter update only on the next 4 s tick (after **Ack**/**Dismiss** or a facility change), not immediately | Open |
| DEF-07 | Major | all views (`#view` listeners) | Each render adds a click listener to the shared `#view` element and never removes it. After leaving a page and coming back, one click opens **two** dialogs (found by Selenium test E2E-DEF-07) | Open |
| DEF-08 | Major | views/booking.js | Choosing a payment method on step 3 repaints the form and **erases the typed name and plate**, so the booking is saved as "Walk-in Guest" with a random plate (found by Selenium test E2E-DEF-08) | Open |

**Defect density** = 8 documented defects / 2.731 measured website KLOC ≈
**2.93 defects/KLOC**. The denominator includes JavaScript, HTML and CSS;
see the reproducible source count in [Experiment 3](03-estimation.md).

### Quality metrics

| Metric | Value |
|---|---|
| Unit tests / pass rate | 24 / 100 % |
| UI (Selenium) tests / pass rate | 15 / 100 % |
| Line / branch / function coverage, `store.js` | 100 % / 99.21 % / 100 % |
| Mean / max cyclomatic complexity | 1.87 / 11 (zone loop in `buildSlots`), see Exp. 11 |
| Defect density | 2.9 / KLOC |

## 4. Capability Maturity Model (CMM / CMMI)

| Level | Name | Characteristics | Key process areas |
|---|---|---|---|
| 1 | Initial | Ad hoc, success depends on individuals | — |
| 2 | Repeatable / Managed | Basic project management; success can be repeated | Requirements mgmt, project planning, tracking, SQA, configuration mgmt |
| 3 | Defined | Organisation-wide standard process | Org. process definition, training, peer reviews, integrated SW mgmt |
| 4 | Quantitatively Managed | Process measured and controlled | Quantitative process mgmt, SW quality mgmt |
| 5 | Optimizing | Continuous process improvement | Defect prevention, technology & process change mgmt |

### ParkFlow self-assessment

| Level 2 KPA | Evidence | Met? |
|---|---|---|
| Requirements management | SRS with IDs + traceability to tests | ✅ |
| Project planning | Release plan, FP/COCOMO estimate | ✅ |
| Project tracking | Sprint burndown (planned) | ◐ |
| SQA | SQA plan, review checklist, defect log | ✅ |
| Configuration management | Git, `main` branch, Vercel deployments | ✅ |
| Subcontract management | N/A | — |

| Level 3 KPA | Evidence | Met? |
|---|---|---|
| Defined process | Definition of Done, CI pipeline designed | ◐ |
| Peer reviews | Pull-request reviews | ◐ |
| Training program | — | ❌ |

**Assessment:** ParkFlow is at **CMM Level 2 (Repeatable)** and moving towards Level 3.
To reach Level 3, document the process as an organisational standard, enforce
pull-request reviews and the CI gate on every change, and add onboarding/training material.

## Result
We assessed product quality with ISO 25010, defined an SQA plan with a code review
checklist and a defect log of 8 real defects, and placed the project at CMM Level 2.
