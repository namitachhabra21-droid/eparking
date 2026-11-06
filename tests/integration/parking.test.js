import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { createDatabase } from "../../server/database.js";
import { createApp } from "../../server/app.js";
import {
  initialState,
  applyAction,
  fare,
  reconcile,
  snapshot,
} from "../../server/domain.js";
let db, app, agent, csrf, user, booking, slot, session;
const password = "Correct parking horse 123!";
before(async () => {
  db = createDatabase(new PGlite());
  await db.init();
  app = createApp(db);
  agent = request.agent(app);
});
after(async () => db.close());
const mutate = (type, data = {}) =>
  agent.post("/api/actions").set("X-CSRF-Token", csrf).send({ type, data });
test("unauthed users cannot read business data", async () => {
  await request(app).get("/api/state").expect(401);
});
test("registration validates password and organization", async () => {
  await agent
    .post("/api/auth/register")
    .send({
      name: "Namita",
      email: "test@example.com",
      password: "short",
      organization: "Test",
    })
    .expect(400);
});
test("register creates an isolated organization with free configured bays", async () => {
  const r = await agent
    .post("/api/auth/register")
    .send({
      name: "Test Admin",
      email: "admin@example.com",
      password,
      organization: "Parking Tests",
    })
    .expect(201);
  csrf = r.body.csrf;
  user = r.body.user;
  assert.equal(user.role, "admin");
  const s = await agent.get("/api/state").expect(200);
  assert.equal(s.body.state.slots.length, 680);
  assert.equal(
    s.body.state.slots.filter((s) => s.status === "free").length,
    680,
  );
  assert.equal(s.body.state.sessions.length, 0);
  slot = s.body.state.slots[0].id;
});
test("HTTP only cookies and CSRF required for mutations", async () => {
  await agent
    .post("/api/actions")
    .send({ type: "hold", data: { slot, reason: "Testing hold" } })
    .expect(403);
  await agent
    .post("/api/actions")
    .set("X-CSRF-Token", csrf)
    .set("Origin", "https://evil.example")
    .send({ type: "hold", data: { slot, reason: "Testing hold" } })
    .expect(403);
});
test("booking stores requested arrival and driver details", async () => {
  const at = Date.now() + 60000;
  const r = await mutate("book", {
    slot,
    name: "Asha Rao",
    plate: "mh 12 ab 1234",
    hours: 2,
    at,
    method: "Cash",
    email: "asha@example.com",
    vehicle: "Tata Nexon",
  }).expect(200);
  booking = r.body.result;
  assert.equal(booking.plate, "MH 12 AB 1234");
  assert.equal(booking.at, at);
  assert.equal(booking.user, "Asha Rao");
  assert.equal(
    r.body.state.slots.find((s) => s.id === slot).status,
    "reserved",
  );
});
test("concurrent reservations cannot allocate the same bay", async () => {
  const next = "L1-A02";
  const data = {
    slot: next,
    name: "Test Driver",
    plate: "MH12AB9999",
    hours: 1,
    at: Date.now() + 60000,
    method: "Cash",
  };
  const result = await Promise.all([
    mutate("book", data),
    mutate("book", data),
  ]);
  assert.deepEqual(result.map((r) => r.status).sort(), [200, 409]);
});
test("checkin creates a linked session and updates customer visits", async () => {
  const r = await mutate("checkin", { id: booking.id }).expect(200);
  session = r.body.result;
  assert.equal(session.customerId, booking.customerId);
  assert.equal(
    r.body.state.slots.find((s) => s.id === slot).status,
    "occupied",
  );
  assert.equal(
    r.body.state.customers.find((c) => c.id === booking.customerId).visits,
    1,
  );
});
test("duplicate check-in is rejected without an extra session", async () => {
  await mutate("checkin", { id: booking.id }).expect(409);
});
test("occupied bay cannot be released bypassing payment", async () => {
  await mutate("release", { slot }).expect(409);
});
test("session extension persists expected end", async () => {
  const r = await mutate("extend", { id: session.id, hours: 1 }).expect(200);
  assert.equal(r.body.result.expectedEnd, session.expectedEnd + 3600000);
});
test("noncash settlement requires an external verification reference", async () => {
  await mutate("checkout", { id: session.id, method: "UPI" }).expect(400);
});
test("checkout records payment, releases bay and updates customer spend", async () => {
  const r = await mutate("checkout", { id: session.id, method: "Cash" }).expect(
    200,
  );
  assert.equal(r.body.result.status, "completed");
  assert.equal(r.body.result.paymentStatus, "paid");
  assert.equal(r.body.state.slots.find((s) => s.id === slot).status, "free");
  assert.equal(r.body.state.payments.length, 1);
  assert.equal(
    r.body.state.customers.find((c) => c.id === booking.customerId).spend,
    60,
  );
});
test("duplicate checkout cannot charge twice", async () => {
  await mutate("checkout", { id: session.id, method: "Cash" }).expect(409);
  const r = await agent.get("/api/state");
  assert.equal(r.body.state.payments.length, 1);
});
test("maintenance state persists and prevents booking", async () => {
  await mutate("hold", { slot, reason: "Surface repair" }).expect(200);
  await mutate("book", {
    slot,
    name: "Blocked Driver",
    plate: "MH12CD8888",
    hours: 1,
    at: Date.now(),
    method: "Cash",
  }).expect(409);
  await mutate("release", { slot }).expect(200);
});
test("cancellation releases bay and preserves cancelled record", async () => {
  const r = await mutate("book", {
    slot,
    name: "Cancel Driver",
    plate: "MH12CD7777",
    hours: 1,
    at: Date.now() + 60000,
    method: "Cash",
  }).expect(200);
  const c = await mutate("cancel", { id: r.body.result.id }).expect(200);
  assert.equal(c.body.result.status, "cancelled");
  assert.equal(c.body.state.slots.find((s) => s.id === slot).status, "free");
});
test("settings and tariff changes persist", async () => {
  await mutate("settings", {
    name: "New Organization",
    email: "support@example.com",
    occupancyThreshold: 85,
    reservationGrace: 20,
  }).expect(200);
  await mutate("facility", {
    id: "L1",
    name: "Central Plaza",
    addr: "Updated address",
    cap: 180,
    rate: 75,
    zones: ["A", "B", "C"],
  }).expect(200);
  const s = await agent.get("/api/state");
  assert.equal(s.body.state.settings.name, "New Organization");
  assert.equal(s.body.state.lots[0].rate, 75);
});
test("invalid dates and unknown operations rejected", async () => {
  await mutate("book", {
    slot,
    name: "Old Driver",
    plate: "MH12CD6666",
    hours: 1,
    at: 0,
    method: "Cash",
  }).expect(400);
  await mutate("arbitrary-code", {}).expect(400);
});
test("customer and staff management preserve records", async () => {
  const c = await mutate("customer", {
    name: "Corporate Account",
    email: "corp@example.com",
    plan: "Business",
    ev: true,
    status: "active",
  }).expect(200);
  await mutate("customer", {
    ...c.body.result,
    name: "Updated Account",
  }).expect(200);
  const r = await mutate("staff", {
    name: "Shift Operator",
    email: "staff@example.com",
    role: "Supervisor",
    lotId: "L1",
    shift: "06:00–14:00",
    status: "on-duty",
  }).expect(200);
  assert.equal(r.body.result.lot, "Central Plaza");
});
test("admins can create viewer accounts and enforce read-only access server-side", async () => {
  await agent
    .post("/api/users")
    .set("X-CSRF-Token", csrf)
    .send({
      name: "Viewer",
      email: "viewer@example.com",
      password,
      role: "viewer",
    })
    .expect(201);
  const viewer = request.agent(app);
  const login = await viewer
    .post("/api/auth/login")
    .send({ email: "viewer@example.com", password })
    .expect(200);
  assert.ok(login.headers["set-cookie"][0].includes("HttpOnly"));
  await viewer.get("/api/state").expect(200);
  await viewer
    .post("/api/actions")
    .set("X-CSRF-Token", login.body.csrf)
    .send({ type: "hold", data: { slot, reason: "Forbidden" } })
    .expect(403);
  await viewer.get("/api/users").expect(403);
});
test("separate organizations cannot see another organization records", async () => {
  const other = request.agent(app);
  await other
    .post("/api/auth/register")
    .send({
      name: "Other Admin",
      email: "other@example.com",
      password,
      organization: "Other Team",
    })
    .expect(201);
  const r = await other.get("/api/state");
  assert.equal(r.body.state.sessions.length, 0);
  assert.equal(r.body.state.settings.name, "Other Team");
});
test("password change invalidates old sessions and accepts new password", async () => {
  const next = "New strong parking password 456!";
  const r = await agent
    .post("/api/auth/password")
    .set("X-CSRF-Token", csrf)
    .send({ current: password, password: next })
    .expect(200);
  csrf = r.body.csrf;
  await agent.get("/api/auth/me").expect(200);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@example.com", password })
    .expect(401);
  await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@example.com", password: next })
    .expect(200);
});
test("logout revokes the server-side session", async () => {
  await agent
    .post("/api/auth/logout")
    .set("X-CSRF-Token", csrf)
    .send({})
    .expect(200);
  await agent.get("/api/state").expect(401);
});
test("billing and no-show boundary rules are deterministic", () => {
  assert.equal(fare(60, 20), 60);
  assert.equal(fare(60, 90), 90);
  const state = initialState("Boundary Test"),
    now = Date.now(),
    u = { id: "test", name: "Admin", role: "admin" };
  const r = applyAction(
    state,
    u,
    "book",
    {
      slot: state.slots[0].id,
      name: "Boundary Driver",
      plate: "MH12XX4321",
      hours: 1,
      at: now,
      method: "Cash",
    },
    now,
  );
  reconcile(state, now + 31 * 60000);
  assert.equal(r.status, "no-show");
  assert.equal(state.slots[0].status, "free");
  assert.equal(
    snapshot(state, now).series.months.reduce((n, m) => n + m.rev, 0),
    0,
  );
});
test("schema validation prevents invalid tariff and capacity mutations", () => {
  const s = initialState("Validation");
  assert.throws(() =>
    applyAction(s, { role: "admin", name: "A", id: "a" }, "facility", {
      name: "Bad lot",
      addr: "Bad address",
      cap: -1,
      rate: -1,
      zones: ["A"],
    }),
  );
});
