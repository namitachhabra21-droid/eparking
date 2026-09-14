/* ==========================================================================
   DataTable — sortable, searchable, filterable, paginated
   ========================================================================== */
import { el, esc, qsa } from './ui.js';
import { icon } from './icons.js';

export function dataTable(host, {
  rows, cols, search = [], filters = [], pageSize = 10,
  onRow, empty = 'Nothing here yet', actions = '',
}) {
  let q = '', sortKey = null, sortDir = 1, page = 1;
  const fstate = {};
  filters.forEach(f => fstate[f.key] = 'all');

  host.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div class="search" style="width:236px">
          ${icon('search')}
          <input type="search" placeholder="Search…" data-q style="padding-right:12px">
        </div>
        ${filters.map(f => `
          <select class="field" data-f="${f.key}">
            <option value="all">${esc(f.label)}: All</option>
            ${f.options.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
          </select>`).join('')}
        <div class="spacer"></div>
        <span class="fs12 t3 fw6" data-count></span>
        ${actions}
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead><tr>${cols.map(c => `
            <th class="${c.sort !== false ? 'sortable' : ''}" data-k="${c.key}" style="${c.w ? `width:${c.w}` : ''}">
              ${esc(c.label)}${c.sort !== false ? '<span class="sort-ico">↕</span>' : ''}
            </th>`).join('')}</tr></thead>
          <tbody data-body></tbody>
        </table>
      </div>
      <div class="toolbar" style="border-top:1px solid var(--border-soft);border-bottom:0">
        <span class="fs12 t3" data-range></span>
        <div class="spacer"></div>
        <button class="btn btn-sm btn-ghost" data-pg="-1">${icon('chevL')} Prev</button>
        <span class="fs12 fw6" data-page></span>
        <button class="btn btn-sm btn-ghost" data-pg="1">Next <span style="transform:rotate(180deg);display:inline-flex">${icon('chevL')}</span></button>
      </div>
    </div>`;

  const body = host.querySelector('[data-body]');

  const view = () => {
    let out = rows.slice();
    if (q) {
      const t = q.toLowerCase();
      out = out.filter(r => search.some(k => String(r[k] ?? '').toLowerCase().includes(t)));
    }
    filters.forEach(f => {
      if (fstate[f.key] !== 'all') out = out.filter(r => String(r[f.key]) === fstate[f.key]);
    });
    if (sortKey) {
      out.sort((a, b) => {
        const x = a[sortKey], y = b[sortKey];
        const n = typeof x === 'number' && typeof y === 'number';
        return (n ? x - y : String(x).localeCompare(String(y))) * sortDir;
      });
    }
    return out;
  };

  function paint() {
    const all = view();
    const pages = Math.max(1, Math.ceil(all.length / pageSize));
    page = Math.min(page, pages);
    const slice = all.slice((page - 1) * pageSize, page * pageSize);

    body.innerHTML = slice.length ? slice.map((r, i) => `
      <tr class="${onRow ? 'clickable' : ''}" data-i="${rows.indexOf(r)}" style="animation:feedIn .3s var(--e-out) ${i * 22}ms backwards">
        ${cols.map(c => `<td class="${c.cls || ''}">${c.render ? c.render(r) : esc(r[c.key] ?? '')}</td>`).join('')}
      </tr>`).join('')
      : `<tr><td colspan="${cols.length}">
          <div class="empty"><div class="empty-ico">${icon('search')}</div>
            <h4>No results</h4><p>${esc(empty)}</p></div></td></tr>`;

    host.querySelector('[data-count]').textContent = `${all.length} record${all.length === 1 ? '' : 's'}`;
    host.querySelector('[data-page]').textContent = `${page} / ${pages}`;
    host.querySelector('[data-range]').textContent = all.length
      ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, all.length)} of ${all.length}` : '—';
    qsa('[data-pg]', host).forEach(b => {
      b.disabled = (b.dataset.pg === '-1' && page === 1) || (b.dataset.pg === '1' && page === pages);
    });
    qsa('th[data-k]', host).forEach(th => {
      const on = th.dataset.k === sortKey;
      th.classList.toggle('sorted', on);
      const s = th.querySelector('.sort-ico');
      if (s) s.textContent = on ? (sortDir > 0 ? '↑' : '↓') : '↕';
    });
  }

  host.querySelector('[data-q]').addEventListener('input', e => { q = e.target.value; page = 1; paint(); });
  qsa('[data-f]', host).forEach(sel =>
    sel.addEventListener('change', e => { fstate[sel.dataset.f] = e.target.value; page = 1; paint(); }));
  host.querySelector('thead').addEventListener('click', e => {
    const th = e.target.closest('th.sortable'); if (!th) return;
    if (sortKey === th.dataset.k) sortDir *= -1; else { sortKey = th.dataset.k; sortDir = 1; }
    paint();
  });
  qsa('[data-pg]', host).forEach(b =>
    b.addEventListener('click', () => { page += +b.dataset.pg; paint(); }));
  if (onRow) body.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-i]');
    if (tr) onRow(rows[+tr.dataset.i]);
  });

  paint();
  return { paint, setRows(r) { rows = r; page = 1; paint(); } };
}
