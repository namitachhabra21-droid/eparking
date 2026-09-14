import { DB, money, compact, initials, dateStr } from '../core/store.js';
import { esc, toast, modal, donut } from '../core/ui.js';
import { dataTable } from '../core/datatable.js';
import { icon } from '../core/icons.js';

const PLAN_TONE = { Enterprise: 'brand', Business: 'info', Plus: 'ok', Basic: 'neutral' };

export function render(root) {
  const rows = DB.customers;
  const byPlan = ['Enterprise', 'Business', 'Plus', 'Basic'].map((p, i) => ({
    n: p, v: rows.filter(r => r.plan === p).length,
    c: ['#3366f2', '#6366f1', '#10b981', '#94a3b8'][i],
  }));
  const mrr = rows.reduce((a, b) => a + b.spend, 0);

  root.innerHTML = `
    <div class="page-head">
      <div class="ph-txt"><h2>Customers</h2>
        <p>Drivers, corporate accounts and their lifetime value.</p></div>
      <div class="ph-act">
        <button class="btn btn-ghost" data-act="segment">${icon('filter')} Segments</button>
        <button class="btn btn-primary" data-act="invite">${icon('plus')} Invite Customer</button>
      </div>
    </div>

    <div class="grid g-23" style="margin-bottom:16px">
      <div class="card">
        <div class="card-head"><div style="flex:1"><h3>Plan Mix</h3><p>Accounts by tier</p></div></div>
        <div class="card-body">${donut(byPlan, { centerVal: rows.length, centerLbl: 'Accounts' })}</div>
      </div>
      <div class="grid g-2" style="align-content:start">
        ${[['Lifetime Revenue', money(mrr), 'wallet', 'var(--ok-500)', 'all accounts'],
           ['Active Accounts', rows.filter(r => r.status === 'active').length, 'users', 'var(--brand-500)', `${rows.filter(r => r.status === 'dormant').length} dormant`],
           ['EV Drivers', rows.filter(r => r.ev).length, 'bolt', 'var(--warn-500)', 'charger eligible'],
           ['Avg Visits', Math.round(rows.reduce((a, b) => a + b.visits, 0) / rows.length), 'car', '#8b5cf6', 'per account']]
          .map(([l, v, i, t, s]) => `
            <div class="card stat" style="--tint:${t}">
              <div class="stat-top"><span class="stat-label">${l}</span><div class="stat-ico">${icon(i)}</div></div>
              <div class="stat-val">${v}</div>
              <div class="stat-foot"><span>${s}</span></div></div>`).join('')}
      </div>
    </div>
    <div id="dt"></div>`;

  dataTable(root.querySelector('#dt'), {
    rows, pageSize: 10,
    search: ['name', 'email', 'id'],
    filters: [
      { key: 'plan', label: 'Plan', options: ['Enterprise', 'Business', 'Plus', 'Basic'] },
      { key: 'status', label: 'Status', options: ['active', 'dormant'] },
    ],
    onRow: detail,
    cols: [
      { key: 'name', label: 'Account', render: r => `
        <div class="cell-user"><div class="avatar">${initials(r.name)}</div>
        <div><b>${esc(r.name)}</b><span>${esc(r.email)}</span></div></div>` },
      { key: 'plan', label: 'Plan', render: r => `<span class="badge ${PLAN_TONE[r.plan]}">${r.plan}</span>` },
      { key: 'plates', label: 'Vehicles', cls: 'num' },
      { key: 'visits', label: 'Visits', cls: 'num' },
      { key: 'spend', label: 'Lifetime', cls: 'num', render: r => money(r.spend) },
      { key: 'since', label: 'Member Since', render: r => dateStr(r.since) },
      { key: 'status', label: 'Status', render: r =>
        `<span class="badge ${r.status === 'active' ? 'ok' : 'neutral'}"><i class="bdot"></i>${r.status}</span>` },
    ],
  });

  root.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'invite') toast('Invite sent', 'Onboarding link generated', 'ok');
    if (a === 'segment') toast('Segments', 'Loading saved segments…', 'brand');
  });
}

function detail(c) {
  modal({
    title: c.name, sub: `${c.email} · ${c.plan} plan`, wide: true,
    body: `<div class="grid g-4" style="gap:11px">
        ${[['Lifetime', money(c.spend)], ['Visits', c.visits], ['Vehicles', c.plates], ['Since', dateStr(c.since)]]
          .map(([k, v]) => `<div style="background:var(--surface-2);border:1px solid var(--border-soft);border-radius:var(--r-md);padding:12px">
            <div class="fs11 t3 fw6">${k.toUpperCase()}</div>
            <div class="fw7" style="margin-top:4px;font-size:17px;letter-spacing:-.4px">${v}</div></div>`).join('')}
      </div>
      <div style="margin-top:14px"><h4 class="fs13 fw7" style="margin-bottom:9px">Recent sessions</h4>
        <div class="feed" style="border:1px solid var(--border-soft);border-radius:var(--r-md)">
          ${DB.sessions.slice(0, 4).map(s => `
            <div class="feed-item">
              <div class="feed-ico" style="background:var(--brand-50);color:var(--brand-500)">${icon('car')}</div>
              <div class="feed-body"><p><b>${esc(s.lot)}</b> · bay ${esc(s.slot)}</p>
                <div class="feed-time">${dateStr(s.start)} · ${money(s.amount)}</div></div>
            </div>`).join('')}
        </div></div>`,
    foot: `<button class="btn btn-ghost" data-close>Close</button>
           <button class="btn btn-primary">${icon('wallet')} Issue Credit</button>`,
  });
}
