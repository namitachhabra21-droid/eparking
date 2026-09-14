import { DB, initials } from '../core/store.js';
import { esc, toast } from '../core/ui.js';
import { dataTable } from '../core/datatable.js';
import { icon } from '../core/icons.js';

export function render(root) {
  const rows = DB.staff;
  root.innerHTML = `
    <div class="page-head">
      <div class="ph-txt"><h2>Team &amp; Shifts</h2>
        <p>Attendants, supervisors and on-duty coverage across facilities.</p></div>
      <div class="ph-act">
        <button class="btn btn-ghost" data-act="roster">${icon('clock')} Shift Roster</button>
        <button class="btn btn-primary" data-act="add">${icon('plus')} Add Member</button>
      </div>
    </div>
    <div class="grid g-4" style="margin-bottom:16px">
      ${[['On Duty', rows.filter(r => r.status === 'on-duty').length, 'users', 'var(--ok-500)'],
         ['Total Team', rows.length, 'users', 'var(--brand-500)'],
         ['Facilities Covered', 4, 'building', '#8b5cf6'],
         ['Shifts Today', 3, 'clock', 'var(--warn-500)']]
        .map(([l, v, i, t]) => `
          <div class="card stat" style="--tint:${t}">
            <div class="stat-top"><span class="stat-label">${l}</span><div class="stat-ico">${icon(i)}</div></div>
            <div class="stat-val">${v}</div></div>`).join('')}
    </div>
    <div id="dt"></div>`;

  dataTable(root.querySelector('#dt'), {
    rows, pageSize: 10, search: ['name', 'role', 'lot', 'email'],
    filters: [
      { key: 'status', label: 'Duty', options: ['on-duty', 'off-duty'] },
      { key: 'shift', label: 'Shift', options: [...new Set(rows.map(r => r.shift))] },
    ],
    cols: [
      { key: 'name', label: 'Member', render: r => `
        <div class="cell-user"><div class="avatar">${initials(r.name)}</div>
        <div><b>${esc(r.name)}</b><span>${esc(r.email)}</span></div></div>` },
      { key: 'role', label: 'Role', render: r => `<span class="badge info">${esc(r.role)}</span>` },
      { key: 'lot', label: 'Facility' },
      { key: 'shift', label: 'Shift', cls: 'num' },
      { key: 'status', label: 'Status', render: r =>
        `<span class="badge ${r.status === 'on-duty' ? 'ok' : 'neutral'}"><i class="bdot"></i>${r.status}</span>` },
    ],
  });

  root.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'add') toast('Invite sent', 'New member will receive setup email', 'ok');
    if (a === 'roster') toast('Roster', 'Opening shift planner…', 'brand');
  });
}
