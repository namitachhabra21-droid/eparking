import { DB, money, dur, ago, initials, clock } from '../core/store.js';
import { esc, toast } from '../core/ui.js';
import { dataTable } from '../core/datatable.js';
import { icon } from '../core/icons.js';
import { sessionModal } from './dashboard.js';

export function render(root, ctx) {
  const rows = DB.sessions;
  const stats = [
    ['Active Now', rows.filter(r => r.status === 'active').length, 'car', 'var(--brand-500)'],
    ['Completed 24h', rows.filter(r => r.status === 'completed').length, 'check', 'var(--ok-500)'],
    ['Overstays', rows.filter(r => r.status === 'overstay').length, 'alert', 'var(--bad-500)'],
    ['Gross Value', money(rows.reduce((a, b) => a + b.amount, 0)), 'wallet', '#8b5cf6'],
  ];

  root.innerHTML = `
    <div class="page-head">
      <div class="ph-txt"><h2>Parking Sessions</h2>
        <p>Every check-in, duration and settlement across the estate.</p></div>
      <div class="ph-act">
        <button class="btn btn-ghost" data-act="export">${icon('download')} Export CSV</button>
        <button class="btn btn-primary" data-act="new">${icon('plus')} Manual Check-In</button>
      </div>
    </div>
    <div class="grid g-4" style="margin-bottom:16px">
      ${stats.map(([l, v, i, t]) => `
        <div class="card stat" style="--tint:${t}">
          <div class="stat-top"><span class="stat-label">${l}</span><div class="stat-ico">${icon(i)}</div></div>
          <div class="stat-val">${v}</div></div>`).join('')}
    </div>
    <div id="dt"></div>`;

  dataTable(root.querySelector('#dt'), {
    rows, pageSize: 12,
    search: ['user', 'plate', 'slot', 'lot', 'id', 'vehicle'],
    filters: [
      { key: 'status', label: 'Status', options: ['active', 'completed', 'overstay'] },
      { key: 'lot', label: 'Facility', options: [...new Set(rows.map(r => r.lot))] },
      { key: 'method', label: 'Payment', options: ['UPI', 'Card', 'Wallet', 'FASTag'] },
    ],
    onRow: sessionModal,
    cols: [
      { key: 'id', label: 'Session', w: '110px', render: r => `<span class="mono fw6">${esc(r.id)}</span>` },
      { key: 'user', label: 'Driver', render: r => `
        <div class="cell-user"><div class="avatar">${initials(r.user)}</div>
        <div><b>${esc(r.user)}</b><span>${esc(r.vehicle)}</span></div></div>` },
      { key: 'plate', label: 'Plate', render: r => `<span class="plate">${esc(r.plate)}</span>` },
      { key: 'slot', label: 'Bay', cls: 'num', render: r => `${esc(r.slot)}<div class="muted">${esc(r.lot)}</div>` },
      { key: 'start', label: 'Started', render: r => `${clock(r.start)}<div class="muted">${ago(r.start)}</div>` },
      { key: 'mins', label: 'Duration', render: r => `<span class="badge ${r.mins > 300 ? 'warn' : 'neutral'}">${dur(r.mins)}</span>` },
      { key: 'amount', label: 'Amount', cls: 'num', render: r => money(r.amount) },
      { key: 'status', label: 'Status', render: r => {
        const m = { active: 'ok', completed: 'neutral', overstay: 'bad' }[r.status];
        return `<span class="badge ${m}"><i class="bdot"></i>${r.status}</span>`; } },
    ],
  });

  root.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'export') toast('Export started', `${rows.length} sessions queued`, 'ok');
    if (a === 'new') ctx.openBooking();
  });
}
