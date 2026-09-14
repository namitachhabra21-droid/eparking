/* ==========================================================================
   Store — seeded mock data + live simulation + pub/sub
   ========================================================================== */

/* Deterministic PRNG so reloads look stable, ticks add the motion */
let _s = 20260915;
const rnd = () => { _s = (_s * 1664525 + 1013904223) % 4294967296; return _s / 4294967296; };
export const ri = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
export const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const FIRST = ['Aarav','Priya','Kabir','Meera','Rohan','Ananya','Vikram','Sana','Arjun','Neha','Ishaan','Tara','Dev','Riya','Aditya','Zoya','Karan','Nisha','Yash','Diya','Omar','Leila','Marco','Elena','Noah','Hana'];
const LAST = ['Sharma','Patel','Verma','Nair','Kapoor','Reddy','Iyer','Mehta','Singh','Bose','Rao','Khan','Joshi','Dutta','Chopra','Malik','Silva','Okafor','Rossi','Tanaka'];
const MAKES = ['Tesla Model 3','Hyundai Creta','Toyota Innova','Honda City','Mahindra XUV700','Kia Seltos','BMW 3 Series','Tata Nexon EV','Maruti Swift','Audi Q5','MG ZS EV','Skoda Slavia','Volvo XC40','Jeep Compass'];
const EV_MAKES = ['Tesla Model 3','Tata Nexon EV','MG ZS EV','Volvo XC40'];

export const LOTS = [
  { id: 'L1', name: 'Central Plaza',    addr: '221 Marine Drive',      zones: ['A','B','C'], cap: 180, rate: 60, tint: '#3366f2' },
  { id: 'L2', name: 'Skyline Tower',    addr: '9 Peninsula Business Pk', zones: ['A','B'],   cap: 120, rate: 80, tint: '#06b6d4' },
  { id: 'L3', name: 'Metro Interchange',addr: 'Line 3, Gate 4',        zones: ['A','B','C'], cap: 220, rate: 40, tint: '#8b5cf6' },
  { id: 'L4', name: 'Airport T2 Long Stay', addr: 'Terminal 2 Access Rd', zones: ['A','B'], cap: 160, rate: 100, tint: '#f59e0b' },
];

const name = () => `${pick(FIRST)} ${pick(LAST)}`;
const plate = () => `${pick(['MH','DL','KA','TN','GJ'])} ${ri(10,49)} ${pick(['AB','CX','JK','PQ','ZR','MN'])} ${ri(1000,9999)}`;
export const initials = (n) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

/* ---------- Slots ---------- */
function buildSlots() {
  const slots = [];
  for (const lot of LOTS) {
    /* Distribute capacity exactly: earlier zones absorb the remainder */
    const base = Math.floor(lot.cap / lot.zones.length);
    const extra = lot.cap % lot.zones.length;
    lot.zones.forEach((z, zi) => {
      const per = base + (zi < extra ? 1 : 0);
      for (let i = 1; i <= per; i++) {
        const r = rnd();
        let type = 'std';
        if (i % 11 === 0) type = 'ev';
        else if (i % 17 === 0) type = 'acc';
        let status = r < 0.58 ? 'occupied' : r < 0.72 ? 'reserved' : 'free';
        if (type === 'acc' && rnd() > 0.5) status = 'free';
        slots.push({
          id: `${lot.id}-${z}${String(i).padStart(2, '0')}`,
          lot: lot.id, zone: z, num: i, type, status,
          since: status !== 'free' ? Date.now() - ri(4, 300) * 60000 : null,
          plate: status !== 'free' ? plate() : null,
          floor: zi + 1,
        });
      }
    });
  }
  return slots;
}

/* ---------- Sessions / bookings ---------- */
function buildSessions(slots) {
  const active = slots.filter(s => s.status === 'occupied');
  const rows = active.map((s, i) => {
    const lot = LOTS.find(l => l.id === s.lot);
    const mins = Math.round((Date.now() - s.since) / 60000);
    const isEv = s.type === 'ev';
    return {
      id: `SES-${9000 + i}`,
      slot: s.id, lotId: lot.id, lot: lot.name, zone: s.zone,
      user: name(), plate: s.plate,
      vehicle: isEv ? pick(EV_MAKES) : pick(MAKES),
      start: s.since, mins,
      rate: lot.rate,
      amount: Math.max(lot.rate, Math.round((mins / 60) * lot.rate)),
      status: 'active',
      method: pick(['UPI', 'Card', 'Wallet', 'FASTag']),
      ev: isEv,
    };
  });
  /* Some completed history for the ledger */
  for (let i = 0; i < 46; i++) {
    const lot = pick(LOTS);
    const mins = ri(20, 560);
    const end = Date.now() - ri(1, 72) * 3600000;
    rows.push({
      id: `SES-${8000 + i}`,
      slot: `${lot.id}-${pick(lot.zones)}${String(ri(1, 60)).padStart(2, '0')}`,
      lotId: lot.id, lot: lot.name, zone: pick(lot.zones),
      user: name(), plate: plate(), vehicle: pick(MAKES),
      start: end - mins * 60000, mins, rate: lot.rate,
      amount: Math.max(lot.rate, Math.round((mins / 60) * lot.rate)),
      status: rnd() > 0.06 ? 'completed' : 'overstay',
      method: pick(['UPI', 'Card', 'Wallet', 'FASTag']),
      ev: rnd() > 0.78,
    });
  }
  return rows.sort((a, b) => b.start - a.start);
}

/* ---------- Reservations ---------- */
function buildReservations() {
  const out = [];
  for (let i = 0; i < 22; i++) {
    const lot = pick(LOTS);
    const at = Date.now() + ri(-40, 900) * 60000;
    out.push({
      id: `RSV-${4200 + i}`,
      user: name(), plate: plate(), lot: lot.name, lotId: lot.id,
      slot: `${lot.id}-${pick(lot.zones)}${String(ri(1, 55)).padStart(2, '0')}`,
      at, hours: ri(1, 8),
      amount: lot.rate * ri(1, 8),
      status: at < Date.now() ? pick(['checked-in', 'no-show']) : pick(['confirmed', 'confirmed', 'pending']),
      channel: pick(['Mobile App', 'Web', 'Partner API', 'Kiosk']),
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/* ---------- Customers ---------- */
function buildCustomers() {
  const out = [];
  for (let i = 0; i < 34; i++) {
    const n = name();
    const visits = ri(3, 180);
    out.push({
      id: `CUS-${1200 + i}`,
      name: n, email: `${n.split(' ')[0].toLowerCase()}.${n.split(' ')[1].toLowerCase()}@${pick(['gmail.com','outlook.com','corp.io','fastmail.com'])}`,
      plan: visits > 120 ? 'Enterprise' : visits > 60 ? 'Business' : visits > 20 ? 'Plus' : 'Basic',
      plates: ri(1, 3), visits,
      spend: visits * ri(45, 130),
      since: Date.now() - ri(30, 900) * 86400000,
      status: rnd() > 0.1 ? 'active' : 'dormant',
      ev: rnd() > 0.65,
    });
  }
  return out.sort((a, b) => b.spend - a.spend);
}

/* ---------- Alerts ---------- */
const ALERT_SEEDS = [
  ['bad',  'alert',  'Overstay detected', 'Vehicle {p} exceeded booked window by 47 min at {l}'],
  ['warn', 'camera', 'ANPR camera offline', 'Gate 3 entry camera lost heartbeat at {l}'],
  ['info', 'bolt',   'EV charger fault', 'Charger EV-07 reporting thermal throttle at {l}'],
  ['ok',   'shield', 'Barrier cycled', 'Exit barrier B2 completed maintenance cycle at {l}'],
  ['warn', 'ticket', 'Payment retry', 'UPI mandate failed twice for session {s}'],
  ['bad',  'alert',  'Capacity threshold', '{l} crossed 92% occupancy — overflow routing engaged'],
];
function buildAlerts() {
  return ALERT_SEEDS.map((a, i) => {
    const lot = pick(LOTS);
    return {
      id: `ALR-${700 + i}`, sev: a[0], icon: a[1], title: a[2],
      body: a[3].replace('{l}', lot.name).replace('{p}', plate()).replace('{s}', `SES-${ri(9000, 9100)}`),
      at: Date.now() - ri(2, 400) * 60000,
      lot: lot.name, ack: rnd() > 0.6,
    };
  }).sort((a, b) => b.at - a.at);
}

/* ---------- Staff ---------- */
function buildStaff() {
  const roles = ['Lot Supervisor', 'Attendant', 'Ops Manager', 'Maintenance', 'Support Agent'];
  const out = [];
  for (let i = 0; i < 12; i++) {
    const n = name();
    out.push({
      id: `STF-${300 + i}`, name: n, role: pick(roles),
      lot: pick(LOTS).name, shift: pick(['06:00–14:00', '14:00–22:00', '22:00–06:00']),
      status: rnd() > 0.35 ? 'on-duty' : 'off-duty',
      email: `${n.split(' ')[0].toLowerCase()}@parkflow.io`,
    });
  }
  return out;
}

/* ---------- Time series ---------- */
function buildSeries() {
  const hours = [];
  for (let h = 0; h < 24; h++) {
    const peak = Math.exp(-((h - 10) ** 2) / 14) + Math.exp(-((h - 18) ** 2) / 10) * 1.15;
    hours.push({ h, occ: Math.min(98, Math.round(18 + peak * 62 + rnd() * 8)), rev: Math.round((peak * 5400) + rnd() * 900) });
  }
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => ({
    day: d,
    rev: Math.round(48000 + Math.sin(i / 1.6) * 16000 + rnd() * 9000),
    sessions: Math.round(680 + Math.sin(i / 1.4) * 190 + rnd() * 120),
  }));
  const months = ['Apr','May','Jun','Jul','Aug','Sep'].map((m, i) => ({
    m, rev: Math.round(920000 + i * 96000 + rnd() * 70000),
    prev: Math.round(870000 + i * 74000 + rnd() * 60000),
  }));
  return { hours, days, months };
}

/* ========================================================================== */

const slots = buildSlots();
export const DB = {
  slots,
  sessions: buildSessions(slots),
  reservations: buildReservations(),
  customers: buildCustomers(),
  alerts: buildAlerts(),
  staff: buildStaff(),
  series: buildSeries(),
  activity: [],
};

/* ---------- Derived metrics ---------- */
export function metrics(lotId = 'all') {
  const s = lotId === 'all' ? DB.slots : DB.slots.filter(x => x.lot === lotId);
  const total = s.length;
  const occupied = s.filter(x => x.status === 'occupied').length;
  const reserved = s.filter(x => x.status === 'reserved').length;
  const free = total - occupied - reserved;
  const active = DB.sessions.filter(x => x.status === 'active' && (lotId === 'all' || x.lotId === lotId));
  const todayRev = DB.sessions
    .filter(x => Date.now() - x.start < 86400000 && (lotId === 'all' || x.lotId === lotId))
    .reduce((a, b) => a + b.amount, 0);
  const avgMins = active.length ? Math.round(active.reduce((a, b) => a + b.mins, 0) / active.length) : 0;
  return {
    total, occupied, reserved, free,
    occPct: total ? Math.round((occupied + reserved) / total * 100) : 0,
    active: active.length, todayRev, avgMins,
    evSlots: s.filter(x => x.type === 'ev').length,
    evBusy: s.filter(x => x.type === 'ev' && x.status === 'occupied').length,
    turnover: (DB.sessions.length / Math.max(total, 1)).toFixed(1),
  };
}

/* ---------- Pub/sub ---------- */
const subs = new Set();
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const emit = (evt) => subs.forEach(fn => fn(evt));

/* ---------- Live simulation ---------- */
const ACT = [
  ['ok',   'car',    '<b>{n}</b> parked at <b>{s}</b>'],
  ['info', 'ticket', '<b>{n}</b> booked slot <b>{s}</b> for {h}h'],
  ['brand','wallet', 'Payment of <b>₹{a}</b> captured via {m}'],
  ['warn', 'clock',  'Session <b>{id}</b> nearing expiry at {l}'],
  ['ok',   'check',  '<b>{n}</b> checked out — <b>₹{a}</b> settled'],
  ['info', 'bolt',   'EV charging started on <b>{s}</b> ({kw} kW)'],
];

export function pushActivity() {
  const t = pick(ACT);
  const lot = pick(LOTS);
  const s = `${lot.id}-${pick(lot.zones)}${String(ri(1, 60)).padStart(2, '0')}`;
  const text = t[2]
    .replace('{n}', name()).replace('{s}', s).replace('{h}', ri(1, 6))
    .replace('{a}', ri(60, 840)).replace('{m}', pick(['UPI', 'Card', 'FASTag']))
    .replace('{id}', `SES-${ri(9000, 9100)}`).replace('{l}', lot.name)
    .replace('{kw}', ri(7, 60));
  const item = { tone: t[0], icon: t[1], text, at: Date.now() };
  DB.activity.unshift(item);
  if (DB.activity.length > 40) DB.activity.pop();
  return item;
}
for (let i = 0; i < 7; i++) { pushActivity(); DB.activity[0].at = Date.now() - i * 47000; }

let timer = null;
export function startLive() {
  if (timer) return;
  timer = setInterval(() => {
    /* Flip a few slots */
    const flips = ri(1, 3);
    for (let i = 0; i < flips; i++) {
      const s = DB.slots[Math.floor(rnd() * DB.slots.length)];
      if (s.type === 'acc') continue;
      if (s.status === 'free') {
        s.status = rnd() > 0.72 ? 'reserved' : 'occupied';
        s.since = Date.now(); s.plate = plate();
      } else if (rnd() > 0.55) {
        s.status = 'free'; s.since = null; s.plate = null;
      }
    }
    /* Age active sessions */
    DB.sessions.forEach(x => {
      if (x.status === 'active') {
        x.mins = Math.round((Date.now() - x.start) / 60000);
        x.amount = Math.max(x.rate, Math.round((x.mins / 60) * x.rate));
      }
    });
    if (rnd() > 0.45) emit({ type: 'activity', item: pushActivity() });
    emit({ type: 'tick' });
  }, 4000);
}
export const stopLive = () => { clearInterval(timer); timer = null; };

/* ---------- Formatters ---------- */
export const money = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
export const compact = (n) => n >= 1e7 ? (n / 1e7).toFixed(2) + 'Cr'
  : n >= 1e5 ? (n / 1e5).toFixed(2) + 'L'
  : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n));
export const dur = (m) => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
export const ago = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
export const clock = (t) => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
export const dateStr = (t) => new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
