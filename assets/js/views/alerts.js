import { DB, ago, initials } from '../core/store.js';
import { esc, toast } from '../core/ui.js';
import { icon } from '../core/icons.js';

const TONE = { ok: ['var(--ok-500)', 'var(--ok-bg)'], warn: ['var(--warn-500)', 'var(--warn-bg)'],
  bad: ['var(--bad-500)', 'var(--bad-bg)'], info: ['var(--info-500)', 'var(--info-bg)'] };

export function render(root) {
  let filter = 'all';

  const paint = () => {
    const list = filter === 'all' ? DB.alerts
      : filter === 'open' ? DB.alerts.filter(a => !a.ack) : DB.alerts.filter(a => a.ack);
    root.querySelector('#alist').innerHTML = list.length ? list.map(a => {
      const [fg, bg] = TONE[a.sev] || TONE.info;
      return `
        <div class="feed-item" data-id="${a.id}" style="align-items:flex-start">
          <div class="feed-ico" style="background:${bg};color:${fg}">${icon(a.icon)}</div>
          <div class="feed-body">
            <div class="row" style="gap:8px;margin-bottom:3px;flex-wrap:wrap">
              <b class="fs13">${esc(a.title)}</b>
              <span class="badge ${a.sev === 'bad' ? 'bad' : a.sev === 'warn' ? 'warn' : a.sev === 'ok' ? 'ok' : 'info'}">${a.sev === 'bad' ? 'critical' : a.sev === 'warn' ? 'warning' : a.sev === 'ok' ? 'resolved' : 'info'}</span>
              ${a.ack ? '<span class="badge neutral">acknowledged</span>' : ''}
            </div>
            <p>${esc(a.body)}</p>
            <div class="feed-time">${esc(a.lot)} · ${ago(a.at)} · ${esc(a.id)}</div>
          </div>
          <div class="row" style="gap:6px">
            ${!a.ack ? `<button class="btn btn-sm btn-ghost" data-ack="${a.id}">${icon('check')} Ack</button>` : ''}
            <button class="btn btn-sm btn-subtle" data-dis="${a.id}">${icon('x')}</button>
          </div>
        </div>`;
    }).join('') : `<div class="empty"><div class="empty-ico">${icon('shield')}</div>
        <h4>All clear</h4><p>No alerts match this filter. Systems are operating normally.</p></div>`;
  };

  root.innerHTML = `
    <div class="page-head">
      <div class="ph-txt"><h2>Alerts &amp; Incidents</h2>
        <p>Hardware health, overstays, payment failures and capacity events.</p></div>
      <div class="ph-act">
        <button class="btn btn-ghost" data-act="ackall">${icon('check')} Acknowledge All</button>
        <button class="btn btn-primary" data-act="rules">${icon('sliders')} Alert Rules</button>
      </div>
    </div>

    <div class="grid g-4" style="margin-bottom:16px">
      ${[['Critical', DB.alerts.filter(a => a.sev === 'bad').length, 'alert', 'var(--bad-500)'],
         ['Warnings', DB.alerts.filter(a => a.sev === 'warn').length, 'bell', 'var(--warn-500)'],
         ['Unacknowledged', DB.alerts.filter(a => !a.ack).length, 'eye', '#8b5cf6'],
         ['Devices Online', '98%', 'cpu', 'var(--ok-500)']]
        .map(([l, v, i, t]) => `
          <div class="card stat" style="--tint:${t}">
            <div class="stat-top"><span class="stat-label">${l}</span><div class="stat-ico">${icon(i)}</div></div>
            <div class="stat-val">${v}</div></div>`).join('')}
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="seg" id="a-seg">
          <button class="on" data-f="all">All</button>
          <button data-f="open">Open</button>
          <button data-f="ack">Acknowledged</button>
        </div>
        <div class="spacer"></div>
        <span class="live-pill"><i class="ld"></i> Monitoring</span>
      </div>
      <div class="feed" id="alist"></div>
    </div>`;

  paint();

  root.querySelector('#a-seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    filter = b.dataset.f;
    root.querySelectorAll('#a-seg button').forEach(x => x.classList.toggle('on', x === b));
    paint();
  });

  root.addEventListener('click', e => {
    const ack = e.target.closest('[data-ack]')?.dataset.ack;
    if (ack) { DB.alerts.find(a => a.id === ack).ack = true; toast('Acknowledged', ack, 'ok'); paint(); }
    const dis = e.target.closest('[data-dis]')?.dataset.dis;
    if (dis) { const i = DB.alerts.findIndex(a => a.id === dis); DB.alerts.splice(i, 1); toast('Dismissed', dis, 'brand'); paint(); }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'ackall') { DB.alerts.forEach(x => x.ack = true); toast('All acknowledged', `${DB.alerts.length} alerts cleared`, 'ok'); paint(); }
    if (a === 'rules') toast('Alert rules', 'Opening rule builder…', 'brand');
  });
}
