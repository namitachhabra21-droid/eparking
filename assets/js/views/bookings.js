import { DB, LOTS, money, initials, clock, dateStr } from '../core/store.js';
import { esc, toast, modal } from '../core/ui.js';
import { dataTable } from '../core/datatable.js';
import { icon } from '../core/icons.js';

export function render(root, ctx) {
  const rows = DB.reservations;
  const upcoming = rows.filter(r => r.at > Date.now());

  root.innerHTML = `
    <div class="page-head">
      <div class="ph-txt"><h2>Reservations</h2>
        <p>Pre-booked bays from the mobile app, web, kiosks and partner APIs.</p></div>
      <div class="ph-act">
        <button class="btn btn-ghost" data-act="rules">${icon('sliders')} Booking Rules</button>
        <button class="btn btn-primary" data-act="new">${icon('plus')} New Reservation</button>
      </div>
    </div>

    <div class="grid g-4" style="margin-bottom:16px">
      ${[['Upcoming', upcoming.length, 'clock', 'var(--brand-500)'],
         ['Confirmed', rows.filter(r => r.status === 'confirmed').length, 'check', 'var(--ok-500)'],
         ['No-shows', rows.filter(r => r.status === 'no-show').length, 'alert', 'var(--bad-500)'],
         ['Booked Value', money(rows.reduce((a, b) => a + b.amount, 0)), 'wallet', '#06b6d4']]
        .map(([l, v, i, t]) => `
          <div class="card stat" style="--tint:${t}">
            <div class="stat-top"><span class="stat-label">${l}</span><div class="stat-ico">${icon(i)}</div></div>
            <div class="stat-val">${v}</div></div>`).join('')}
    </div>

    <div class="grid g-32">
      <div id="dt"></div>
      <div class="card" style="align-self:start">
        <div class="card-head"><div style="flex:1"><h3>Next Arrivals</h3><p>Sorted by ETA</p></div></div>
        <div class="feed">
          ${upcoming.slice(0, 7).map(r => `
            <div class="feed-item">
              <div class="feed-ico" style="background:var(--brand-50);color:var(--brand-500)">${icon('car')}</div>
              <div class="feed-body">
                <p><b>${esc(r.user)}</b> · ${esc(r.lot)}</p>
                <div class="feed-time">${clock(r.at)} · ${r.hours}h · bay ${esc(r.slot)}</div>
              </div>
              <span class="badge ${r.status === 'confirmed' ? 'ok' : 'warn'}">${r.status}</span>
            </div>`).join('') || '<div class="empty"><p class="t3">No upcoming arrivals</p></div>'}
        </div>
      </div>
    </div>`;

  dataTable(root.querySelector('#dt'), {
    rows, pageSize: 9,
    search: ['user', 'plate', 'lot', 'id', 'slot'],
    filters: [
      { key: 'status', label: 'Status', options: ['confirmed', 'pending', 'checked-in', 'no-show'] },
      { key: 'channel', label: 'Channel', options: ['Mobile App', 'Web', 'Partner API', 'Kiosk'] },
    ],
    onRow: r => detail(r),
    cols: [
      { key: 'id', label: 'Ref', render: r => `<span class="mono fw6">${esc(r.id)}</span>` },
      { key: 'user', label: 'Guest', render: r => `
        <div class="cell-user"><div class="avatar">${initials(r.user)}</div>
        <div><b>${esc(r.user)}</b><span>${esc(r.channel)}</span></div></div>` },
      { key: 'plate', label: 'Plate', render: r => `<span class="plate">${esc(r.plate)}</span>` },
      { key: 'at', label: 'Arrival', render: r => `${clock(r.at)}<div class="muted">${dateStr(r.at)}</div>` },
      { key: 'hours', label: 'Window', cls: 'num', render: r => `${r.hours}h` },
      { key: 'amount', label: 'Value', cls: 'num', render: r => money(r.amount) },
      { key: 'status', label: 'Status', render: r => {
        const m = { confirmed: 'ok', pending: 'warn', 'checked-in': 'info', 'no-show': 'bad' }[r.status];
        return `<span class="badge ${m}"><i class="bdot"></i>${r.status}</span>`; } },
    ],
  });

  root.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'new') ctx.openBooking();
    if (a === 'rules') toast('Booking rules', 'Opening policy editor…', 'brand');
  });
}

function detail(r) {
  modal({
    title: `Reservation ${r.id}`, sub: `${r.lot} · bay ${r.slot}`,
    body: `<div class="grid g-2" style="gap:11px">
      ${[['Guest', r.user], ['Plate', r.plate], ['Arrival', new Date(r.at).toLocaleString('en-IN')],
         ['Duration', r.hours + ' hours'], ['Channel', r.channel], ['Value', money(r.amount)]]
        .map(([k, v]) => `<div style="background:var(--surface-2);border:1px solid var(--border-soft);border-radius:var(--r-md);padding:11px 13px">
          <div class="fs11 t3 fw6" style="text-transform:uppercase;letter-spacing:.5px">${k}</div>
          <div class="fw6" style="margin-top:4px;font-size:13.5px">${esc(v)}</div></div>`).join('')}
    </div>`,
    foot: `<button class="btn btn-ghost" data-close>Close</button>
           <button class="btn btn-danger" id="cx">Cancel Booking</button>
           <button class="btn btn-primary" id="ci">${icon('check')} Check In</button>`,
    onMount(s, close) {
      s.querySelector('#ci').onclick = () => { toast('Checked in', `${r.user} assigned to ${r.slot}`, 'ok'); close(); };
      s.querySelector('#cx').onclick = () => { toast('Booking cancelled', `${r.id} refunded ${money(r.amount)}`, 'warn'); close(); };
    },
  });
}
