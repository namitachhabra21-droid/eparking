# ParkFlow eParking

A full-stack, multi-organization parking management application. The existing ParkFlow interface is backed by an authenticated Node.js API and persistent PostgreSQL storage.

**Live application:** https://eparkingse.vercel.app

**Repository:** https://github.com/namitachhabra21-droid/eparking

## Technology

- **Frontend:** responsive HTML/CSS, JavaScript ES modules, SVG charts, accessible dialogs, reusable searchable tables. No frontend build framework is required.
- **Backend:** Node.js 24, Express 5, Zod validation, Helmet security headers, rate limiting.
- **Database:** Neon PostgreSQL on Vercel. Organization business records are stored in a transactional JSONB aggregate; identities and sessions use relational tables. Row locks serialize concurrent allocations within an organization.
- **Authentication:** scrypt password hashes, opaque server-side sessions, hashed session tokens, HTTP-only cookies, same-origin and CSRF checks. Admin, operator and viewer roles are enforced by the API.
- **Hosting:** Vercel static assets and a Node.js function. GitHub integration enables deployment from this repository.
- **Tests:** Node test runner, Supertest API integration tests, PGlite PostgreSQL-compatible isolated test databases, Selenium WebDriver browser regression.

## Working features

- Create an organization and sign in. Workspaces are isolated; each starts with four configurable facilities and 680 available bays, with no fabricated operating records.
- Reserve a bay with an arrival date/time, driver, plate, vehicle, duration and expected payment method. The server assigns unique identifiers and rejects simultaneous allocation of the same bay.
- Check in a reservation, extend a stay, check out, record an actual received payment and download a receipt. Session, customer and bay state update in the same transaction.
- Cancel bookings, automatically expire no-shows, and place/release bays under maintenance.
- View actual occupancy, session charges, received-payment totals, activity history, overdue alerts and high-occupancy incidents.
- Add/edit customers and shift-roster records. Customer history is joined using stable IDs.
- Save organization details, alert thresholds and reservation grace rules. Configure facilities, capacities, zones and hourly tariffs.
- Manage workspace accounts with administrator/operator/viewer access, change passwords and sign out. Changing a password revokes previous sessions.
- Download session, customer, payment and staff CSV files. Potential spreadsheet formulas are neutralized in exported text.
- Search, sort, filter, paginate, switch themes, use keyboard shortcuts and work on mobile.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Without `DATABASE_URL`, development uses a **durable local PGlite database** in `.data/postgres`; installing a separate PostgreSQL server is unnecessary. `.data` is ignored by Git. Create your own account through **Create workspace**. There is no shared default administrator password.

To use PostgreSQL locally, copy `.env.example` to `.env`, set `DATABASE_URL` to a pooled TLS-enabled PostgreSQL connection string, and restart. Vercel CLI environment pulls use the ignored `.env.local` file; it takes precedence over `.env`. The API initializes its schema automatically under a PostgreSQL advisory transaction lock. Never commit environment files or database credentials.

```sh
npm test               # API and domain integration tests in isolated databases
npm run test:e2e        # Full-stack browser tests; Chrome required
npm run coverage       # Coverage for the API/domain test run
npm run build          # Copy deployable frontend into public/
npm start              # Start the local application server
```

Historical prototype tests are preserved separately (`npm run test:prototype`). Other files in `tests/e2e` and `docs/lab` document the original frontend prototype; the `fullstack.e2e.test.js` suite is the current application regression suite.

## Deploy to Vercel

1. Import this GitHub repository into Vercel, or link it with `vercel link`. Existing deployment project: `eparking_se`.
2. Use Node.js 24 and framework preset **Other**. The repository defines its build command and output directory in `vercel.json`.
3. Connect a Neon PostgreSQL resource in Vercel Storage/Marketplace. The API requires `DATABASE_URL` in every deployment environment. No filesystem database fallback is allowed in production.
4. Deploy with `vercel --prod`, or push to the repository's production branch after connecting the Vercel Git integration.
5. Check `/api/health`, register a private workspace, and exercise the booking → check-in → checkout flow.

The deployment serves only `public/` plus the API function; reports, local databases, test files and secrets are excluded. Source asset filenames are not immutable-cached, so updates reach clients promptly.

## Operational boundaries

**Payments:** this version records payments that an operator has actually received. Cash is recorded directly; UPI/Card/Wallet/FASTag require a verified external transaction reference. It does not charge cards, capture online payments or automatically refund. Connecting a live gateway requires your provider account, credentials and verified webhooks. No simulated payment is presented as collected money.

**Hardware and messaging:** cameras, gates, EV telemetry, SMS and email providers are not connected. Their status is explicitly shown as not connected. Find Plate performs a lookup in actual records. Alerts are available in-app.

**Reservation policy:** a reservation commits a bay immediately until arrival or cancellation. Check-in opens 30 minutes before arrival; the configurable grace period controls no-show expiration. A bay cannot simultaneously hold multiple future reservations. Session fares use the agreed hourly rate with a one-hour minimum; published rates apply to new bookings. Maintenance bays are excluded from availability.

**Refresh:** clients poll every ten seconds while visible; there are no fabricated bay flips. No-show and overstay housekeeping runs when the API is accessed. This is not a continuously running device gateway or a background notification service.

**Scale:** a JSONB aggregate per organization is deliberately simple and provides atomic changes. Large fleets should migrate high-volume records into indexed relational tables and use dedicated event ingestion. Received-payment summaries use recorded receipts; historical records are never generated to fill charts. The day total uses Asia/Kolkata; historical chart buckets are labeled UTC.

See [API and data design](docs/fullstack.md) for endpoints, security, transactions and operational notes. The Word reports in local `outputs/` describe the earlier prototype and are not a specification of this release.

## Presentation sample data

Administrators can open **Settings → Sample demo data → Load sample data**. This adds 12 fictional customers, 8 staff members, 18 active sessions, 84 historical completed sessions with sample payments, 10 upcoming reservations and 2 maintenance bays. Existing records are preserved and only free bays are committed. Loading twice does not duplicate records. A persistent banner identifies the fictional data, sample receipts are labeled, and exports include a demo column when applicable. Sample data is not real parking revenue.
