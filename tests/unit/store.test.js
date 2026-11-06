/* Unit tests for core/store.js — run with `npm test` (node:test, no deps) */
import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  DB, LOTS, metrics, money, compact, dur, ago, initials, clock, dateStr,
  pushActivity, subscribe, startLive, stopLive, ri, pick,
} from '../fixtures/prototype-store.js';

describe('TS-01 Slot generation', () => {
  test('UT-01 total bays equal the sum of facility capacities (680)', () => {
    const cap = LOTS.reduce((a, l) => a + l.cap, 0);
    assert.equal(cap, 680);
    assert.equal(DB.slots.length, cap);
  });

  test('UT-02 each facility gets exactly its capacity', () => {
    for (const lot of LOTS) {
      assert.equal(DB.slots.filter(s => s.lot === lot.id).length, lot.cap, lot.name);
    }
  });

  test('UT-03 zone remainder goes to earlier zones', () => {
    /* L1: 180 / 3 zones = 60 each; L3: 220 / 3 → 74, 73, 73 */
    const count = (lot, z) => DB.slots.filter(s => s.lot === lot && s.zone === z).length;
    assert.deepEqual(['A', 'B', 'C'].map(z => count('L3', z)), [74, 73, 73]);
    assert.deepEqual(['A', 'B', 'C'].map(z => count('L1', z)), [60, 60, 60]);
  });

  test('UT-04 slot ids are unique and well-formed', () => {
    const ids = DB.slots.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length);
    ids.forEach(id => assert.match(id, /^L[1-4]-[A-C]\d{2,}$/));
  });

  test('UT-05 every 11th bay is EV, every 17th (non-EV) is accessible', () => {
    for (const s of DB.slots) {
      if (s.num % 11 === 0) assert.equal(s.type, 'ev', s.id);
      else if (s.num % 17 === 0) assert.equal(s.type, 'acc', s.id);
      else assert.equal(s.type, 'std', s.id);
    }
  });

  test('UT-06 free bays carry no plate or start time', () => {
    DB.slots.filter(s => s.status === 'free').forEach(s => {
      assert.equal(s.plate, null);
      assert.equal(s.since, null);
    });
  });
});

describe('TS-02 Billing rule', () => {
  test('UT-07 amount = max(hourly rate, round(mins/60 × rate))', () => {
    for (const x of DB.sessions) {
      assert.equal(x.amount, Math.max(x.rate, Math.round((x.mins / 60) * x.rate)), x.id);
    }
  });

  test('UT-08 minimum charge is one hour even for short stays', () => {
    DB.sessions.filter(x => x.mins < 60).forEach(x => assert.equal(x.amount, x.rate));
  });

  test('UT-09 every active session maps to an occupied bay', () => {
    const occupied = new Set(DB.slots.filter(s => s.status === 'occupied').map(s => s.id));
    DB.sessions.filter(x => x.status === 'active').forEach(x => assert.ok(occupied.has(x.slot), x.slot));
  });
});

describe('TS-03 Metrics', () => {
  test('UT-10 free + occupied + reserved = total (all facilities)', () => {
    const m = metrics();
    assert.equal(m.free + m.occupied + m.reserved, m.total);
    assert.equal(m.total, 680);
  });

  test('UT-11 occupancy % is within [0, 100]', () => {
    for (const id of ['all', ...LOTS.map(l => l.id)]) {
      const { occPct } = metrics(id);
      assert.ok(occPct >= 0 && occPct <= 100, `${id}: ${occPct}`);
    }
  });

  test('UT-12 per-facility totals add up to the estate total', () => {
    const sum = LOTS.reduce((a, l) => a + metrics(l.id).total, 0);
    assert.equal(sum, metrics('all').total);
  });

  test('UT-13 unknown facility id yields an empty, zero-safe result', () => {
    const m = metrics('L9');
    assert.equal(m.total, 0);
    assert.equal(m.occPct, 0);
    assert.equal(m.avgMins, 0);
  });
});

describe('TS-04 Formatters', () => {
  test('UT-14 money() uses ₹ and Indian digit grouping', () => {
    assert.equal(money(0), '₹0');
    assert.equal(money(1234567), '₹12,34,567');
    assert.equal(money(99.6), '₹100');
  });

  test('UT-15 compact() boundary values', () => {
    assert.equal(compact(999), '999');
    assert.equal(compact(1000), '1.0K');
    assert.equal(compact(99999), '100.0K');
    assert.equal(compact(100000), '1.00L');
    assert.equal(compact(1e7), '1.00Cr');
  });

  test('UT-16 dur() splits hours and minutes at 60', () => {
    assert.equal(dur(0), '0m');
    assert.equal(dur(59), '59m');
    assert.equal(dur(60), '1h 0m');
    assert.equal(dur(135), '2h 15m');
  });

  test('UT-17 ago() picks the right unit', () => {
    const now = Date.now();
    assert.equal(ago(now - 30 * 1000), '30s ago');
    assert.equal(ago(now - 5 * 60000), '5m ago');
    assert.equal(ago(now - 3 * 3600000), '3h ago');
    assert.equal(ago(now - 2 * 86400000), '2d ago');
  });

  test('UT-18 initials() takes first letters, max two', () => {
    assert.equal(initials('Namita Chhabra'), 'NC');
    assert.equal(initials('aarav kumar sharma'), 'AK');
  });

  test('UT-24 clock() and dateStr() use en-IN 12-hour time and short dates', () => {
    const t = new Date(2026, 9, 27, 14, 5).getTime();
    assert.match(clock(t), /^0?2:05\s?pm$/i);
    assert.match(dateStr(t), /^27 Oct$/);
  });
});

describe('TS-05 Random helpers', () => {
  test('UT-19 ri(a, b) stays inside the inclusive range', () => {
    for (let i = 0; i < 500; i++) {
      const v = ri(3, 7);
      assert.ok(Number.isInteger(v) && v >= 3 && v <= 7);
    }
  });

  test('UT-20 pick() always returns a member', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) assert.ok(arr.includes(pick(arr)));
  });
});

describe('TS-06 Activity feed & live simulation', () => {
  test('UT-21 feed is capped at 40 items, newest first', () => {
    for (let i = 0; i < 60; i++) pushActivity();
    assert.equal(DB.activity.length, 40);
    const item = pushActivity();
    assert.equal(DB.activity[0], item);
  });

  test('UT-22 live tick emits events and keeps bay counts consistent', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const events = [];
    const off = subscribe(e => events.push(e.type));
    startLive();
    startLive(); /* second call must be a no-op */
    t.mock.timers.tick(4000 * 5);
    stopLive();
    off();
    assert.equal(events.filter(e => e === 'tick').length, 5);
    assert.equal(metrics().total, 680);
  });

  test('UT-23 unsubscribe stops delivery', (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    let n = 0;
    const off = subscribe(() => n++);
    off();
    startLive();
    t.mock.timers.tick(8000);
    stopLive();
    assert.equal(n, 0);
  });
});
