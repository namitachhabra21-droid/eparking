import { LOTS, money } from '../core/store.js';
import { esc, toast } from '../core/ui.js';
import { icon } from '../core/icons.js';

const TABS = [
  ['general', 'General', 'gear'], ['pricing', 'Pricing', 'wallet'],
  ['facilities', 'Facilities', 'building'], ['hardware', 'Hardware', 'cpu'],
  ['notify', 'Notifications', 'bell'],
];

const toggle = (id, on, label, sub) => `
  <div class="row" style="padding:13px 0;border-bottom:1px solid var(--border-soft)">
    <div style="flex:1"><div class="fw6 fs13">${esc(label)}</div>
      <div class="fs12 t3" style="margin-top:2px">${esc(sub)}</div></div>
    <button class="sw ${on ? 'on' : ''}" data-sw="${id}" role="switch" aria-checked="${on}"><i></i></button>
  </div>`;

export function render(root, ctx) {
  let tab = 'general';

  root.innerHTML = `
    <div class="page-head">
      <div class="ph-txt"><h2>Settings</h2><p>Configure your organisation, tariffs, facilities and devices.</p></div>
      <div class="ph-act"><button class="btn btn-primary" data-act="save">${icon('check')} Save Changes</button></div>
    </div>
    <div class="grid g-23">
      <div class="card" style="align-self:start">
        <nav class="nav" style="padding:10px">
          ${TABS.map(([k, l, i]) => `
            <button class="nav-item ${k === 'general' ? 'active' : ''}" data-tab="${k}">
              ${icon(i)}<span class="nav-txt">${l}</span></button>`).join('')}
        </nav>
      </div>
      <div id="pane"></div>
    </div>`;

  const pane = root.querySelector('#pane');

  const panes = {
    general: () => `
      <div class="card"><div class="card-head"><div style="flex:1"><h3>Organisation</h3><p>Shown on receipts and the driver app</p></div></div>
        <div class="card-body">
          <div class="grid g-2" style="gap:14px">
            <div><label class="lbl">Company name</label><input class="field" style="width:100%;height:38px" value="ParkFlow Operations Pvt Ltd"></div>
            <div><label class="lbl">Support email</label><input class="field" style="width:100%;height:38px" value="ops@parkflow.io"></div>
            <div><label class="lbl">Currency</label><select class="field" style="width:100%;height:38px"><option>INR — Indian Rupee</option><option>USD — US Dollar</option><option>AED — Dirham</option></select></div>
            <div><label class="lbl">Timezone</label><select class="field" style="width:100%;height:38px"><option>Asia/Kolkata (GMT+5:30)</option><option>Asia/Dubai (GMT+4)</option></select></div>
          </div>
        </div></div>
      <div class="card" style="margin-top:16px"><div class="card-head"><div style="flex:1"><h3>Appearance</h3><p>Theme applies instantly</p></div></div>
        <div class="card-body">
          ${toggle('theme', document.documentElement.dataset.theme === 'dark', 'Dark mode', 'Reduce glare for night-shift operators')}
          ${toggle('dense', false, 'Compact density', 'Fit more rows per screen')}
          ${toggle('anim', true, 'Motion effects', 'Chart draw-in and transitions')}
        </div></div>`,

    pricing: () => `
      <div class="card"><div class="card-head"><div style="flex:1"><h3>Tariff Plans</h3><p>Per-facility hourly rates and caps</p></div>
        <button class="btn btn-sm btn-ghost">${icon('plus')} Add Tariff</button></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Facility</th><th>Hourly</th><th>Daily Cap</th><th>Grace</th><th>Overstay Fee</th><th></th></tr></thead>
          <tbody>${LOTS.map(l => `<tr>
            <td><b class="fw6">${esc(l.name)}</b><div class="muted">${esc(l.addr)}</div></td>
            <td class="num">${money(l.rate)}</td>
            <td class="num">${money(l.rate * 8)}</td>
            <td class="num">15 min</td>
            <td class="num">${money(l.rate * 2)}</td>
            <td><button class="btn btn-sm btn-subtle">${icon('sliders')}</button></td></tr>`).join('')}
          </tbody></table></div></div>
      <div class="card" style="margin-top:16px"><div class="card-head"><div style="flex:1"><h3>Dynamic Pricing</h3><p>Surge tariffs during peak demand</p></div></div>
        <div class="card-body">
          ${toggle('surge', true, 'Enable surge pricing', 'Raise rates when occupancy exceeds threshold')}
          ${toggle('ev', true, 'EV preferential rate', '20% discount on EV-designated bays')}
          ${toggle('loyal', false, 'Loyalty auto-discount', 'Apply tier discounts at checkout')}
          <div style="margin-top:16px"><label class="lbl">Surge trigger — occupancy threshold</label>
            <div class="row" style="gap:14px"><input type="range" min="50" max="100" value="85" id="rng" style="flex:1;accent-color:var(--brand-500)">
            <b class="fw7" id="rngv" style="min-width:46px;font-variant-numeric:tabular-nums">85%</b></div></div>
        </div></div>`,

    facilities: () => `
      <div class="grid g-2">
        ${LOTS.map(l => `
          <div class="card hoverable"><div class="card-body">
            <div class="row" style="gap:11px;margin-bottom:12px">
              <div class="stat-ico" style="--tint:${l.tint}">${icon('building')}</div>
              <div style="flex:1"><b class="fw7 fs13">${esc(l.name)}</b>
                <div class="fs12 t3">${esc(l.addr)}</div></div>
              <span class="badge ok"><i class="bdot"></i>online</span>
            </div>
            <div class="grid g-3" style="gap:9px">
              ${[['Capacity', l.cap], ['Zones', l.zones.length], ['Rate', money(l.rate)]].map(([k, v]) =>
                `<div style="background:var(--surface-2);border-radius:var(--r-sm);padding:9px 11px">
                  <div class="fs11 t3 fw6">${k}</div><div class="fw7" style="margin-top:2px">${v}</div></div>`).join('')}
            </div>
            <button class="btn btn-ghost btn-block btn-sm" style="margin-top:12px">${icon('sliders')} Configure</button>
          </div></div>`).join('')}
      </div>`,

    hardware: () => `
      <div class="card"><div class="card-head"><div style="flex:1"><h3>Connected Devices</h3><p>Barriers, ANPR cameras and charge points</p></div>
        <span class="live-pill"><i class="ld"></i> 98% online</span></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Device</th><th>Type</th><th>Facility</th><th>Firmware</th><th>Status</th></tr></thead>
          <tbody>${[
            ['GATE-A1', 'Entry Barrier', 'Central Plaza', 'v4.2.1', 'ok'],
            ['ANPR-C3', 'Plate Camera', 'Central Plaza', 'v2.8.0', 'ok'],
            ['ANPR-G3', 'Plate Camera', 'Skyline Tower', 'v2.7.4', 'bad'],
            ['EVSE-07', 'DC Charger 60kW', 'Metro Interchange', 'v1.9.2', 'warn'],
            ['GATE-B2', 'Exit Barrier', 'Airport T2', 'v4.2.1', 'ok'],
            ['KIOSK-2', 'Payment Kiosk', 'Metro Interchange', 'v3.0.5', 'ok'],
          ].map(([d, t, f, v, s]) => `<tr>
            <td><span class="mono fw6">${d}</span></td><td>${t}</td><td>${f}</td><td class="num">${v}</td>
            <td><span class="badge ${s}"><i class="bdot"></i>${s === 'ok' ? 'online' : s === 'warn' ? 'degraded' : 'offline'}</span></td>
          </tr>`).join('')}</tbody></table></div></div>`,

    notify: () => `
      <div class="card"><div class="card-head"><div style="flex:1"><h3>Notification Channels</h3><p>Where operational alerts are delivered</p></div></div>
        <div class="card-body">
          ${toggle('n1', true, 'Critical incidents — SMS', 'Barrier failures and safety events')}
          ${toggle('n2', true, 'Overstay alerts — Email', 'Sent to the facility supervisor')}
          ${toggle('n3', false, 'Daily revenue digest', 'Delivered at 07:00 local time')}
          ${toggle('n4', true, 'Hardware health — Slack', 'Posted to #parkflow-ops')}
          ${toggle('n5', false, 'Capacity forecasts — Webhook', 'POST to your endpoint hourly')}
        </div></div>`,
  };

  const paint = () => {
    pane.innerHTML = panes[tab]();
    const rng = pane.querySelector('#rng');
    if (rng) rng.addEventListener('input', e => pane.querySelector('#rngv').textContent = e.target.value + '%');
  };
  paint();

  root.querySelector('nav').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab;
    root.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
    paint();
  });

  root.addEventListener('click', e => {
    const sw = e.target.closest('[data-sw]');
    if (sw) {
      const on = sw.classList.toggle('on');
      sw.setAttribute('aria-checked', on);
      if (sw.dataset.sw === 'theme') ctx.setTheme(on ? 'dark' : 'light');
      return;
    }
    if (e.target.closest('[data-act="save"]')) toast('Settings saved', 'Changes applied across all facilities', 'ok');
  });
}
