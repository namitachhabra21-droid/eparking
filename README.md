# ParkFlow — Smart Parking Management (Frontend)

A SaaS-grade, zero-build frontend for a multi-facility e-parking operation.
Pure ES modules + CSS — **no bundler, no framework, no install step.**

## Run

```bash
npx serve .          # or: python3 -m http.server 5173
```

Then open <http://localhost:5173>.

> Must be served over HTTP (ES modules are blocked on `file://`).

## Features

| Area | What's in it |
|---|---|
| **Dashboard** | Animated KPI tiles with sparklines, dual-axis occupancy/revenue curve (24h · 7d · 6m), live status donut, streaming activity feed, active-session table |
| **Live Bay Map** | 680 bays across 4 facilities, colour-coded by state, click any bay to reserve/release. Filter by status or EV. Repaints itself as the simulation runs |
| **Sessions** | Full ledger — sortable, searchable, filterable, paginated. Drill into any session to extend or check out |
| **Reservations** | Booking pipeline + next-arrivals rail, check-in / cancel flows |
| **Customers** | Accounts by plan tier, lifetime value, EV eligibility, per-account drill-down |
| **Analytics** | YoY revenue area chart, weekly grouped bars, hourly demand curve, facility benchmark table, payment-rail donut |
| **Alerts** | Severity-tiered incident stream with acknowledge / dismiss |
| **Team** | Roster with shift and duty filters |
| **Settings** | 5 tabs — org, tariffs (incl. surge threshold), facilities, hardware health, notification channels |

## Dynamic behaviour

- **Live simulation** — bays flip state every 4s; KPIs, rail meter and activity feed update in place
- **Booking wizard** — 3-step flow that writes a real reservation and holds the bay
- **Command palette** — `⌘K` / `Ctrl+K` to jump to any page, plate or action
- **Dark mode** — persisted to `localStorage`, full token swap
- **Collapsible rail** — `⌘B`, persisted
- **Toasts, modals, ripples, count-ups, skeletons** — all hand-rolled
- **Responsive** — sidebar becomes a drawer under 820px

## Structure

```
index.html
assets/
  css/  theme.css       design tokens + dark mode + reset
        shell.css       rail, topbar, page frame, responsive
        components.css  cards, buttons, tables, charts, modals, toasts
  js/   app.js          shell, router, theme, command palette
        core/  store.js      seeded data + live simulation + pub/sub
               ui.js         DOM helpers, SVG charts, toasts, modals
               datatable.js  sort / search / filter / paginate engine
               icons.js      37 inline SVG icons
        views/ dashboard · lotmap · sessions · bookings · customers
               analytics · alerts · staff · settings · booking
```

## Notes

All data is generated client-side by a **seeded** PRNG in `core/store.js`, so the
app looks identical on every reload while still animating. There is no backend —
swap the `DB` export for real `fetch` calls and the views need no changes.

Charts are hand-written SVG (no chart library) — see `areaChart`, `barChart`,
`donut` and `sparkline` in `core/ui.js`.
