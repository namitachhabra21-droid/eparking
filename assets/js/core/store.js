/* Authoritative application records are loaded from the authenticated API. */
import { api, post } from "./api.js";
export const LOTS = [];
export const DB = {
  slots: [],
  sessions: [],
  reservations: [],
  customers: [],
  alerts: [],
  staff: [],
  payments: [],
  activity: [],
  settings: {},
  series: { hours: [], days: [], months: [] },
};
const subscribers = new Set();
let timer = null,
  refreshing = false,
  revision = 0;
export const subscribe = (fn) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};
const emit = (evt) => subscribers.forEach((fn) => fn(evt));
export function ingest(payload) {
  if (payload.revision && payload.revision < revision) return;
  revision = payload.revision || revision;
  const previousActivity = new Set(DB.activity.map((a) => a.id));
  LOTS.splice(0, LOTS.length, ...payload.state.lots);
  for (const [key, value] of Object.entries(payload.state))
    if (key !== "lots") {
      if (Array.isArray(value) && Array.isArray(DB[key]))
        DB[key].splice(0, DB[key].length, ...value);
      else DB[key] = value;
    }
  emit({ type: "tick" });
  DB.activity
    .filter((a) => !previousActivity.has(a.id))
    .slice()
    .reverse()
    .forEach((item) => emit({ type: "activity", item }));
}
export async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    ingest(await api("/state"));
  } finally {
    refreshing = false;
  }
}
export async function action(type, data = {}) {
  const result = await post("/actions", { type, data });
  ingest(result);
  emit({ type: "change" });
  return result.result;
}
export function startLive() {
  if (timer) return;
  timer = setInterval(() => {
    if (document.visibilityState === "visible")
      refresh().catch((error) => emit({ type: "error", error }));
  }, 10000);
}
export function stopLive() {
  clearInterval(timer);
  timer = null;
}
export const isActive = (s) => s.status === "active" || s.status === "overstay";
export function metrics(lotId = "all") {
  const bays = DB.slots.filter((s) => lotId === "all" || s.lot === lotId),
    total = bays.length;
  const count = (status) => bays.filter((s) => s.status === status).length;
  const sessions = DB.sessions.filter(
      (s) => lotId === "all" || s.lotId === lotId,
    ),
    active = sessions.filter(isActive);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const sameDay = (at) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
      new Date(at),
    ) === today;
  const todayRev = DB.payments
    .filter(
      (p) => sameDay(p.paidAt) && sessions.some((s) => s.id === p.sessionId),
    )
    .reduce((n, p) => n + p.amount, 0);
  const occupied = count("occupied"),
    reserved = count("reserved"),
    maintenance = count("maintenance");
  return {
    total,
    occupied,
    reserved,
    maintenance,
    free: count("free"),
    occPct: total ? Math.round(((occupied + reserved) / total) * 100) : 0,
    active: active.length,
    todayRev,
    avgMins: active.length
      ? Math.round(active.reduce((n, s) => n + s.mins, 0) / active.length)
      : 0,
    evSlots: bays.filter((s) => s.type === "ev").length,
    evBusy: bays.filter((s) => s.type === "ev" && s.status === "occupied")
      .length,
    turnover: (
      sessions.filter((s) => sameDay(s.start)).length / Math.max(1, total)
    ).toFixed(1),
  };
}
export const initials = (n) =>
  n
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
export const money = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
export const compact = (n) =>
  n >= 1e7
    ? (n / 1e7).toFixed(2) + "Cr"
    : n >= 1e5
      ? (n / 1e5).toFixed(2) + "L"
      : n >= 1e3
        ? (n / 1e3).toFixed(1) + "K"
        : String(Math.round(n || 0));
export const dur = (m) =>
  m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
export const ago = (t) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60
    ? `${s}s ago`
    : s < 3600
      ? `${Math.round(s / 60)}m ago`
      : s < 86400
        ? `${Math.round(s / 3600)}h ago`
        : `${Math.round(s / 86400)}d ago`;
};
export const clock = (t) =>
  new Date(t).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
export const dateStr = (t) =>
  new Date(t).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
