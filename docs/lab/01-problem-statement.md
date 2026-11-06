# Experiment 1 — Problem Statement, Agile Process Model & Requirements

## Aim
Define the problem ParkFlow solves, choose a suitable process model, and identify
requirements from the problem statement.

## 1. Problem statement

City parking operators running several facilities (malls, office towers, metro
interchanges, airports) still rely on paper tickets, manual bay counting and
disconnected payment terminals. As a result:

- drivers cannot see free bays or reserve one in advance, so they circle and congest entrances;
- operators have no real-time view of occupancy across facilities, so capacity is wasted at one site while another overflows;
- billing is error-prone. Overstays go unnoticed and payments are reconciled by hand;
- hardware faults (ANPR cameras, barriers, EV chargers) are found late;
- staff shifts and duties are tracked on spreadsheets.

**ParkFlow** is a web-based e-parking management system. It gives operators one
dashboard for live bay occupancy, parking sessions, reservations, customers,
revenue analytics, incident alerts, staff rosters and tariff configuration for
every facility they run.

**Scope of this case study:** 4 facilities, 680 bays (standard, EV, accessible),
4 payment rails (UPI, Card, Wallet, FASTag).

## 2. Selection of process model

| Criterion | Waterfall | Spiral | **Agile (Scrum)** |
|---|---|---|---|
| Requirements stable up front? | Needed | Partly | **Not needed** — UI and tariff rules evolve with operator feedback |
| Early working software | Late | Medium | **Every sprint** |
| Customer involvement | Start/end only | Per cycle | **Continuous** (sprint reviews) |
| Team size | Any | Large | **Small (1–4)** — fits this team |
| Risk profile | Low novelty | High risk | **Moderate, mostly UX** |

**Chosen model: Agile – Scrum.** Operators need to try the dashboard and booking
flow before the rules are fixed. Scrum delivers a usable increment every 2
weeks, and each increment can be deployed straight to Vercel (see Experiment 8).

### Scrum setup

- **Roles:** Product Owner (parking operations head), Scrum Master, Development Team (2–3 developers)
- **Sprint length:** 2 weeks
- **Ceremonies:** Sprint planning → daily stand-up → sprint review (demo to operators) → retrospective
- **Artifacts:** Product backlog, sprint backlog, increment, burndown chart
- **Definition of Done:** code reviewed, unit tests pass (`npm test`), Selenium smoke tests pass (`npm run test:e2e`), deployed to preview

### Release plan

| Sprint | Goal | Backlog items delivered |
|---|---|---|
| 1 | Shell & data | App shell, router, theme, seeded data store |
| 2 | Live operations | Dashboard KPIs, live bay map, simulation |
| 3 | Transactions | Sessions ledger, booking wizard, reservations |
| 4 | Management | Customers, staff, alerts |
| 5 | Insight & config | Analytics charts, settings/tariffs, command palette |
| 6 | Hardening | Tests, accessibility, responsive layout, deployment |

## 3. Requirements identified from the problem statement

### User stories (product backlog)

| ID | As a… | I want to… | So that… | Priority |
|---|---|---|---|---|
| US-01 | Operator | see live occupancy across all facilities | I can redirect traffic | Must |
| US-02 | Operator | view a colour-coded map of every bay | I can spot free/EV bays | Must |
| US-03 | Attendant | reserve or release a specific bay | walk-ins get a bay | Must |
| US-04 | Driver / Attendant | book a bay in a few steps with a price shown | I know the cost before paying | Must |
| US-05 | Operator | search, filter and sort parking sessions | I can resolve disputes | Must |
| US-06 | Operator | extend or check out a session | billing is correct | Must |
| US-07 | Manager | view revenue and demand analytics | I can set tariffs | Should |
| US-08 | Supervisor | be alerted to overstays and hardware faults | I can act quickly | Should |
| US-09 | Manager | manage staff shifts and duty status | every facility is staffed | Should |
| US-10 | Admin | configure tariffs, surge threshold and channels | pricing matches demand | Should |
| US-11 | Any user | use dark mode and keyboard shortcuts | the tool is comfortable all day | Could |

### Functional requirements (summary)
Live occupancy monitoring · bay map with reserve/release · booking wizard ·
session ledger · reservation management · customer accounts · analytics ·
alert management · staff roster · settings/tariffs · global search.

### Non-functional requirements (summary)
Responsiveness (< 1 s page switch), live refresh every 4 s, works on mobile
(≥ 360 px), browser support (latest Chrome/Edge/Firefox/Safari), accessible
contrast in light/dark themes, no build step, deployable as a static site.

The full, numbered requirements are in the SRS ([02-srs.md](02-srs.md)).

## Result
The problem was defined, Scrum was selected and justified, and 11 user stories
were identified as the initial product backlog.
