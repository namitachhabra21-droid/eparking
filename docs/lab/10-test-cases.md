# Experiment 10 — Test Case Development & Implementation

## Aim
Design test cases for ParkFlow with black-box and white-box techniques, implement
them as automated tests, and record the results.

## 1. Test strategy

| Level | Technique | Tool | Location |
|---|---|---|---|
| Unit | White-box (statement/branch), boundary-value, equivalence partitioning | `node:test` + `assert` | [tests/unit/store.test.js](../../tests/unit/store.test.js) |
| System / UI | Black-box, scenario-based (from use cases) | Selenium WebDriver + Chrome | [tests/e2e/](../../tests/e2e/) (9 suites) |
| Manual | Exploratory, for features not yet automated | Browser | § 4 below |

## 2. Test design techniques used

**Equivalence partitioning: `ago(t)`**

| Class | Range of elapsed time | Representative | Expected |
|---|---|---|---|
| Seconds | 0 ≤ s < 60 | 30 s | `30s ago` |
| Minutes | 60 ≤ s < 3600 | 5 min | `5m ago` |
| Hours | 3600 ≤ s < 86400 | 3 h | `3h ago` |
| Days | s ≥ 86400 | 2 d | `2d ago` |

**Boundary value analysis: `compact(n)`**

| n | Expected | Boundary |
|---|---|---|
| 999 | `999` | just below 1 K |
| 1000 | `1.0K` | 1 K |
| 99 999 | `100.0K` | just below 1 L |
| 100 000 | `1.00L` | 1 L (lakh) |
| 10 000 000 | `1.00Cr` | 1 Cr (crore) |

**Boundary value analysis: fare rule** (`max(rate, round(mins/60 × rate))`)
mins < 60 ⇒ amount = rate (one-hour minimum); mins ≥ 60 ⇒ pro-rata. Checked over every generated session (UT-07, UT-08).

## 3. Automated test cases and results

Executed on 27 Oct 2026, macOS, Node 26.7.0, Chrome 156 (headless).

### 3.1 Unit tests: `npm test`

| ID | Suite | Test case | Input | Expected | Result |
|---|---|---|---|---|---|
| UT-01 | Slots | Total bays = Σ capacity | 4 facilities | 680 | ✅ Pass |
| UT-02 | Slots | Each facility gets its capacity | L1..L4 | 180/120/220/160 | ✅ Pass |
| UT-03 | Slots | Remainder to earlier zones | L3 = 220 / 3 | 74, 73, 73 | ✅ Pass |
| UT-04 | Slots | IDs unique & well-formed | all slots | `/^L[1-4]-[A-C]\d{2,}$/` | ✅ Pass |
| UT-05 | Slots | Bay type rule | num % 11, % 17 | ev / acc / std | ✅ Pass |
| UT-06 | Slots | Free bay has no plate/time | free slots | null, null | ✅ Pass |
| UT-07 | Billing | Fare formula | every session | max(rate, round(mins/60·rate)) | ✅ Pass |
| UT-08 | Billing | One-hour minimum | mins < 60 | amount = rate | ✅ Pass |
| UT-09 | Billing | Active session ↔ occupied bay | active sessions | bay occupied | ✅ Pass |
| UT-10 | Metrics | free + occ + res = total | `metrics()` | 680 | ✅ Pass |
| UT-11 | Metrics | Occupancy in [0,100] | all + L1..L4 | 0 ≤ p ≤ 100 | ✅ Pass |
| UT-12 | Metrics | Per-facility totals add up | L1..L4 | = estate total | ✅ Pass |
| UT-13 | Metrics | Unknown facility is zero-safe | `metrics('L9')` | total 0, occPct 0, avgMins 0 | ✅ Pass |
| UT-14 | Format | Rupee + Indian grouping | 1234567 | `₹12,34,567` | ✅ Pass |
| UT-15 | Format | `compact` boundaries | see BVA table | see BVA table | ✅ Pass |
| UT-16 | Format | `dur` at 60 | 0, 59, 60, 135 | 0m, 59m, 1h 0m, 2h 15m | ✅ Pass |
| UT-17 | Format | `ago` partitions | see EP table | see EP table | ✅ Pass |
| UT-18 | Format | `initials` | "Namita Chhabra" | `NC` | ✅ Pass |
| UT-19 | Random | `ri(3,7)` range | 500 draws | 3 ≤ v ≤ 7, integer | ✅ Pass |
| UT-20 | Random | `pick` membership | 100 draws | ∈ array | ✅ Pass |
| UT-21 | Feed | Cap at 40, newest first | 61 pushes | length 40, [0] = latest | ✅ Pass |
| UT-22 | Live | Ticks & idempotent start | mock timer 20 s, `startLive()` × 2 | 5 ticks, total still 680 | ✅ Pass |
| UT-23 | Live | Unsubscribe | subscribe → off → 8 s | 0 calls | ✅ Pass |
| UT-24 | Format | `clock` / `dateStr` | 27 Oct 2026 14:05 | `2:05 pm`, `27 Oct` | ✅ Pass |

```
ℹ tests 24
ℹ suites 6
ℹ pass 24
ℹ fail 0
```

### 3.2 System tests (Selenium): `npm run test:e2e`

The first 15 tests are in [app.e2e.test.js](../../tests/e2e/app.e2e.test.js). The other 58 are in the eight suites listed in [Experiment 12 § 2](12-selenium.md), with results in [results/selenium-run.txt](results/selenium-run.txt).

| ID | Requirement | Test case | Steps | Expected | Result |
|---|---|---|---|---|---|
| E2E-01 | FR-11 | App boots | open `/` | title "Operations Overview" | ✅ Pass |
| E2E-02 | FR-11 | Navigation complete | count `.nav-item` | 9 | ✅ Pass |
| E2E-03 | FR-11 | Route by click | click Sessions | h1 "Parking Sessions", URL `#sessions` | ✅ Pass |
| E2E-04 | FR-11 | Bad route fallback | open `#does-not-exist` | dashboard | ✅ Pass |
| E2E-05 | FR-1.1 | Rail meter | read `#load-val` | `NN%` | ✅ Pass |
| E2E-06 | FR-3.2 | Search | type `SES-8000` | "1 record" | ✅ Pass |
| E2E-07 | FR-3.2 | No match | type `zzzz-no-match` | "No results", "0 records" | ✅ Pass |
| E2E-08 | FR-3.3 | Filter | Status = completed | every row "completed" | ✅ Pass |
| E2E-09 | FR-3.3 | Sort | click Amount twice | ↑ then ↓ | ✅ Pass |
| E2E-10 | FR-3.3 | Paginate | check Prev, click Next | Prev disabled; "2 / N" | ✅ Pass |
| E2E-11 | FR-4.2 | Wizard guard | Continue on step 2 without bay | toast "Pick a bay" | ✅ Pass |
| E2E-12 | FR-4.4 | Full booking | facility → bay → name/plate → Confirm | toast "Booking confirmed"; bay status `reserved` | ✅ Pass |
| E2E-13 | FR-4 | Cancel wizard | click Cancel | modal closed | ✅ Pass |
| E2E-14 | FR-11 | Dark mode persists | toggle, reload | `data-theme="dark"` | ✅ Pass |
| E2E-15 | FR-11 | Command palette | Ctrl+K, "Analytics", click | h1 "Analytics" | ✅ Pass |

```
ℹ tests 15
ℹ suites 4
ℹ pass 15
ℹ fail 0
```

## 4. Manual test cases (features not automated)

| ID | Requirement | Steps | Expected (per SRS) | Actual | Result |
|---|---|---|---|---|---|
| MT-01 | FR-2.3 | Map → click free bay → Reserve Bay | Bay turns reserved, toast | As expected | ✅ Pass |
| MT-02 | FR-2.3 | Map → click occupied bay → Release Bay | Bay turns free | As expected | ✅ Pass |
| MT-03 | FR-3.4 | Sessions → open active session → Check Out | Session status → completed, bay → free | Toast only; record unchanged | ❌ Fail (DEF-01) |
| MT-04 | FR-3.4 | Sessions → open session → Extend 1h | Booked window +60 min | Toast only | ❌ Fail (DEF-01) |
| MT-05 | FR-5 | Reservations → open → Cancel Booking | Status → cancelled, bay freed | Toast only | ❌ Fail (DEF-02) |
| MT-06 | FR-8 | Alerts → Ack | Badge count −1 | Count drops, but only on the next 4 s tick (DEF-06) | ✅ Pass |
| MT-07 | FR-4.1 | Wizard step 2 → change Start time → confirm | Reservation arrival = chosen time | Always now + 10 min | ❌ Fail (DEF-04) |
| MT-08 | NFR-3 | Emulate 390 × 844 mobile | Sidebar becomes drawer, no horizontal scroll | scrollWidth = 390, rail off-canvas, menu button shown | ✅ Pass |

MT-01, MT-02, MT-06 and MT-08 were run in headless Chrome through scripted WebDriver steps.
MT-03, MT-04, MT-05 and MT-07 were confirmed by running the UI and reading the handler code.

## 5. Summary

| | Planned | Executed | Passed | Failed |
|---|---|---|---|---|
| Unit | 24 | 24 | 24 | 0 |
| Selenium | 73 | 73 | 67 (+6 known-defect todo) | 0 |
| Manual | 8 | 8 | 4 | 4 |
| **Total** | **105** | **105** | **95** | **4** (+6 known defects reproduced) |

The four failures trace to defects DEF-01, DEF-02 and DEF-04, logged in Experiment 9.
