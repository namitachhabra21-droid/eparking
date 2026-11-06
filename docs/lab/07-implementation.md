# Experiment 7 — Coding Implementation

## Aim
Implement ParkFlow from the design in Experiments 4–6.

## 1. Technology choices

| Concern | Choice | Reason |
|---|---|---|
| Language | JavaScript (ES2022 modules) | Runs natively in every browser, so no compile step |
| UI | Hand-written HTML templates + CSS custom properties | No framework lock-in; design tokens give light/dark themes |
| Charts | Hand-written SVG (`areaChart`, `barChart`, `donut`, `sparkline`) | Zero dependencies, theme-aware |
| Data | `core/store.js` seeded PRNG + pub/sub | Same data on every reload, but still animates |
| Hosting | Vercel static hosting | Matches NFR-8 (static) |
| Tests | `node:test` (unit) + Selenium WebDriver (UI) | Built into Node / industry standard |

## 2. Architecture

```
index.html ─▶ app.js (shell, router, theme, command palette)
                 │
     ┌───────────┼──────────────┬────────────┐
 views/*.js   core/store.js   core/ui.js   core/datatable.js
 (9 pages +   (data, metrics, (DOM, toast,  (search/filter/
  booking)     simulation)     modal, SVG)   sort/paginate)
```

- **Router:** hash-based (`#dashboard`, `#sessions` …). `navigate()` calls the previous view's cleanup, then `render(root, ctx)` on the new one. Unknown routes fall back to the dashboard.
- **Observer:** `subscribe(fn)` returns an unsubscribe function. Views subscribe on render and unsubscribe in cleanup, so subscriptions don't leak.
- **Security:** every interpolated string goes through `esc()` (HTML-escapes `& < > "`).

## 3. Key code (excerpts from the repository)

### 3.1 Capacity distribution, [store.js](../../assets/js/core/store.js) `buildSlots()`
```js
const base = Math.floor(lot.cap / lot.zones.length);
const extra = lot.cap % lot.zones.length;
lot.zones.forEach((z, zi) => {
  const per = base + (zi < extra ? 1 : 0);   // earlier zones absorb the remainder
  for (let i = 1; i <= per; i++) {
    let type = 'std';
    if (i % 11 === 0) type = 'ev';
    else if (i % 17 === 0) type = 'acc';
    ...
```

### 3.2 Fare rule (FR-3.5)
```js
amount: Math.max(lot.rate, Math.round((mins / 60) * lot.rate)),
```

### 3.3 Derived metrics, zero-safe (NFR-6)
```js
export function metrics(lotId = 'all') {
  const s = lotId === 'all' ? DB.slots : DB.slots.filter(x => x.lot === lotId);
  ...
  return { total, occupied, reserved, free,
    occPct: total ? Math.round((occupied + reserved) / total * 100) : 0, ... };
}
```

### 3.4 Publish / subscribe and live loop
```js
const subs = new Set();
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export function startLive() {
  if (timer) return;                     // idempotent
  timer = setInterval(() => { /* flip bays, re-price, emit */ }, 4000);
}
```

### 3.5 Booking wizard validation (FR-4.2, FR-4.4), [booking.js](../../assets/js/views/booking.js)
```js
next.onclick = () => {
  if (step === 2 && !data.slot) return toast('Pick a bay', 'Select an available bay to continue', 'warn');
  if (step === 3) {
    const slot = DB.slots.find(s => s.id === data.slot);
    if (slot) { slot.status = 'reserved'; slot.since = Date.now(); slot.plate = data.plate; }
    DB.reservations.unshift({ id: `RSV-…`, status: 'confirmed', ... });
    toast('Booking confirmed', …); close(); onDone?.(); return;
  }
  step++; paint();
};
```

### 3.6 Generic data table, [datatable.js](../../assets/js/core/datatable.js)
```js
const view = () => {
  let out = rows.slice();
  if (q) out = out.filter(r => search.some(k => String(r[k] ?? '').toLowerCase().includes(q.toLowerCase())));
  filters.forEach(f => { if (fstate[f.key] !== 'all') out = out.filter(r => String(r[f.key]) === fstate[f.key]); });
  if (sortKey) out.sort((a, b) => (numeric ? x - y : String(x).localeCompare(String(y))) * sortDir);
  return out;
};
```

## 4. Module inventory

| Module | LOC | Responsibility |
|---|---|---|
| app.js | 241 | Shell, router, theme, rail meter, notifications, command palette |
| core/store.js | 264 | Seeded data, metrics, pub/sub, simulation, formatters |
| core/ui.js | 241 | DOM helpers, toast, modal, count-up, SVG charts |
| core/datatable.js | 106 | Reusable table engine |
| core/icons.js | 42 | 37 inline SVG icons |
| views/dashboard.js | 201 | KPIs, charts, feed, active sessions, session modal |
| views/lotmap.js | 181 | 680-bay map, filters, bay modal |
| views/booking.js | 117 | 3-step booking wizard |
| views/settings.js | 138 | 5-tab settings |
| other views | 456 | sessions, bookings, customers, analytics, alerts, staff |

## 5. Running

```bash
npm start          # or: python3 -m http.server 5173
```
Open the printed URL. The app has to be served over HTTP because browsers block ES modules on `file://`.

## 6. Implementation status against the SRS

| Requirement | Status |
|---|---|
| FR-1, FR-2, FR-3.1–3.3, FR-3.5, FR-4, FR-6–FR-9, FR-11 | ✅ Implemented and changes data |
| FR-2.3 Reserve / Release bay | ✅ Changes bay state (*Hold* only shows a toast) |
| FR-3.4 Extend / Check out session | ⚠️ Shows a toast only; the session record is **not** updated (logged as DEF-01, Exp. 9) |
| FR-5 Reservation check-in / cancel | ⚠️ Shows a toast only; status is **not** updated (DEF-02) |
| FR-8 Acknowledge / dismiss alert | ✅ Changes data, badge updates |
| Payment gateway, ANPR, back-end persistence | ⏳ Out of scope for v1.0 (client-side store) |
