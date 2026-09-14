/* ==========================================================================
   ParkFlow — application shell & router
   ========================================================================== */
import { DB, LOTS, metrics, money, ago, startLive, subscribe, initials } from './core/store.js';
import { el, qs, qsa, esc, toast, modal } from './core/ui.js';
import { icon } from './core/icons.js';
import { openBooking } from './views/booking.js';

import * as Dashboard from './views/dashboard.js';
import * as LotMap    from './views/lotmap.js';
import * as Sessions  from './views/sessions.js';
import * as Bookings  from './views/bookings.js';
import * as Customers from './views/customers.js';
import * as Analytics from './views/analytics.js';
import * as Alerts    from './views/alerts.js';
import * as Staff     from './views/staff.js';
import * as Settings  from './views/settings.js';

const ROUTES = {
  dashboard: { t: 'Operations Overview', c: 'Home', ico: 'grid',     mod: Dashboard, grp: 'Operate' },
  map:       { t: 'Live Bay Map',        c: 'Operations', ico: 'map',      mod: LotMap,    grp: 'Operate' },
  sessions:  { t: 'Parking Sessions',    c: 'Operations', ico: 'car',      mod: Sessions,  grp: 'Operate' },
  bookings:  { t: 'Reservations',        c: 'Operations', ico: 'ticket',   mod: Bookings,  grp: 'Operate' },
  customers: { t: 'Customers',           c: 'Growth', ico: 'users',    mod: Customers, grp: 'Manage' },
  analytics: { t: 'Analytics',           c: 'Insights', ico: 'chart',    mod: Analytics, grp: 'Manage' },
  alerts:    { t: 'Alerts & Incidents',  c: 'Monitoring', ico: 'bell',     mod: Alerts,    grp: 'Manage' },
  staff:     { t: 'Team & Shifts',       c: 'Manage', ico: 'shield',   mod: Staff,     grp: 'Manage' },
  settings:  { t: 'Settings',            c: 'Configure', ico: 'gear',     mod: Settings,  grp: 'System' },
};

const state = {
  route: location.hash.slice(1) || 'dashboard',
  lot: 'all',
  theme: localStorage.getItem('pf-theme') || 'light',
  collapsed: localStorage.getItem('pf-rail') === '1',
};
let cleanup = null;

const setTheme = (t) => {
  state.theme = t;
  document.documentElement.dataset.theme = t;
  localStorage.setItem('pf-theme', t);
  qs('#theme-btn').innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
};

const ctx = {
  get lot() { return state.lot; },
  go: (r) => { location.hash = r; },
  openBooking: () => openBooking(() => navigate(state.route, true)),
  setTheme,
};

/* ---------- Shell ---------- */
function buildShell() {
  const groups = ['Operate', 'Manage', 'System'];
  const app = el(`
    <div id="app">
      <div class="rail-scrim" data-close-rail></div>
      <aside class="rail ${state.collapsed ? 'collapsed' : ''}">
        <div class="brand">
          <div class="brand-mark">${icon('logo')}</div>
          <div class="brand-text">
            <span class="brand-name">ParkFlow</span>
            <span class="brand-sub">Parking Cloud</span>
          </div>
        </div>
        <nav class="nav">
          ${groups.map(g => `
            <div class="nav-group">
              <div class="nav-label">${g}</div>
              ${Object.entries(ROUTES).filter(([, r]) => r.grp === g).map(([k, r]) => `
                <a class="nav-item" href="#${k}" data-route="${k}">
                  ${icon(r.ico)}<span class="nav-txt">${r.t.split(' & ')[0]}</span>
                  ${k === 'alerts' ? `<span class="nav-badge" id="alert-count">${DB.alerts.filter(a => !a.ack).length}</span>` : ''}
                  ${k === 'map' ? '<span class="nav-badge soft">live</span>' : ''}
                </a>`).join('')}
            </div>`).join('')}
        </nav>
        <div class="rail-foot">
          <div class="rail-meter">
            <div class="rail-meter-top">
              <span class="rail-meter-lbl">Estate Load</span>
              <span class="rail-meter-val" id="load-val">0%</span>
            </div>
            <div class="meter-track"><div class="meter-fill" id="load-bar" style="width:0"></div></div>
            <div class="fs11 t3" style="margin-top:8px" id="load-sub">—</div>
          </div>
          <button class="rail-collapse" id="collapse">${icon('chevL')}<span>Collapse</span></button>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" id="menu">${icon('menu')}</button>
          <div class="topbar-title">
            <h1 id="pg-title">Dashboard</h1>
            <span class="crumb" id="pg-crumb">Home</span>
          </div>
          <div class="topbar-spacer"></div>
          <div class="search">
            ${icon('search')}
            <input type="search" id="gsearch" placeholder="Search plates, bays, sessions…">
            <kbd>⌘K</kbd>
          </div>
          <select class="field" id="lot-pick" style="height:36px">
            <option value="all">All Facilities</option>
            ${LOTS.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}
          </select>
          <button class="icon-btn" id="theme-btn">${icon('moon')}</button>
          <button class="icon-btn" id="bell-btn">${icon('bell')}<span class="dot pulse"></span></button>
          <div class="divider" style="width:1px;height:24px;background:var(--border)"></div>
          <button class="user-chip" id="user-btn">
            <div class="avatar">NC</div>
            <div class="user-meta"><b>Namita C.</b><span>Ops Administrator</span></div>
            ${icon('chevD', 'chev')}
          </button>
        </header>
        <div class="scroll" id="scroll"><div class="page" id="view"></div></div>
      </div>
    </div>`);
  document.body.appendChild(app);

  qs('#collapse').onclick = () => {
    state.collapsed = !state.collapsed;
    qs('.rail').classList.toggle('collapsed', state.collapsed);
    localStorage.setItem('pf-rail', state.collapsed ? '1' : '0');
  };
  qs('#menu').onclick = () => document.body.classList.toggle('rail-open');
  qs('[data-close-rail]').onclick = () => document.body.classList.remove('rail-open');
  qs('#theme-btn').onclick = () => setTheme(state.theme === 'dark' ? 'light' : 'dark');
  qs('#lot-pick').onchange = (e) => { state.lot = e.target.value; navigate(state.route, true); };
  qs('#bell-btn').onclick = notifPanel;
  qs('#user-btn').onclick = userPanel;
  qs('#gsearch').addEventListener('focus', commandPalette);
  qs('.nav').addEventListener('click', () => {
    if (innerWidth <= 820) document.body.classList.remove('rail-open');
  });
  qs('#theme-btn').innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon');
}

/* ---------- Router ---------- */
function navigate(route, force = false) {
  if (!ROUTES[route]) route = 'dashboard';
  if (route === state.route && !force && cleanup) return;
  cleanup?.(); cleanup = null;
  state.route = route;

  qsa('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === route));
  const r = ROUTES[route];
  qs('#pg-title').textContent = r.t;
  qs('#pg-crumb').textContent = `ParkFlow · ${r.c}`;
  document.title = `${r.t} — ParkFlow`;

  const view = qs('#view');
  view.className = 'page page-enter';
  view.innerHTML = '';
  qs('#scroll').scrollTop = 0;
  cleanup = r.mod.render(view, ctx) || null;
}

/* ---------- Rail meter ---------- */
function updateMeter() {
  const m = metrics(state.lot);
  const bar = qs('#load-bar'), val = qs('#load-val'), sub = qs('#load-sub');
  if (!bar) return;
  bar.style.width = m.occPct + '%';
  bar.className = 'meter-fill ' + (m.occPct > 85 ? 'high' : m.occPct > 65 ? 'mid' : '');
  val.textContent = m.occPct + '%';
  sub.textContent = `${m.free} bays free · ${money(m.todayRev)} today`;
  const ac = qs('#alert-count');
  if (ac) {
    const n = DB.alerts.filter(a => !a.ack).length;
    ac.textContent = n; ac.style.display = n ? '' : 'none';
  }
}

/* ---------- Panels ---------- */
function notifPanel() {
  modal({
    title: 'Notifications', sub: `${DB.alerts.filter(a => !a.ack).length} unread`,
    body: `<div class="feed" style="margin:0 -22px">
      ${DB.alerts.slice(0, 6).map(a => {
        const tone = { bad: ['var(--bad-500)', 'var(--bad-bg)'], warn: ['var(--warn-500)', 'var(--warn-bg)'],
          ok: ['var(--ok-500)', 'var(--ok-bg)'], info: ['var(--info-500)', 'var(--info-bg)'] }[a.sev];
        return `<div class="feed-item">
          <div class="feed-ico" style="background:${tone[1]};color:${tone[0]}">${icon(a.icon)}</div>
          <div class="feed-body"><p><b>${esc(a.title)}</b></p><p>${esc(a.body)}</p>
            <div class="feed-time">${esc(a.lot)} · ${ago(a.at)}</div></div>
        </div>`;
      }).join('')}</div>`,
    foot: `<button class="btn btn-ghost" data-close>Close</button>
           <button class="btn btn-primary" id="goa">View all alerts</button>`,
    onMount(s, close) { s.querySelector('#goa').onclick = () => { close(); ctx.go('alerts'); }; },
  });
}

function userPanel() {
  modal({
    title: 'Namita Chhabra', sub: 'Ops Administrator · ParkFlow Operations',
    body: `<div class="feed" style="margin:0 -22px">
      ${[['gear', 'Account settings', 'Profile, password and MFA'],
         ['shield', 'Roles & permissions', 'You have full administrator access'],
         ['wallet', 'Billing & plan', 'Enterprise · 4 facilities licensed'],
         ['logout', 'Sign out', 'End this session on all tabs']]
        .map(([i, t, s2]) => `<div class="feed-item" style="cursor:pointer">
          <div class="feed-ico" style="background:var(--surface-3);color:var(--text-2)">${icon(i)}</div>
          <div class="feed-body"><p><b>${t}</b></p><p>${s2}</p></div>
        </div>`).join('')}</div>`,
  });
}

function commandPalette() {
  const input = qs('#gsearch');
  input.blur();
  const items = [
    ...Object.entries(ROUTES).map(([k, r]) => ({ t: r.t, s: 'Navigate · ' + r.c, i: r.ico, go: () => ctx.go(k) })),
    { t: 'New booking', s: 'Action · Reserve a bay', i: 'plus', go: ctx.openBooking },
    { t: 'Toggle dark mode', s: 'Action · Appearance', i: 'moon', go: () => setTheme(state.theme === 'dark' ? 'light' : 'dark') },
    ...DB.sessions.filter(s => s.status === 'active').slice(0, 8)
      .map(s => ({ t: s.plate, s: `Session ${s.id} · bay ${s.slot}`, i: 'car', go: () => ctx.go('sessions') })),
  ];

  modal({
    title: 'Quick Search', sub: 'Jump to a page, plate or action',
    body: `<input class="field" id="cq" style="width:100%;height:40px;margin-bottom:12px" placeholder="Type to filter…" autofocus>
           <div class="feed" id="clist" style="margin:0 -22px;max-height:320px;overflow-y:auto"></div>`,
    onMount(scrim, close) {
      const q = scrim.querySelector('#cq'), list = scrim.querySelector('#clist');
      const paint = (term = '') => {
        const f = items.filter(x => (x.t + x.s).toLowerCase().includes(term.toLowerCase())).slice(0, 10);
        list.innerHTML = f.length ? f.map((x, i) => `
          <div class="feed-item" data-i="${items.indexOf(x)}" style="cursor:pointer">
            <div class="feed-ico" style="background:var(--brand-50);color:var(--brand-500)">${icon(x.i)}</div>
            <div class="feed-body"><p><b>${esc(x.t)}</b></p><div class="feed-time">${esc(x.s)}</div></div>
          </div>`).join('') : `<div class="empty"><p class="t3 fs12">No matches</p></div>`;
      };
      paint();
      q.addEventListener('input', e => paint(e.target.value));
      list.addEventListener('click', e => {
        const r = e.target.closest('[data-i]');
        if (r) { close(); items[+r.dataset.i].go(); }
      });
      setTimeout(() => q.focus(), 60);
    },
  });
}

/* ---------- Boot ---------- */
function boot() {
  document.documentElement.dataset.theme = state.theme;
  buildShell();
  navigate(state.route);
  updateMeter();
  startLive();
  subscribe(evt => { if (evt.type === 'tick') updateMeter(); });

  addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'dashboard'));
  addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); commandPalette(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); qs('#collapse').click(); }
  });

  setTimeout(() => toast('Welcome back, Namita', 'Live telemetry connected across 4 facilities', 'ok'), 700);
  qs('#boot')?.remove();
}

document.readyState === 'loading' ? addEventListener('DOMContentLoaded', boot) : boot();
