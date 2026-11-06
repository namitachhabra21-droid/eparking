// Cloud verification creates and removes only its own uniquely named QA workspace.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import dotenv from "dotenv";
const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base))
  throw new Error("Usage: node scripts/smoke.mjs https://deployment.example");
if (process.env.SMOKE_ENV_FILE)
  dotenv.config({
    path: process.env.SMOKE_ENV_FILE,
    override: true,
    quiet: true,
  });
const { getDatabase } = await import("../server/database.js");
const db = await getDatabase();
let userId,
  cookie = "",
  csrf = "";
async function call(path, data) {
  const response = await fetch(base + path, {
    method: data ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  const body = await response.json();
  if (body.csrf) csrf = body.csrf;
  return { status: response.status, body };
}
try {
  assert.equal((await call("/api/health")).status, 200);
  const reg = await call("/api/auth/register", {
    name: "Deployment QA",
    email: `qa-${randomUUID()}@parkflow.example`,
    password: randomBytes(24).toString("base64url"),
    organization: "Temporary Deployment Verification",
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  userId = reg.body.user.id;
  let state = await call("/api/state");
  assert.equal(state.status, 200);
  assert.equal(state.body.state.slots.length, 680);
  const data = {
    slot: state.body.state.slots[0].id,
    name: "Cloud QA Driver",
    plate: "QA12AB1234",
    hours: 1,
    at: Date.now() + 60000,
    method: "Cash",
  };
  const responses = await Promise.all([
    call("/api/actions", { type: "book", data }),
    call("/api/actions", { type: "book", data }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const booking = responses.find((r) => r.status === 200).body.result;
  const checkin = await call("/api/actions", {
    type: "checkin",
    data: { id: booking.id },
  });
  assert.equal(checkin.status, 200);
  const session = checkin.body.result;
  const checkout = await call("/api/actions", {
    type: "checkout",
    data: { id: session.id, method: "Cash" },
  });
  assert.equal(checkout.status, 200);
  state = await call("/api/state");
  assert.equal(state.body.state.payments.length, 1);
  assert.equal(
    state.body.state.slots.find((s) => s.id === data.slot).status,
    "free",
  );
  // Separate HTTP request reads committed records from PostgreSQL, rather than client memory.
  assert.equal(state.body.state.sessions[0].status, "completed");
  console.log(
    "Cloud checks passed: readiness, authentication, durable records, concurrent allocation, check-in, checkout and payment.",
  );
} finally {
  if (userId) {
    await db.transaction(async (tx) => {
      const { rows } = await tx.query(
        "SELECT organization_id FROM users WHERE id=$1",
        [userId],
      );
      if (rows.length) {
        const id = rows[0].organization_id;
        await tx.query("DELETE FROM parking_state WHERE organization_id=$1", [
          id,
        ]);
        await tx.query("DELETE FROM users WHERE organization_id=$1", [id]);
        await tx.query("DELETE FROM organizations WHERE id=$1", [id]);
      }
    });
    console.log("Temporary QA workspace removed.");
  }
  await db.close();
}
