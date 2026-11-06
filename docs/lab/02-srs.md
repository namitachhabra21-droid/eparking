# Experiment 2 — Software Requirement Specification (IEEE 830 format)

**Product:** ParkFlow — E-Parking Management System · **Version:** 1.0 · **Date:** 27 Oct 2026

## 1. Introduction

### 1.1 Purpose
This SRS specifies the functional and non-functional requirements of ParkFlow.
Its readers are the development team, testers and the parking operator (customer).

### 1.2 Scope
ParkFlow is a browser-based system that lets a parking operator monitor and run
several facilities from one console. It covers bay occupancy, sessions, reservations,
billing, customers, analytics, incidents, staff and configuration. Version 1.0 is a
front-end with a client-side data store. A REST back-end can replace that store
without changing any view (§ 2.4).

### 1.3 Definitions
| Term | Meaning |
|---|---|
| Bay / Slot | A single parking space, ID format `L<facility>-<zone><nn>` e.g. `L1-A07` |
| Facility / Lot | A parking site with zones and a capacity |
| Session | A vehicle's stay from check-in to check-out |
| Reservation | A bay booked in advance for a time window |
| ANPR | Automatic Number Plate Recognition camera |
| Overstay | A session that exceeds its booked window |
| FASTag | RFID toll/parking payment used in India |

### 1.4 References
IEEE Std 830-1998; project README; Experiments 4–6 (UML models).

## 2. Overall description

### 2.1 Product perspective
A self-contained single-page application (SPA). In production it talks to
external systems: payment gateways (UPI/Card/Wallet/FASTag), ANPR cameras, barrier
controllers and EV chargers.

### 2.2 Product functions
Dashboard · Live Bay Map · Sessions · Reservations · Booking Wizard · Customers ·
Analytics · Alerts · Team & Shifts · Settings · Command Palette.

### 2.3 User classes
| User | Description | Main functions |
|---|---|---|
| Ops Administrator | Full access | All modules, settings |
| Lot Supervisor | Runs one facility | Map, sessions, alerts, staff |
| Attendant | Front-line | Reserve/release bays, check-in/out, bookings |
| Manager | Business view | Analytics, customers, tariffs |
| Driver (via kiosk/web) | Customer | Booking wizard |

### 2.4 Operating environment & constraints
- Runs in current Chrome, Edge, Firefox and Safari; must be served over HTTP(S) because it uses ES modules
- No build tool and no runtime dependencies; deployable as static files (Vercel)
- Currency INR, locale `en-IN`
- Data access goes through one module (`core/store.js`), so a back-end can be added without changing the views

### 2.5 Assumptions
Facilities, zones and rates are configured by an administrator. Payment
authorisation is handled by the external gateway.

## 3. Specific requirements

### 3.1 Functional requirements

| ID | Requirement |
|---|---|
| **FR-1 Dashboard** | |
| FR-1.1 | Show KPI tiles: occupancy %, active sessions, today's revenue, average stay, EV bay usage |
| FR-1.2 | Show occupancy/revenue charts for 24 h, 7 d and 6 m ranges |
| FR-1.3 | Show a live activity feed that updates without reload |
| FR-1.4 | Filter every metric by facility or "All Facilities" |
| **FR-2 Live Bay Map** | |
| FR-2.1 | Display all 680 bays grouped by facility and zone, coloured by status (free / occupied / reserved) and type (standard / EV / accessible) |
| FR-2.2 | Filter bays by status or EV |
| FR-2.3 | Clicking a free bay lets the user reserve or hold it; clicking a taken bay lets them release it |
| FR-2.4 | Repaint the map automatically every 4 s as bay states change |
| **FR-3 Sessions** | |
| FR-3.1 | List sessions with ID, driver, plate, bay, start, duration, amount, status |
| FR-3.2 | Search by driver, plate, bay, facility, session ID or vehicle |
| FR-3.3 | Filter by status, facility, payment method; sort by any column; paginate 12 per page |
| FR-3.4 | Open a session to extend or check out |
| FR-3.5 | Fare = max(hourly rate, round(minutes ÷ 60 × rate)), i.e. one-hour minimum |
| **FR-4 Booking** | |
| FR-4.1 | Three-step wizard: facility → bay & time → driver, plate & payment |
| FR-4.2 | Do not continue past step 2 until a free bay is selected |
| FR-4.3 | Show the total (rate × hours) before confirmation |
| FR-4.4 | On confirmation, mark the bay *reserved*, create a reservation with status *confirmed* and show a confirmation message |
| **FR-5 Reservations** | List, search and filter reservations; show next arrivals; check-in or cancel |
| **FR-6 Customers** | List accounts with plan tier (Basic/Plus/Business/Enterprise), visits, spend; drill down |
| **FR-7 Analytics** | YoY revenue, weekly revenue/sessions, hourly demand, facility benchmark, payment mix |
| **FR-8 Alerts** | List alerts by severity (bad/warn/info/ok); acknowledge or dismiss; badge shows unacknowledged count |
| **FR-9 Staff** | List staff with role, facility, shift, duty status; filter by shift/duty |
| **FR-10 Settings** | Edit organisation, tariffs (incl. surge threshold), facilities, hardware health, notification channels |
| **FR-11 Global** | Command palette (Ctrl/⌘+K) for pages, plates and actions; collapse rail (Ctrl/⌘+B); dark mode remembered between visits; unknown URLs fall back to the dashboard |

### 3.2 Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Page switch renders in < 1 s; live tick every 4 s |
| NFR-2 | Usability | All main tasks reachable in ≤ 3 clicks; keyboard shortcuts for search and nav |
| NFR-3 | Responsiveness | Usable from 360 px width; sidebar becomes a drawer below 820 px |
| NFR-4 | Accessibility | Text contrast meets WCAG AA in both themes; dialogs use `role="dialog"`, Escape closes them |
| NFR-5 | Security | All user/data strings are HTML-escaped before rendering (XSS prevention); HTTPS in production |
| NFR-6 | Reliability | Seeded data generation gives identical results on reload; no crash on empty data (zero-safe metrics) |
| NFR-7 | Maintainability | Views depend only on `store`, `ui`, `datatable`, `icons`; each view module < 250 LOC |
| NFR-8 | Portability | Static hosting, no server-side build |
| NFR-9 | Testability | ≥ 90 % line coverage of business logic; automated UI regression with Selenium |

### 3.3 External interfaces
- **User interface:** responsive SPA with sidebar, top bar, cards, tables, modals, toasts
- **Hardware (future):** ANPR cameras, barrier controllers, EV chargers via the facility gateway
- **Software (future):** payment gateway APIs, SMS/e-mail/WhatsApp notification channels

## 4. Traceability (requirement → test)

| Requirement | Test cases (Exp. 10/12) |
|---|---|
| FR-2.1 capacity & IDs | UT-01 … UT-05 |
| FR-3.5 fare rule | UT-07, UT-08 |
| FR-1.1/1.4 metrics | UT-10 … UT-13, E2E-05 |
| FR-3.2/3.3 search, filter, sort, paginate | E2E-06 … E2E-10 |
| FR-4.2/4.4 booking | E2E-11, E2E-12 |
| FR-11 global | E2E-01 … E2E-04, E2E-14, E2E-15 |
| NFR-6 zero-safe | UT-13 |
