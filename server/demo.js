import { randomUUID } from "node:crypto";
const id = (prefix) => `${prefix}-${randomUUID()}`;

// Fictional records are explicitly tagged. Existing records and committed bays are preserved.
export function loadDemoData(state, user, now = Date.now()) {
  if (state.demo) return state.demo;
  const free = state.slots.filter(
    (s) =>
      s.status === "free" && !["L1-A01", "L1-A02", "L1-A03"].includes(s.id),
  );
  const queues = state.lots.map((l) => free.filter((s) => s.lot === l.id));
  const available = [];
  while (queues.some((q) => q.length))
    for (const q of queues) if (q.length) available.push(q.shift());
  if (available.length < 30) {
    const error = new Error(
      "At least 30 free bays are needed to load sample data",
    );
    error.status = 409;
    throw error;
  }
  const names = [
    "Aarav Sharma",
    "Priya Mehta",
    "Kabir Singh",
    "Ananya Rao",
    "Rohan Gupta",
    "Isha Kapoor",
    "Vivaan Patel",
    "Diya Verma",
    "Arjun Nair",
    "Sana Khan",
    "Aditya Shah",
    "Meera Joshi",
  ];
  const customers = names.map((name, i) => ({
    id: id("CUS"),
    name,
    email: `demo.driver${i + 1}@example.com`,
    plan: ["Basic", "Plus", "Business", "Enterprise"][i % 4],
    ev: i % 3 === 0,
    status: "active",
    since: now - (50 + i * 9) * 86400000,
    visits: 0,
    spend: 0,
    plates: 1,
    demo: true,
  }));
  state.customers.push(...customers);
  const methods = ["Cash", "UPI", "Card", "Wallet", "FASTag"];
  const vehicle = [
    "Tata Nexon",
    "Hyundai Creta",
    "Honda City",
    "Tata Nexon EV",
  ];
  const makeReservation = (bay, customer, index, at, hours, status) => {
    const lot = state.lots.find((l) => l.id === bay.lot);
    const r = {
      id: id("RSV"),
      user: customer.name,
      customerId: customer.id,
      plate: `DEMO ${String(index + 1).padStart(4, "0")}`,
      vehicle: vehicle[index % 4],
      slot: bay.id,
      lot: lot.name,
      lotId: lot.id,
      at,
      hours,
      rate: lot.rate,
      amount: lot.rate * hours,
      status,
      channel: "Web",
      method: methods[index % 5],
      createdAt: at - 3600000,
      createdBy: user.id,
      demo: true,
    };
    state.reservations.push(r);
    return r;
  };
  let completed = 0;
  // Six months of clearly labeled demonstration history, including today's receipts.
  for (let i = 0; i < 84; i++) {
    const bay = available[i % available.length],
      customer = customers[i % customers.length],
      lot = state.lots.find((l) => l.id === bay.lot);
    const daysAgo = i < 12 ? 0 : i < 24 ? 1 : 3 + (i - 24) * 2;
    const end = now - daysAgo * 86400000 - (15 + (i % 12) * 25) * 60000;
    const mins = 45 + (i % 7) * 30,
      start = end - mins * 60000;
    const r = makeReservation(
      bay,
      customer,
      i,
      start,
      Math.max(1, Math.ceil(mins / 60)),
      "checked-in",
    );
    const amount = Math.max(lot.rate, Math.round((lot.rate * mins) / 60));
    const s = {
      id: id("SES"),
      reservationId: r.id,
      customerId: customer.id,
      slot: bay.id,
      lot: lot.name,
      lotId: lot.id,
      user: customer.name,
      plate: r.plate,
      vehicle: r.vehicle,
      zone: bay.zone,
      start,
      end,
      expectedEnd: end,
      mins,
      rate: lot.rate,
      amount,
      status: "completed",
      paymentStatus: "paid",
      method: r.method,
      ev: bay.type === "ev",
      demo: true,
    };
    const p = {
      id: id("PAY"),
      sessionId: s.id,
      amount,
      method: r.method,
      reference: `DEMO-${i + 1}`,
      paidAt: end,
      recordedBy: user.id,
      kind: "sample",
      demo: true,
    };
    s.paymentId = p.id;
    state.sessions.push(s);
    state.payments.push(p);
    customer.visits++;
    customer.spend += amount;
    completed++;
  }
  // Occupied bays and their reservations/sessions are always linked consistently.
  for (let i = 0; i < 18; i++) {
    const bay = available.shift(),
      customer = customers[i % customers.length],
      elapsed = i === 0 ? 90 : 20 + i * 8,
      start = now - elapsed * 60000;
    const r = makeReservation(
      bay,
      customer,
      100 + i,
      start,
      i === 0 ? 1 : 4,
      "checked-in",
    );
    const expectedEnd = start + r.hours * 3600000;
    const s = {
      id: id("SES"),
      reservationId: r.id,
      customerId: customer.id,
      slot: bay.id,
      lotId: r.lotId,
      lot: r.lot,
      user: r.user,
      plate: r.plate,
      vehicle: r.vehicle,
      zone: bay.zone,
      start,
      expectedEnd,
      mins: elapsed,
      rate: r.rate,
      amount: Math.max(r.rate, Math.round((r.rate * elapsed) / 60)),
      status: "active",
      paymentStatus: "unpaid",
      method: r.method,
      ev: bay.type === "ev",
      demo: true,
    };
    state.sessions.push(s);
    customer.visits++;
    Object.assign(bay, {
      status: "occupied",
      plate: r.plate,
      since: start,
      reservationId: r.id,
      demo: true,
    });
  }
  for (let i = 0; i < 10; i++) {
    const bay = available.shift(),
      customer = customers[(i + 4) % customers.length];
    const r = makeReservation(
      bay,
      customer,
      200 + i,
      now + (10 + i * 20) * 60000,
      1 + (i % 4),
      "confirmed",
    );
    Object.assign(bay, {
      status: "reserved",
      plate: r.plate,
      since: now,
      reservationId: r.id,
      demo: true,
    });
  }
  for (let i = 0; i < 2; i++)
    Object.assign(available.shift(), {
      status: "maintenance",
      reason: "Sample maintenance inspection",
      since: now,
      demo: true,
    });
  const staffNames = [
    "Amit Saini",
    "Pooja Sharma",
    "Rahul Yadav",
    "Neha Singh",
    "Kunal Mehta",
    "Tanya Jain",
    "Dev Patel",
    "Riya Nair",
  ];
  staffNames.forEach((name, i) => {
    const lot = state.lots[i % state.lots.length];
    state.staff.push({
      id: id("STF"),
      name,
      email: `demo.staff${i + 1}@example.com`,
      role: i % 3 === 0 ? "Lot Supervisor" : "Attendant",
      lotId: lot.id,
      lot: lot.name,
      shift: ["06:00–14:00", "14:00–22:00", "22:00–06:00"][i % 3],
      status: i < 6 ? "on-duty" : "off-duty",
      demo: true,
    });
  });
  state.sessions.sort((a, b) => b.start - a.start);
  state.reservations.sort((a, b) => b.createdAt - a.createdAt);
  state.payments.sort((a, b) => b.paidAt - a.paidAt);
  state.demo = {
    loadedAt: now,
    loadedBy: user.id,
    customers: 12,
    staff: 8,
    completedSessions: completed,
    activeSessions: 18,
    upcomingReservations: 10,
    maintenanceBays: 2,
  };
  state.activity.unshift({
    id: id("EVT"),
    text: "Fictional sample data loaded for demonstration. Sample payments are not actual receipts.",
    actor: user.name,
    actorId: user.id,
    tone: "info",
    icon: "ticket",
    at: now,
    demo: true,
  });
  for (const s of state.sessions
    .filter((s) => s.demo && s.status === "active")
    .slice(0, 6))
    state.activity.push({
      id: id("EVT"),
      text: `Sample arrival: ${s.user} parked at ${s.slot}`,
      actor: "Demo",
      actorId: "demo",
      tone: "ok",
      icon: "car",
      at: s.start,
      demo: true,
    });
  return state.demo;
}
