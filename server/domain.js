import { randomUUID } from "node:crypto";
import { z } from "zod";
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};
const str = (min = 1, max = 120) => z.string().trim().min(min).max(max);
const plate = str(3, 20).transform((s) => s.toUpperCase());
const id = str(1, 100);
const hours = z.number().int().min(1).max(168);
const method = z.enum(["Cash", "UPI", "Card", "Wallet", "FASTag"]);
const roles = z.enum(["admin", "operator", "viewer"]);
export const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(12).max(128),
});
export const registerSchema = credentials.extend({
  name: str(2, 100),
  organization: str(2, 120),
});
export const userSchema = credentials.extend({
  name: str(2, 100),
  role: roles,
});
export const schemas = {
  book: z.object({
    slot: id,
    name: str(2, 100),
    plate,
    hours,
    at: z.number().finite(),
    method,
    customerId: id.optional(),
    email: z.union([z.string().email().max(200), z.literal("")]).optional(),
    vehicle: str(1, 80).default("Vehicle"),
  }),
  checkin: z.object({ id }),
  cancel: z.object({ id }),
  extend: z.object({ id, hours }),
  checkout: z.object({ id, method, reference: str(1, 120).optional() }),
  hold: z.object({ slot: id, reason: str(3, 200) }),
  release: z.object({ slot: id }),
  alert: z.object({ id, action: z.enum(["ack", "dismiss"]) }),
  ackall: z.object({}),
  customer: z.object({
    id: id.optional(),
    name: str(2, 100),
    email: z.string().trim().email().max(200),
    plan: z.enum(["Basic", "Plus", "Business", "Enterprise"]),
    ev: z.boolean().default(false),
    status: z.enum(["active", "dormant"]).default("active"),
  }),
  staff: z.object({
    id: id.optional(),
    name: str(2, 100),
    email: z.string().email().max(200),
    role: str(2, 80),
    lotId: id,
    shift: str(3, 80),
    status: z.enum(["on-duty", "off-duty"]),
  }),
  settings: z.object({
    name: str(2, 120),
    email: z.union([z.string().email().max(200), z.literal("")]),
    occupancyThreshold: z.number().int().min(50).max(100),
    reservationGrace: z.number().int().min(5).max(120),
  }),
  facility: z.object({
    id: id.optional(),
    name: str(2, 100),
    addr: str(3, 180),
    cap: z.number().int().min(1).max(1000),
    rate: z.number().int().min(1).max(10000),
    zones: z
      .array(str(1, 3).regex(/^[A-Z0-9]+$/))
      .min(1)
      .max(10),
  }),
};
const newId = (prefix) => `${prefix}-${randomUUID()}`;
export function makeSlots(lot) {
  const slots = [];
  lot.zones.forEach((zone, zi) => {
    const per =
      Math.floor(lot.cap / lot.zones.length) +
      (zi < lot.cap % lot.zones.length ? 1 : 0);
    for (let n = 1; n <= per; n++)
      slots.push({
        id: `${lot.id}-${zone}${String(n).padStart(2, "0")}`,
        lot: lot.id,
        zone,
        num: n,
        floor: zi + 1,
        type: n % 11 === 0 ? "ev" : n % 17 === 0 ? "acc" : "std",
        status: "free",
        since: null,
        plate: null,
      });
  });
  return slots;
}
export function initialState(name) {
  const lots = [
    {
      id: "L1",
      name: "Central Plaza",
      addr: "221 Marine Drive",
      zones: ["A", "B", "C"],
      cap: 180,
      rate: 60,
      tint: "#3366f2",
    },
    {
      id: "L2",
      name: "Skyline Tower",
      addr: "9 Peninsula Business Park",
      zones: ["A", "B"],
      cap: 120,
      rate: 80,
      tint: "#06b6d4",
    },
    {
      id: "L3",
      name: "Metro Interchange",
      addr: "Line 3 Gate 4",
      zones: ["A", "B", "C"],
      cap: 220,
      rate: 40,
      tint: "#8b5cf6",
    },
    {
      id: "L4",
      name: "Airport T2 Long Stay",
      addr: "Terminal 2 Access Road",
      zones: ["A", "B"],
      cap: 160,
      rate: 100,
      tint: "#f59e0b",
    },
  ];
  return {
    lots,
    slots: lots.flatMap(makeSlots),
    sessions: [],
    reservations: [],
    customers: [],
    staff: [],
    alerts: [],
    activity: [],
    payments: [],
    settings: { name, email: "", occupancyThreshold: 90, reservationGrace: 30 },
  };
}
export function fare(rate, minutes) {
  return Math.max(rate, Math.round((rate * Math.max(0, minutes)) / 60));
}
export function event(state, user, text, tone = "ok") {
  state.activity.unshift({
    id: newId("EVT"),
    text,
    actor: user.name,
    actorId: user.id,
    tone,
    icon: "ticket",
    at: Date.now(),
  });
  state.activity = state.activity.slice(0, 500);
}
function releaseBay(bay) {
  Object.assign(bay, {
    status: "free",
    plate: null,
    since: null,
    reason: null,
    reservationId: null,
  });
}
function active(s) {
  return s.status === "active" || s.status === "overstay";
}
export function reconcile(state, now = Date.now()) {
  for (const r of state.reservations) {
    if (
      r.status === "confirmed" &&
      now > r.at + state.settings.reservationGrace * 60000
    ) {
      r.status = "no-show";
      const bay = state.slots.find((s) => s.id === r.slot);
      if (bay?.reservationId === r.id) releaseBay(bay);
      event(
        state,
        { id: "system", name: "System" },
        `Reservation for ${r.plate} expired as a no-show`,
        "warn",
      );
    }
  }
  for (const s of state.sessions)
    if (active(s)) {
      s.mins = Math.max(0, Math.round((now - s.start) / 60000));
      s.amount = fare(s.rate, s.mins);
      if (now > s.expectedEnd) {
        s.status = "overstay";
        if (!state.alerts.some((a) => a.key === `overstay:${s.id}`))
          state.alerts.unshift({
            id: newId("ALR"),
            key: `overstay:${s.id}`,
            sev: "warn",
            icon: "clock",
            title: "Parking session overdue",
            body: `Vehicle ${s.plate} has exceeded its booked stay.`,
            lot: s.lot,
            lotId: s.lotId,
            at: now,
            ack: false,
          });
      }
    }
  for (const l of state.lots) {
    const occupied = state.slots.filter(
      (s) => s.lot === l.id && s.status === "occupied",
    ).length;
    if (
      (occupied / l.cap) * 100 >= state.settings.occupancyThreshold &&
      !state.alerts.some((a) => a.key === `capacity:${l.id}` && !a.ack)
    )
      state.alerts.unshift({
        id: newId("ALR"),
        key: `capacity:${l.id}`,
        sev: "warn",
        icon: "car",
        title: "High facility occupancy",
        body: `${l.name} exceeded its configured occupancy threshold.`,
        lot: l.name,
        lotId: l.id,
        at: now,
        ack: false,
      });
  }
}
export function applyAction(state, user, type, input, now = Date.now()) {
  if (user.role === "viewer") fail(403, "Your account has read-only access");
  if (["settings", "facility", "staff"].includes(type) && user.role !== "admin")
    fail(403, "Administrator access required");
  const schema = schemas[type];
  if (!schema) fail(400, "Unknown operation");
  const x = schema.parse(input);
  reconcile(state, now);
  let result;
  const find = (list, value) =>
    list.find((r) => r.id === value) || fail(404, "Record not found");
  if (type === "book") {
    const bay = find(state.slots, x.slot);
    if (bay.status !== "free")
      fail(409, "This bay is no longer available. Choose another bay.");
    if (x.at < now - 5 * 60000 || x.at > now + 90 * 86400000)
      fail(400, "Arrival must be within the next 90 days");
    const lot = find(state.lots, bay.lot);
    if (x.customerId) find(state.customers, x.customerId);
    let customer = x.customerId
      ? find(state.customers, x.customerId)
      : state.customers.find(
          (c) => x.email && c.email.toLowerCase() === x.email.toLowerCase(),
        );
    if (!customer) {
      customer = {
        id: newId("CUS"),
        name: x.name,
        email: x.email || "",
        plan: "Basic",
        ev: bay.type === "ev",
        status: "active",
        since: now,
        visits: 0,
        spend: 0,
        plates: 1,
      };
      state.customers.unshift(customer);
    }
    result = {
      id: newId("RSV"),
      user: x.name,
      plate: x.plate,
      vehicle: x.vehicle,
      customerId: customer.id,
      lot: lot.name,
      lotId: lot.id,
      slot: bay.id,
      at: x.at,
      hours: x.hours,
      rate: lot.rate,
      amount: lot.rate * x.hours,
      status: "confirmed",
      channel: "Web",
      method: x.method,
      createdAt: now,
      createdBy: user.id,
    };
    state.reservations.unshift(result);
    Object.assign(bay, {
      status: "reserved",
      plate: x.plate,
      since: now,
      reservationId: result.id,
    });
    event(state, user, `${user.name} reserved ${bay.id} for ${x.name}`);
  } else if (type === "checkin") {
    const r = find(state.reservations, x.id);
    if (r.status !== "confirmed")
      fail(409, "Only a confirmed reservation can check in");
    if (now < r.at - 30 * 60000)
      fail(400, "Check-in opens 30 minutes before arrival");
    const bay = find(state.slots, r.slot);
    if (bay.status !== "reserved" || bay.reservationId !== r.id)
      fail(409, "The bay is not assigned to this reservation");
    if (state.sessions.some((s) => s.slot === bay.id && active(s)))
      fail(409, "An active session already occupies this bay");
    r.status = "checked-in";
    bay.status = "occupied";
    bay.since = now;
    result = {
      id: newId("SES"),
      reservationId: r.id,
      customerId: r.customerId,
      slot: r.slot,
      lotId: r.lotId,
      lot: r.lot,
      user: r.user,
      plate: r.plate,
      vehicle: r.vehicle,
      zone: bay.zone,
      start: now,
      expectedEnd: now + r.hours * 3600000,
      mins: 0,
      rate: r.rate,
      amount: r.rate,
      status: "active",
      paymentStatus: "unpaid",
      method: r.method,
      ev: bay.type === "ev",
    };
    state.sessions.unshift(result);
    find(state.customers, r.customerId).visits++;
    event(state, user, `${r.user} checked in at ${r.slot}`);
  } else if (type === "cancel") {
    const r = find(state.reservations, x.id);
    if (!["confirmed", "pending"].includes(r.status))
      fail(409, "This booking cannot be cancelled");
    r.status = "cancelled";
    const bay = find(state.slots, r.slot);
    if (bay.reservationId === r.id) releaseBay(bay);
    result = r;
    event(state, user, `Reservation ${r.id} cancelled`, "warn");
  } else if (type === "extend") {
    const s = find(state.sessions, x.id);
    if (!active(s)) fail(409, "Session is already completed");
    s.expectedEnd = Math.max(s.expectedEnd, now) + x.hours * 3600000;
    s.status = "active";
    result = s;
    event(state, user, `Session for ${s.plate} extended by ${x.hours} hours`);
  } else if (type === "checkout") {
    const s = find(state.sessions, x.id);
    if (!active(s)) fail(409, "This session has already checked out");
    if (x.method !== "Cash" && !x.reference)
      fail(
        400,
        "A verified external transaction reference is required for non-cash payments",
      );
    s.mins = Math.max(0, Math.round((now - s.start) / 60000));
    s.amount = fare(s.rate, s.mins);
    s.end = now;
    s.status = "completed";
    s.paymentStatus = "paid";
    s.method = x.method;
    const pay = {
      id: newId("PAY"),
      sessionId: s.id,
      amount: s.amount,
      method: x.method,
      reference: x.reference || null,
      paidAt: now,
      recordedBy: user.id,
      kind: x.method === "Cash" ? "cash-recorded" : "externally-verified",
    };
    state.payments.unshift(pay);
    s.paymentId = pay.id;
    find(state.customers, s.customerId).spend += s.amount;
    releaseBay(find(state.slots, s.slot));
    result = s;
    event(
      state,
      user,
      `${s.plate} checked out; ${s.amount} INR ${x.method} payment recorded`,
    );
  } else if (type === "hold") {
    const bay = find(state.slots, x.slot);
    if (bay.status !== "free")
      fail(409, "Only a free bay can enter maintenance");
    Object.assign(bay, { status: "maintenance", reason: x.reason, since: now });
    result = bay;
    event(state, user, `${bay.id} placed in maintenance: ${x.reason}`, "warn");
  } else if (type === "release") {
    const bay = find(state.slots, x.slot);
    if (bay.status === "occupied")
      fail(
        409,
        "Check out the linked session before releasing an occupied bay",
      );
    if (bay.reservationId) {
      const r = state.reservations.find((r) => r.id === bay.reservationId);
      if (r?.status === "confirmed") r.status = "cancelled";
    }
    releaseBay(bay);
    result = bay;
    event(state, user, `${bay.id} released`);
  } else if (type === "alert") {
    const a = find(state.alerts, x.id);
    if (x.action === "ack") a.ack = true;
    else state.alerts = state.alerts.filter((a) => a.id !== x.id);
    event(
      state,
      user,
      `Alert ${x.action === "ack" ? "acknowledged" : "dismissed"}: ${a.title}`,
    );
    result = a;
  } else if (type === "ackall") {
    state.alerts.forEach((a) => (a.ack = true));
    event(state, user, "All alerts acknowledged");
  } else if (type === "customer") {
    const duplicate = state.customers.find(
      (c) => c.email.toLowerCase() === x.email.toLowerCase() && c.id !== x.id,
    );
    if (duplicate) fail(409, "A customer with this email already exists");
    if (x.id) {
      result = find(state.customers, x.id);
      Object.assign(result, x);
    } else {
      result = {
        ...x,
        id: newId("CUS"),
        since: now,
        visits: 0,
        spend: 0,
        plates: 1,
      };
      state.customers.unshift(result);
    }
    event(state, user, `Customer ${result.name} saved`);
  } else if (type === "staff") {
    const lot = find(state.lots, x.lotId);
    if (x.id) {
      result = find(state.staff, x.id);
      Object.assign(result, x, { lot: lot.name });
    } else {
      result = { ...x, id: newId("STF"), lot: lot.name };
      state.staff.unshift(result);
    }
    event(state, user, `Team member ${result.name} saved`);
  } else if (type === "settings") {
    state.settings = { ...state.settings, ...x };
    result = state.settings;
    event(state, user, "Organization settings updated");
  } else if (type === "facility") {
    if (new Set(x.zones).size !== x.zones.length)
      fail(400, "Zone names must be unique");
    if (
      state.lots.some(
        (l) => l.id !== x.id && l.name.toLowerCase() === x.name.toLowerCase(),
      )
    )
      fail(409, "Facility name already exists");
    if (x.id) {
      const lot = find(state.lots, x.id);
      if (
        (lot.cap !== x.cap ||
          JSON.stringify(lot.zones) !== JSON.stringify(x.zones)) &&
        state.slots.some((s) => s.lot === lot.id && s.status !== "free")
      )
        fail(
          409,
          "Capacity and zones can change only when all facility bays are free",
        );
      if (
        lot.cap !== x.cap ||
        JSON.stringify(lot.zones) !== JSON.stringify(x.zones)
      )
        state.slots = [
          ...state.slots.filter((s) => s.lot !== lot.id),
          ...makeSlots({ ...lot, ...x }),
        ];
      Object.assign(lot, x);
      result = lot;
    } else {
      if (state.lots.length >= 20)
        fail(400, "Maximum 20 facilities per organization");
      result = { ...x, id: newId("LOT"), tint: "#3366f2" };
      state.lots.push(result);
      state.slots.push(...makeSlots(result));
    }
    event(state, user, `Facility ${result.name} saved`);
  }
  return result;
}
export function snapshot(state, now = Date.now()) {
  reconcile(state, now);
  const settled = state.sessions.filter((s) => s.status === "completed");
  const hours = Array.from({ length: 24 }, (_, h) => {
    const from = new Date(now);
    from.setUTCHours(h, 0, 0, 0);
    const end = +from + 3600000;
    const sessions = state.sessions.filter(
      (s) => s.start < end && (s.end || now) > +from,
    );
    return {
      h,
      sessions: sessions.length,
      ev: sessions.filter((s) => s.ev).length,
      occ: state.slots.length
        ? Math.round((sessions.length / state.slots.length) * 100)
        : 0,
      rev: state.payments
        .filter((p) => p.paidAt >= +from && p.paidAt < end)
        .reduce((n, p) => n + p.amount, 0),
    };
  });
  const days = Array.from({ length: 7 }, (_, i) => {
    const from = new Date(now);
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - 6 + i);
    return {
      day: from.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }),
      rev: state.payments
        .filter((p) => p.paidAt >= +from && p.paidAt < +from + 86400000)
        .reduce((n, p) => n + p.amount, 0),
      sessions: state.sessions.filter(
        (s) => s.start >= +from && s.start < +from + 86400000,
      ).length,
    };
  });
  const months = Array.from({ length: 6 }, (_, i) => {
    const from = new Date(now);
    from.setUTCDate(1);
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCMonth(from.getUTCMonth() - 5 + i);
    const next = new Date(from);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const prev = new Date(from);
    prev.setUTCFullYear(prev.getUTCFullYear() - 1);
    const prevEnd = new Date(next);
    prevEnd.setUTCFullYear(prevEnd.getUTCFullYear() - 1);
    return {
      m: from.toLocaleDateString("en", { month: "short", timeZone: "UTC" }),
      rev: state.payments
        .filter((p) => p.paidAt >= +from && p.paidAt < +next)
        .reduce((n, p) => n + p.amount, 0),
      prev: state.payments
        .filter((p) => p.paidAt >= +prev && p.paidAt < +prevEnd)
        .reduce((n, p) => n + p.amount, 0),
    };
  });
  return {
    ...state,
    series: { hours, days, months },
    settledCount: settled.length,
  };
}
