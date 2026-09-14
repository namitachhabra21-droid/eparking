import { DB, LOTS, metrics, money, compact, dur, ago, initials, subscribe } from '../core/store.js';
import { el, esc, sparkline, areaChart, donut, countUp, toast, modal } from '../core/ui.js';
import { icon } from '../core/icons.js';

const TONE = {
  ok: ['var(--ok-500)', 'var(--ok-bg)'], warn: ['var(--warn-500)', 'var(--warn-bg)'],
  bad: ['var(--bad-500)', 'var(--bad-bg)'], info: ['var(--info-500)', 'var(--info-bg)'],
  brand: ['var(--brand-500)', 'var(--brand-50)'],
};

function statTile({ label, val, unit = '', ico, tint, trend, sub, series }) {
  const up = trend >= 0;
  return `
    <div class="card hoverable stat" style="--tint:${tint}">
      <div class="stat-top">
        <span class="stat-label">${esc(label)}</span>
        <div class="stat-ico">${icon(ico)}</div>
      </div>
      <div class="stat-val"><span data-count="${val}">0</span>${unit ? `<span class="unit">${unit}</span>` : ''}</div>
      <div class="stat-foot">
        <span class="trend ${up ? 'up' : 'down'}">${icon(up ? 'arrUp' : 'arrDown')}${Math.abs(trend)}%</span>
        <span>${esc(sub)}</span>
      </div>
      ${series ? sparkline(series, tint) : ''}
    </div>`;
}

export function render(root, ctx) {
  const m = metrics(ctx.lot);
  const hrs = DB.series.hours;

  root.innerHTML = `
    <div class="page-head">
      <div class="ph-txt">
        <h2>Operations Overview</h2>
        <p>Real-time occupancy, revenue and gate activity across ${LOTS.length} facilities.</p>
      </div>
      <div class="ph-act">
        <span class="live-pill"><i class="ld"></i> Live</span>
        <button class="btn btn-ghost" data-act="export">${icon('download')} Export</button>
        <button class="btn btn-primary" data-act="new-booking">${icon('plus')} New Booking</button>
      </div>
    </div>

    <div class="grid g-4" id="tiles">
      ${statTile({ label: 'Occupancy', val: m.occPct, unit: '%', ico: 'car', tint: 'var(--brand-500)',
        trend: 6.4, sub: `${m.occupied + m.reserved} of ${m.total} bays`, series: hrs.map(h => h.occ) })}
      ${statTile({ label: 'Revenue Today', val: m.todayRev, ico: 'wallet', tint: '#10b981',
        trend: 12.8, sub: 'vs. yesterday', series: hrs.map(h => h.rev) })}
      ${statTile({ label: 'Active Sessions', val: m.active, ico: 'ticket', tint: '#8b5cf6',
        trend: 3.1, sub: `avg stay ${dur(m.avgMins)}`, series: hrs.map(h => Math.round(h.occ * 3.4)) })}
      ${statTile({ label: 'EV Bays In Use', val: m.evBusy, ico: 'bolt', tint: '#f59e0b',
        trend: -2.2, sub: `${m.evSlots} chargers installed`, series: hrs.map(h => Math.round(h.occ / 3)) })}
    </div>

    <div class="grid g-32" style="margin-top:16px">
      <div class="card">
        <div class="card-head">
          <div style="flex:1">
            <h3>Occupancy &amp; Revenue Curve</h3>
            <p>Hourly trend for the current operating day</p>
          </div>
          <div class="seg" id="curve-seg">
            <button class="on" data-r="24h">24h</button>
            <button data-r="7d">7d</button>
            <button data-r="6m">6m</button>
          </div>
        </div>
        <div class="card-body"><div id="curve"></div></div>
      </div>

      <div class="card">
        <div class="card-head"><div style="flex:1"><h3>Bay Composition</h3><p>Live status split</p></div></div>
        <div class="card-body">
          ${donut([
            { n: 'Occupied', v: m.occupied, c: 'var(--bad-500)' },
            { n: 'Reserved', v: m.reserved, c: 'var(--info-500)' },
            { n: 'Available', v: m.free, c: 'var(--ok-500)' },
          ], { centerVal: m.occPct + '%', centerLbl: 'Utilised' })}
          <div class="divider" style="margin:16px 0 14px"></div>
          <div class="plist">
            ${LOTS.map(l => {
              const lm = metrics(l.id);
              return `<div class="plist-row">
                <div class="pl-top"><b>${esc(l.name)}</b><span>${lm.occPct}%</span></div>
                <div class="pl-track"><div class="pl-fill" style="width:0;background:${l.tint}" data-w="${lm.occPct}"></div></div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="grid g-23" style="margin-top:16px">
      <div class="card">
        <div class="card-head">
          <div style="flex:1"><h3>Live Activity</h3><p>Gate &amp; payment events</p></div>
          <span class="live-pill"><i class="ld"></i> Streaming</span>
        </div>
        <div class="feed" id="feed" style="max-height:392px;overflow-y:auto">
          ${DB.activity.map(feedRow).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div style="flex:1"><h3>Active Sessions</h3><p>Vehicles currently parked</p></div>
          <button class="btn btn-sm btn-subtle" data-act="goto-sessions">View all</button>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>Driver</th><th>Vehicle</th><th>Bay</th><th>Duration</th><th>Accrued</th><th></th></tr></thead>
            <tbody>
              ${DB.sessions.filter(s => s.status === 'active').slice(0, 7).map(s => `
                <tr class="clickable" data-ses="${s.id}">
                  <td><div class="cell-user"><div class="avatar">${initials(s.user)}</div>
                    <div><b>${esc(s.user)}</b><span>${esc(s.lot)}</span></div></div></td>
                  <td><span class="plate">${esc(s.plate)}</span>
                      <div class="muted" style="margin-top:3px">${esc(s.vehicle)}</div></td>
                  <td class="num">${esc(s.slot)}</td>
                  <td><span class="badge ${s.mins > 240 ? 'warn' : 'neutral'}">${dur(s.mins)}</span></td>
                  <td class="num">${money(s.amount)}</td>
                  <td><button class="btn btn-sm btn-subtle">${icon('eye')}</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  /* Animate counters */
  root.querySelectorAll('[data-count]').forEach((n, i) => {
    const v = +n.dataset.count;
    setTimeout(() => countUp(n, v, { prefix: i === 1 ? '₹' : '' }), 90 * i);
  });
  /* Animate progress bars */
  requestAnimationFrame(() => root.querySelectorAll('.pl-fill').forEach(f => { f.style.width = f.dataset.w + '%'; }));

  /* Chart + range switching */
  const curve = root.querySelector('#curve');
  const drawCurve = (r) => {
    if (r === '24h') areaChart(curve, hrs.map(h => ({ x: `${h.h}:00`, Occupancy: h.occ, Revenue: Math.round(h.rev / 100) })),
      { xKey: 'x', yKeys: ['Occupancy', 'Revenue'], colors: ['#3366f2', '#10b981'], fmt: v => Math.round(v) });
    else if (r === '7d') areaChart(curve, DB.series.days.map(d => ({ x: d.day, Revenue: d.rev, Sessions: d.sessions })),
      { xKey: 'x', yKeys: ['Revenue', 'Sessions'], colors: ['#10b981', '#8b5cf6'], fmt: v => compact(v) });
    else areaChart(curve, DB.series.months.map(d => ({ x: d.m, 'This Yr': d.rev, 'Last Yr': d.prev })),
      { xKey: 'x', yKeys: ['This Yr', 'Last Yr'], colors: ['#3366f2', '#94a3b8'], fmt: v => compact(v) });
  };
  drawCurve('24h');
  root.querySelector('#curve-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    root.querySelectorAll('#curve-seg button').forEach(x => x.classList.toggle('on', x === b));
    drawCurve(b.dataset.r);
  });

  /* Actions */
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'export') { toast('Export queued', 'CSV will arrive by email shortly', 'ok'); }
    if (a === 'new-booking') ctx.openBooking();
    if (a === 'goto-sessions') ctx.go('sessions');
    const row = e.target.closest('[data-ses]');
    if (row) sessionModal(DB.sessions.find(s => s.id === row.dataset.ses));
  });

  /* Live feed updates */
  const feed = root.querySelector('#feed');
  const off = subscribe((evt) => {
    if (evt.type === 'activity' && feed.isConnected) {
      feed.insertAdjacentHTML('afterbegin', feedRow(evt.item));
      while (feed.children.length > 40) feed.lastElementChild.remove();
    }
    if (evt.type === 'tick' && root.isConnected) {
      const mm = metrics(ctx.lot);
      const t = root.querySelectorAll('[data-count]');
      if (t[0]) countUp(t[0], mm.occPct, { dur: 600 });
      if (t[2]) countUp(t[2], mm.active, { dur: 600 });
    }
    if (!root.isConnected) off();
  });
  return off;
}

function feedRow(a) {
  const [fg, bg] = TONE[a.tone] || TONE.brand;
  return `<div class="feed-item">
    <div class="feed-ico" style="background:${bg};color:${fg}">${icon(a.icon)}</div>
    <div class="feed-body"><p>${a.text}</p><div class="feed-time">${ago(a.at)}</div></div>
  </div>`;
}

export function sessionModal(s) {
  if (!s) return;
  modal({
    title: `Session ${s.id}`, sub: `${s.lot} · Bay ${s.slot}`, wide: true,
    body: `
      <div class="grid g-2" style="gap:12px">
        ${[['Driver', s.user], ['Plate', s.plate], ['Vehicle', s.vehicle],
           ['Started', new Date(s.start).toLocaleString('en-IN')],
           ['Duration', dur(s.mins)], ['Rate', money(s.rate) + '/hr'],
           ['Method', s.method], ['Status', s.status]].map(([k, v]) => `
          <div style="background:var(--surface-2);border:1px solid var(--border-soft);border-radius:var(--r-md);padding:11px 13px">
            <div class="fs11 t3 fw6" style="text-transform:uppercase;letter-spacing:.5px">${k}</div>
            <div class="fw6" style="margin-top:4px;font-size:13.5px">${esc(v)}</div>
          </div>`).join('')}
      </div>
      <div style="margin-top:14px;padding:15px;border-radius:var(--r-md);background:var(--brand-50);display:flex;align-items:center;gap:12px">
        <div class="stat-ico" style="--tint:var(--brand-500)">${icon('wallet')}</div>
        <div style="flex:1"><div class="fs12 t2 fw6">Amount accrued</div>
          <div style="font-size:23px;font-weight:760;letter-spacing:-.8px">${money(s.amount)}</div></div>
        ${s.ev ? `<span class="badge warn">${icon('bolt')} EV Charging</span>` : ''}
      </div>`,
    foot: `<button class="btn btn-ghost" data-close>Close</button>
           <button class="btn btn-ghost" id="m-ext">${icon('clock')} Extend 1h</button>
           <button class="btn btn-primary" id="m-out">${icon('check')} Check Out</button>`,
    onMount(scrim, close) {
      scrim.querySelector('#m-ext').onclick = () => { toast('Session extended', `${s.id} extended by 60 minutes`, 'ok'); close(); };
      scrim.querySelector('#m-out').onclick = () => { toast('Checked out', `${money(s.amount)} settled via ${s.method}`, 'ok'); close(); };
    },
  });
}
