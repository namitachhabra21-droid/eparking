<!-- Edit this template or estimation-inputs.json, then run python3 scripts/estimate.py. -->
# Experiment 3 — Estimation of Project Metrics: Effort and Cost Estimation

**Project:** ParkFlow — E-Parking Management Website  
**Assessment date:** 27 October 2026  
**Model:** COCOMO 81, Basic and Intermediate; Organic baseline  
**Boundary:** The existing browser application in `index.html` and `assets/`.

## 1. Aim and scope

Measure delivered source size, construct a traceable function-point worksheet,
and calculate effort, development time, average staffing, productivity and labour
cost. All results are reproducible; measured quantities and assumptions are identified separately.

This repository implements a browser prototype. It has no backend, production
database, payment gateway, ANPR integration or authenticated multiuser service.
Payment names and camera status displays do not constitute working integrations.
The estimates below apply to the current website. A complete production system
requires a separate requirements inventory and estimate.

| Quantity | Status |
| --- | --- |
| Physical and non-comment source lines | Measured using cloc 2.06 |
| Function-point inventory | Manual, indicative coursework assessment of implemented prototype functions |
| Organic mode | Assumed small team, familiar web technology, no tight hardware coupling |
| Intermediate cost drivers | All nominal because team/product calibration evidence is unavailable |
| Hourly rate and working hours | Illustrative budget inputs, not market quotations |
| Effort and schedule | Model projections, not recorded historical time |

## 2. Source lines of code: measurement

### 2.1 Counting rules

Use **physical non-blank, non-comment source lines**, not bytes, semicolon counts,
Git diff lines, coverage-report lines, number of functions, or number of screens.
One physical code line counts once even if it contains several statements.
Mixed code/comment lines count as code. A statement spanning several physical
lines contributes several lines. `cloc` performs language-aware classification.

Include the 15 JavaScript files, 3 CSS files and `index.html`. Exclude
`node_modules`, Git files, tests, documents, estimation scripts, package manifests,
lockfiles and hosting configuration. These are not delivered application source
under this measurement boundary. Test/QA effort is still part of development;
excluding test LOC does not remove verification work from the effort estimate.

HTML and SVG templates embedded in JavaScript remain in the JavaScript file's
count; inline CSS in `index.html` remains in HTML. Nothing is counted twice.
Therefore the JavaScript subtotal includes substantial presentation markup and
is itself a source-size approximation to COCOMO's historical delivered instructions.

Tool: [cloc, pinned release 2.06](https://github.com/AlDanial/cloc/tree/v2.06).

```bash
# From the repository root, using the pinned cloc Perl script:
LC_ALL=C perl /path/to/cloc-2.06.pl --by-file --json index.html assets

# Recreate the complete report and machine-readable results:
python3 scripts/estimate.py
# Verify that source hashes, counts and calculations still match:
python3 scripts/estimate.py --check
```

The Python command downloads the pinned, SHA-256-verified tool into a temporary
directory; it needs Python 3, Perl and network access. For offline execution use
`--cloc /path/to/cloc-2.06.pl`. Its expected hash is
`ed9fbdd081a2ceb933ea490b3c1cfacc87d3898ae2650d0d6756439695a836c8`.

### 2.2 Measured totals

| Language | Files | Physical | Blank | Comment-only | Code |
| --- | --- | --- | --- | --- | --- |
| CSS | 3 | 809 | 65 | 47 | 697 |
| HTML | 1 | 58 | 1 | 0 | 57 |
| JavaScript | 15 | 2188 | 155 | 56 | 1977 |
| TOTAL | 19 | 3055 | 221 | 103 | 2731 |

Definitions and reconciliation:

```text
Physical lines = code lines + blank lines + comment-only lines
              = 2,731 + 221 + 103 = 3,055
Website KLOC  = 2731 / 1,000 = 2.731
JS KLOC       = 1977 / 1,000 = 1.977
CSS + HTML    = 697 + 57 = 754 source lines
```

**Use 1.977 JavaScript KLOC as the primary COCOMO size proxy.** Also report
2.731 KLOC for the complete website as an explicitly labelled alternative that
assigns each markup/style line the same weight as a programming-language line.
That alternative is a classroom sensitivity calculation, not a calibrated
cross-language equivalence. Do not add their effort estimates: they describe
overlapping implementations of the same website.

### 2.3 Per-file evidence

| File | Physical | Blank | Comment-only | Code |
| --- | --- | --- | --- | --- |
| `assets/css/components.css` | 406 | 28 | 23 | 355 |
| `assets/css/shell.css` | 254 | 18 | 11 | 225 |
| `assets/css/theme.css` | 149 | 19 | 13 | 117 |
| `assets/js/app.js` | 267 | 20 | 8 | 239 |
| `assets/js/core/datatable.js` | 116 | 9 | 3 | 104 |
| `assets/js/core/icons.js` | 45 | 2 | 1 | 42 |
| `assets/js/core/store.js` | 301 | 19 | 20 | 262 |
| `assets/js/core/ui.js` | 271 | 18 | 16 | 237 |
| `assets/js/views/alerts.js` | 89 | 9 | 0 | 80 |
| `assets/js/views/analytics.js` | 99 | 8 | 1 | 90 |
| `assets/js/views/booking.js` | 124 | 6 | 1 | 117 |
| `assets/js/views/bookings.js` | 97 | 7 | 0 | 90 |
| `assets/js/views/customers.js` | 95 | 7 | 0 | 88 |
| `assets/js/views/dashboard.js` | 221 | 15 | 5 | 201 |
| `assets/js/views/lotmap.js` | 197 | 15 | 1 | 181 |
| `assets/js/views/sessions.js` | 63 | 4 | 0 | 59 |
| `assets/js/views/settings.js` | 151 | 13 | 0 | 138 |
| `assets/js/views/staff.js` | 52 | 3 | 0 | 49 |
| `index.html` | 58 | 1 | 0 | 57 |

The generated [JSON result](results/estimation.json) records each file's SHA-256
hash, counts, model inputs and unrounded numerical results. Changing documentation
or the estimation tool does not inflate application LOC.

## 3. Function Point Analysis of the implemented prototype

### 3.1 Method and limits

Function points measure user-visible functionality; they are **not** a count of
JavaScript functions. EI = external input, EO = external output, EQ = external
inquiry, ILF = internal logical file, EIF = external interface file. DET counts
distinct user-recognizable field types; RET counts logical record subgroups;
FTR counts distinct logical data functions referenced, counting a read-and-write
of the same group once. Record quantities (680 bays, for example) do not multiply FP.

The definitions and complexity approach follow the
[IFPUG Counting Practices Manual](https://epmc2.fr/wp-content/uploads/2023/12/IFPUG-Pratcice-manual-4_2_1.pdf).
This is a **simplified educational working-data count**, not a certified IFPUG
application size. In particular, the seven internal groups below are treated as
logical business files for this exercise although they are seeded in-memory
objects; several have no user maintenance operation and none persists across
reloads. They are **ILF proxies**, not seven evidenced production ILFs. Field
counts describe the reviewed implementation schema/UI, not a certified logical
data model; duplicate representations may need consolidation in a formal count.

A formal application count must resolve the persistence/maintenance boundary
and re-evaluate the data functions and affected transaction complexities. It
cannot be obtained simply by deleting the data-function subtotal. The
[OMG AFP specification](https://www.omg.org/spec/AFP/1.0/PDF) distinguishes
business data from transient and technical data when identifying logical files.
This qualification prevents the worksheet from overstating what the prototype delivers.

### 3.2 Scope decisions

- Count the booking wizard as **one input process**, not three separate inputs.
  Its total-price calculation and confirmation are part of that process, not extra EOs.
- Count each overview and its table/search/filter/range variants as one EO where
  the screen calculates aggregates. Do not separately count every chart, KPI,
  sorting operation, page, filter value or toast.
- Count three distinct detail inquiries; customer detail currently displays
  sessions without filtering them to that customer, so its existence does not
  establish a correct customer-to-session relationship.
- Merge acknowledge-one/all as variants of the same acknowledgment process.
- Exclude Checkout, Extend, reservation Check In/Cancel, maintenance Hold,
  export/email, tariff editing, Save Settings, staff/customer invitations and
  account actions: they show messages or have no implemented business mutation.
- Exclude theme/sidebar preferences, navigation and visual animation from the
  business functional count; they still contribute source lines and implementation effort.
- **EIF = 0:** there is no implemented external business-data interface.
  Google Fonts is a presentation dependency, not a payment or parking data file.
- Exclude activity/time-series fixtures as separate business files: they support
  demonstration outputs. Include the output functions that display them.

### 3.3 Complexity matrices and weights

For EI, use these matrix indices before applying its weights:

| FTR count | 1–4 DETs | 5–15 DETs | 16+ DETs |
| --- | --- | --- | --- |
| 0–1 | Low | Low | Average |
| 2 | Low | Average | High |
| 3+ | Average | High | High |

For EO/EQ:

| FTR count | 1–5 DETs | 6–19 DETs | 20+ DETs |
| --- | --- | --- | --- |
| 0–1 | Low | Low | Average |
| 2–3 | Low | Average | High |
| 4+ | Average | High | High |

For ILF/EIF:

| RET count | 1–19 DETs | 20–50 DETs | 51+ DETs |
| --- | --- | --- | --- |
| 1 | Low | Low | Average |
| 2–5 | Low | Average | High |
| 6+ | Average | High | High |

| Function type | Low weight | Average weight | High weight |
| --- | --- | --- | --- |
| EI | 3 | 4 | 6 |
| EO | 4 | 5 | 7 |
| EQ | 3 | 4 | 6 |
| ILF | 7 | 10 | 15 |
| EIF | 5 | 7 | 10 |

### 3.4 Data-function worksheet

| Working data group | RETs | DETs | Complexity | Proxy FP |
| --- | --- | --- | --- | --- |
| Bays | 1 | 9 | Low | 7 |
| Sessions | 1 | 15 | Low | 7 |
| Reservations | 1 | 11 | Low | 7 |
| Customers | 1 | 10 | Low | 7 |
| Alerts | 1 | 7 | Low | 7 |
| Staff | 1 | 7 | Low | 7 |
| Facilities | 1 | 6 | Low | 7 |

Each group has one record shape. Bay type, session status, customer plan and
reservation channel are attribute values, not additional RETs. Presentation-only
fields such as icon identifiers and colour tints are excluded. The full field
lists are in [estimation-inputs.json](estimation-inputs.json).

### 3.5 Transaction worksheet

Source paths, field lists, FTRs and the manually reviewed DET counts are in the
input JSON. The Python implementation computes complexity and weight from the
matrices; it does not infer business functions automatically from syntax.

| Implemented process | Type | FTRs | DETs | Complexity | FP |
| --- | --- | --- | --- | --- | --- |
| Create reservation and hold bay | EI | Facilities, Bays, Reservations | 8 | High | 6 |
| Reserve bay directly | EI | Bays | 3 | Low | 3 |
| Release bay | EI | Bays | 3 | Low | 3 |
| Acknowledge alerts (one/all variants) | EI | Alerts | 4 | Low | 3 |
| Dismiss alert | EI | Alerts | 3 | Low | 3 |
| Dashboard overview | EO | Bays, Sessions, Facilities | 27 | High | 7 |
| Analytics overview | EO | Sessions, Facilities, Bays | 24 | High | 7 |
| Bay map with derived availability | EO | Bays, Facilities | 17 | Average | 5 |
| Session ledger with summary/search | EO | Sessions | 18 | Low | 4 |
| Reservations with totals/arrivals/search | EO | Reservations | 18 | Low | 4 |
| Customers with plan mix/summary/search | EO | Customers | 19 | Low | 4 |
| Alerts with severity summary/filter | EO | Alerts | 13 | Low | 4 |
| Team roster with totals/search | EO | Staff | 14 | Low | 4 |
| Session detail | EQ | Sessions | 13 | Low | 3 |
| Reservation detail | EQ | Reservations | 9 | Low | 3 |
| Customer detail and displayed sessions | EQ | Customers, Sessions | 12 | Average | 4 |

Example: Create Reservation reads Facilities, updates Bays and creates a
Reservation. Three FTRs and eight DETs produce **High EI = 6 FP**, rather than
assigning an unsupported average weight to every function.

### 3.6 Unadjusted function-point arithmetic

| Type | Low count | Average count | High count | Weighted FP |
| --- | --- | --- | --- | --- |
| EI | 4 | 0 | 1 | 18 |
| EO | 5 | 1 | 2 | 39 |
| EQ | 2 | 1 | 0 | 10 |
| ILF | 7 | 0 | 0 | 49 |
| EIF | 0 | 0 | 0 | 0 |

```text
UFP = Σ(count at each complexity × corresponding weight)
EI  = 4 × 3 + 0 × 4 + 1 × 6 = 18
EO  = 5 × 4 + 1 × 5 + 2 × 7 = 39
EQ  = 2 × 3 + 1 × 4 + 0 × 6 = 10
ILF proxy = 7 × 7 = 49
EIF = 0
Indicative UFP = 18 + 39 + 10 + 49 + 0 = 116
```

**116 UFP is the working-data estimate under the stated assumptions.** It is
not a measured production-system FP size and does not include unimplemented integrations.

### 3.7 Legacy adjustment: 14 general system characteristics

For the traditional coursework adjusted-FP method, rate each GSC from 0 (no
influence) to 5 (strong influence). These are analyst assumptions, not quantities
computed from source lines. Keep the UFP result separate; the legacy VAF does
not change the unadjusted functional size or COCOMO's own effort adjustment factor.

| Characteristic | Score | Project assumption |
| --- | --- | --- |
| Data communications | 0 | No business API or remote data exchange implemented. |
| Distributed processing | 0 | All business processing is in one browser. |
| Performance | 1 | Small in-memory dataset and a 4-second refresh; no measured SLA. |
| Heavily used configuration | 0 | No dedicated constrained production environment evidenced. |
| Transaction rate | 0 | No measured multiuser transaction workload. |
| Online data entry | 3 | Interactive wizard and bay/alert controls. |
| End-user efficiency | 3 | Search, filters, keyboard shortcuts and responsive layout. |
| Online update | 3 | Working reservations, bay and alert mutations, limited to browser memory. |
| Complex processing | 1 | Simple billing and aggregation; chart rendering is mainly presentation. |
| Reusability | 2 | Shared table, modal, formatter and chart helpers. |
| Installation ease | 2 | Static deployment without a build; no installation automation supplied. |
| Operational ease | 2 | Automatic mock initialization; no production operations automation. |
| Multiple sites | 1 | Four modeled facilities, not four evidenced independent deployments. |
| Facilitate change | 2 | Modules and CSS tokens; business settings are mostly placeholders. |

```text
TDI = Σ Fi = 20                     (0 ≤ TDI ≤ 70)
VAF = 0.65 + 0.01 × TDI
    = 0.65 + 0.01 × 20 = 0.85      (0.65 ≤ VAF ≤ 1.35)
Adjusted FP = UFP × VAF
            = 116 × 0.85 = 98.60
```

## 4. COCOMO 81: model selection and equations

COCOMO estimates effort from thousands of delivered source instructions. The
physical LOC measured here is an explicitly stated size proxy; this small,
markup-heavy modern application is not a calibrated match to the historical
dataset. Organic mode assumes a small, experienced team using familiar
technology and relatively flexible constraints. Size alone does not establish mode.

The Basic coefficient families are documented in the
[IIT Kharagpur Software Engineering Virtual Lab](https://vlabs.iitkgp.ac.in/sevl/Exp2/theory.html).
For the Intermediate coefficient families see the
[University of Zurich hosted COCOMO lecture](https://files.ifi.uzh.ch/rerg/amadeus/teaching/seminars/seminar_ws0203/Seminar_4.pdf).

| Mode | Basic a | Intermediate a | Effort exponent b | Schedule c | Schedule exponent d |
| --- | --- | --- | --- | --- | --- |
| Organic | 2.4 | 3.2 | 1.05 | 2.5 | 0.38 |
| Semi-detached | 3.0 | 3.0 | 1.12 | 2.5 | 0.35 |
| Embedded | 3.6 | 2.8 | 1.20 | 2.5 | 0.32 |

```text
S = source lines / 1,000                         [KLOC]
Basic effort:        E = a_basic × S^b           [person-months, PM]
Intermediate effort: E = a_intermediate × S^b × EAF
EAF = Π EM_i, i = 1 … 15                       [dimensionless]
Development time:    T = c × E^d                 [calendar months]
Average staffing:    P = E / T                   [full-time equivalent people]
Productivity:        Q = (1,000 × S) / E         [source lines per PM]
Labour cost:         C = E × rate_per_PM         [INR]
```

One PM is one person's full-time work for one month. PM measures work, whereas
calendar months measure elapsed time. Fractional average staffing is valid; it
is not a fractional employee or a required constant team size. Rounding P upward
does not entitle a project to the same schedule at a different effort.

### 4.1 Intermediate model: all 15 drivers

| Driver | Meaning | Baseline rating | Multiplier |
| --- | --- | --- | --- |
| RELY | Required reliability | Nominal | 1.00 |
| DATA | Database size | Nominal | 1.00 |
| CPLX | Product complexity | Nominal | 1.00 |
| TIME | Execution time constraint | Nominal | 1.00 |
| STOR | Main storage constraint | Nominal | 1.00 |
| VIRT | Virtual machine volatility | Nominal | 1.00 |
| TURN | Computer turnaround time | Nominal | 1.00 |
| ACAP | Analyst capability | Nominal | 1.00 |
| AEXP | Application experience | Nominal | 1.00 |
| PCAP | Programmer capability | Nominal | 1.00 |
| VEXP | Virtual machine experience | Nominal | 1.00 |
| LEXP | Programming language experience | Nominal | 1.00 |
| MODP | Modern programming practices | Nominal | 1.00 |
| TOOL | Software tools | Nominal | 1.00 |
| SCED | Required development schedule | Nominal | 1.00 |

All multipliers are nominal **assumptions**, not an assertion that the personnel
have measured average ability. The source does not establish historical team
capability, platform experience, reliability targets or production constraints.
Using nominal values avoids inventing favourable personnel ratings.

```text
EAF = RELY × DATA × CPLX × TIME × STOR × VIRT × TURN
    × ACAP × AEXP × PCAP × VEXP × LEXP × MODP × TOOL × SCED
    = 1.00^15 = 1.0000
```

Basic and Intermediate Organic estimates differ even with EAF = 1, because
their coefficients are 2.4 and 3.2 respectively. Do not silently apply 2.4 to
the Intermediate model. Detailed COCOMO would need phase-sensitive driver
assessments that are not available here; arbitrary phase percentages are not added.

### 4.2 Worked example: measured JavaScript size

```text
S = 1977 / 1,000 = 1.977 KLOC
S^1.05 = 2.04553541

Basic Organic:
E = 2.4 × 1.977^1.05 = 4.90928499 PM
T = 2.5 × E^0.38 = 4.57643124 months
P = E / T = 1.07273217 people on average

Intermediate Organic, nominal drivers:
E = 3.2 × 1.977^1.05 × 1.0000 = 6.54571333 PM
T = 2.5 × E^0.38 = 5.10509304 months
P = E / T = 1.28219276 people on average
```

All calculations retain full floating-point precision until display. The JSON
contains unrounded model outputs; numbers shown to 4 or 8 decimal places are
for arithmetic verification, not evidence of that degree of forecasting accuracy.

### 4.3 Size-basis comparison

| Size basis | KLOC | Model | Effort PM | Schedule months | Average staff |
| --- | --- | --- | --- | --- | --- |
| Measured JavaScript | 1.977 | Basic | 4.9093 | 4.5764 | 1.0727 |
| Measured JavaScript | 1.977 | Intermediate | 6.5457 | 5.1051 | 1.2822 |
| All website source (proxy) | 2.731 | Basic | 6.8921 | 5.2061 | 1.3238 |
| All website source (proxy) | 2.731 | Intermediate | 9.1894 | 5.8075 | 1.5823 |

The 2.731 KLOC rows demonstrate how including all CSS/HTML as equivalent code
affects this model. They are not a second development phase or a validated total-cost bound.

## 5. Function-point-to-LOC route and sensitivity

COCOMO 81 cannot consume FP directly. A separate, empirically calibrated
language conversion factor would be needed:

```text
Estimated JS LOC = UFP × assumed JS LOC/UFP
Estimated KLOC  = (UFP × assumed JS LOC/UFP) / 1,000
Then E = 3.2 × Estimated_KLOC^1.05 × EAF
```

No measured organizational conversion factor exists in this repository.
**40, 47 and 60 LOC/UFP are illustrative sensitivity assumptions**, not a
universal JavaScript standard or evidence of future backend size. Use
unadjusted FP consistently in this table; do not first round adjusted FP to an
integer and then relabel it UFP.

| Assumed JS LOC/UFP | UFP × ratio | KLOC | Intermediate PM | Months | Avg staff |
| --- | --- | --- | --- | --- | --- |
| 40 | 4640 | 4.640 | 16.0322 | 7.1753 | 2.2344 |
| 47 | 5452 | 5.452 | 18.9904 | 7.6521 | 2.4817 |
| 60 | 6960 | 6.960 | 24.5409 | 8.4353 | 2.9093 |

This is an alternative hypothetical implementation-density calculation for the
same functional worksheet, not a full production-system forecast. Do not add it
to the measured-LOC estimate. For this existing implementation:

```text
Observed JS physical LOC / indicative UFP = 1977 / 116 = 17.0431
```

This observed ratio merely describes this prototype under its assumed FP
boundary. Backfiring its FP from LOC and then using that same ratio to recover
LOC would be circular, not an independent validation. Consequently the
**measured-source route remains the primary estimate**.

### 5.1 Source-size sensitivity

Hold Organic mode and EAF = 1 fixed; vary measured JavaScript size by ±20%:

| Size factor | KLOC | Intermediate PM | Months |
| --- | --- | --- | --- |
| 80% | 1.5816 | 5.1785 | 4.6702 |
| 100% | 1.9770 | 6.5457 | 5.1051 |
| 120% | 2.3724 | 7.9268 | 5.4903 |

These are what-if calculations, not statistical confidence intervals. Changes
to functionality, team, reuse or quality requirements can have other effects.

### 5.2 Mode sensitivity

Hold measured JavaScript size fixed and change Basic COCOMO mode:

| Mode | Basic PM | Months | Avg staff |
| --- | --- | --- | --- |
| Organic | 4.9093 | 4.5764 | 1.0727 |
| Semi-detached | 6.4365 | 4.7970 | 1.3418 |
| Embedded | 8.1566 | 4.8935 | 1.6668 |

Semi-detached and Embedded rows are comparisons only; the current website does
not have the tightly coupled hardware constraints that would justify Embedded mode.

## 6. Effort and cost estimation

Use the measured-JavaScript, nominal Intermediate Organic scenario for this
worked budget. Assume a **fully loaded illustrative rate** of ₹375/hour and
160 productive hours/person-month:

```text
Rate per PM = 375 × 160 = ₹60,000
Person-hours = 6.54571333 × 160 = 1,047.31
Labour C = 6.54571333 × ₹60,000 = ₹392,742.80
Contingency = 10% × C = ₹39,274.28
Illustrative labour budget = 1.10 × C = ₹432,017.08
```

| Budget item | Basis | INR |
| --- | --- | --- |
| Development lifecycle labour | Unrounded Intermediate PM × ₹60,000 | 392,742.80 |
| Contingency reserve | 10% of labour | 39,274.28 |
| **Illustrative labour budget** | Labour + reserve | **432,017.08** |

For comparison, applying the same rate and reserve to each measured-size model:

| Size basis | Model | Labour INR | With 10% reserve INR |
| --- | --- | --- | --- |
| Measured JavaScript | Basic | 294,557.10 | 324,012.81 |
| Measured JavaScript | Intermediate | 392,742.80 | 432,017.08 |
| All website source (proxy) | Basic | 413,523.58 | 454,875.94 |
| All website source (proxy) | Intermediate | 551,364.77 | 606,501.25 |

The rate and hours are assumptions, not current salary or vendor-price claims.
COCOMO development effort already spans design, coding, integration and testing;
the fully loaded rate here includes normal supervision/overhead. Adding generic
15% QA and 10% management charges without defining genuinely additional scope
would double-count that work. Contingency is an explicit budgeting reserve, not
a COCOMO multiplier or additional forecast effort.

Hosting, domain, maintenance, taxes and production integrations are **not priced
or included**. There are no vendor quotations, staffing records or operations
requirements in the repository with which to calculate a defensible total cost
of ownership. They are unknown additional budget items, not assumed free services.

### 6.1 Derived project metrics

```text
Productivity Q = 1977 / 6.54571333 = 302.0297 JS source lines/PM
Average staff  = 6.54571333 / 5.10509304 = 1.28219276 FTE
Labour per indicative UFP = ₹392,742.80 / 116 = ₹3,385.71/UFP
```

Productivity and cost/FP inherit the assumptions of the model and FP proxy;
they are projected ratios, not measured developer performance. No actual
development logs are supplied, so estimation error against actual effort cannot
be calculated. All primary results concern reproduction of the current scope,
not the remaining work needed to complete its placeholders.

## 7. Result and interpretation

ParkFlow contains **2731 measured website code lines across 19 files**,
including **1977 JavaScript code lines**. Its reviewed educational worksheet
gives **116 indicative UFP**, or **98.60 legacy adjusted FP** under the stated
working-data and GSC assumptions. It does not establish a certified persistent
application FP size.

For the primary 1.977 KLOC proxy, nominal Intermediate Organic COCOMO gives
**6.54571333 person-months**, **5.10509304 calendar months** and
**1.28219276 average FTE**. At the assumed ₹60,000/PM, labour is
**₹392,742.80**, or **₹432,017.08 with a 10% reserve**.

These are transparent academic model outputs, not a promise that this prototype
actually took that much work, or a quotation for a complete production parking
system. Measured LOC, inferred functional size and projected effort remain
separate throughout.

## 8. Reproducible artifacts and references

- [Estimation implementation](../../scripts/estimate.py): LOC tool verification,
  FP complexity matrices, full-precision COCOMO, costing and artifact checking.
- [Reviewed inputs](estimation-inputs.json): field lists, source references,
  functional scope, GSC scores, all 15 cost drivers and cost assumptions.
- [Machine-readable result](results/estimation.json): per-file source hashes,
  LOC, weighted FP, all model scenarios and costs.
- [Report template](estimation-template.md): edit this and regenerate the report.
- [cloc release 2.06](https://github.com/AlDanial/cloc/tree/v2.06): source-count tool.
- [IIT Kharagpur SE Virtual Lab](https://vlabs.iitkgp.ac.in/sevl/Exp2/theory.html):
  Basic COCOMO model families.
- [COCOMO lecture hosted by University of Zurich](https://files.ifi.uzh.ch/rerg/amadeus/teaching/seminars/seminar_ws0203/Seminar_4.pdf):
  Intermediate COCOMO model families.
- [IFPUG CPM 4.2.1](https://epmc2.fr/wp-content/uploads/2023/12/IFPUG-Pratcice-manual-4_2_1.pdf):
  functional sizing terminology and matrix method.
- [OMG Automated Function Points 1.0](https://www.omg.org/spec/AFP/1.0/PDF):
  limitations of inferring logical data files from source representations.
