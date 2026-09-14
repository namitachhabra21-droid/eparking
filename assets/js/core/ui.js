/* ==========================================================================
   UI kit — DOM helpers, charts, toasts, modals
   ========================================================================== */
import { icon } from './icons.js';

export const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
export const qs = (s, r = document) => r.querySelector(s);
export const qsa = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- Button ripple ---------- */
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('.btn');
  if (!b) return;
  const r = b.getBoundingClientRect();
  const d = Math.max(r.width, r.height);
  const s = el(`<span class="ripple"></span>`);
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.appendChild(s);
  setTimeout(() => s.remove(), 600);
});

/* ---------- Toast ---------- */
let toastHost;
export function toast(title, body = '', tone = 'brand') {
  if (!toastHost) {
    toastHost = el('<div class="toast-host"></div>');
    document.body.appendChild(toastHost);
  }
  const ico = { ok: 'check', bad: 'alert', warn: 'alert', brand: 'bell' }[tone] || 'bell';
  const col = { ok: 'var(--ok-500)', bad: 'var(--bad-500)', warn: 'var(--warn-500)', brand: 'var(--brand-500)' }[tone];
  const t = el(`
    <div class="toast ${tone}">
      <div class="toast-ico" style="background:color-mix(in srgb, ${col} 14%, transparent);color:${col}">${icon(ico)}</div>
      <div class="toast-body"><b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ''}</div>
    </div>`);
  toastHost.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3600);
}

/* ---------- Modal ---------- */
export function modal({ title, sub = '', body = '', foot = '', wide = false, onMount }) {
  const scrim = el(`
    <div class="modal-scrim">
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div style="flex:1;min-width:0">
            <h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}
          </div>
          <button class="icon-btn" data-close aria-label="Close">${icon('x')}</button>
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div>
    </div>`);
  const close = () => { scrim.style.animation = 'fadeIn .14s reverse'; setTimeout(() => scrim.remove(), 130); };
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim || e.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', function esc2(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); }
  });
  document.body.appendChild(scrim);
  onMount?.(scrim, close);
  return close;
}

/* ---------- Count-up animation ---------- */
export function countUp(node, to, { prefix = '', suffix = '', dur = 900, dec = 0 } = {}) {
  const from = parseFloat(node.dataset.v || 0);
  node.dataset.v = to;
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    const v = from + (to - from) * e;
    node.textContent = prefix + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-IN')) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ==========================================================================
   Charts — hand-rolled SVG
   ========================================================================== */

/* Smooth cubic path through points */
function smooth(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Sparkline for stat tiles */
export function sparkline(values, tint) {
  const w = 100, h = 34;
  const mn = Math.min(...values), mx = Math.max(...values), rg = mx - mn || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - ((v - mn) / rg) * (h - 5) - 2.5,
  ]);
  const line = smooth(pts);
  const id = 'sg' + Math.random().toString(36).slice(2, 7);
  return `
    <div class="spark" style="--tint:${tint}">
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${tint}"/><stop offset="100%" stop-color="${tint}" stop-opacity="0"/>
        </linearGradient></defs>
        <path class="area" d="${line} L${w},${h} L0,${h} Z" fill="url(#${id})"/>
        <path class="line" d="${line}" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>`;
}

/** Area + line chart with hover crosshair */
export function areaChart(host, data, { xKey, yKeys, colors, fmt = (v) => v, height = 230 }) {
  const W = 760, H = height, pad = { t: 14, r: 14, b: 26, l: 46 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const all = yKeys.flatMap(k => data.map(d => d[k]));
  const mx = Math.max(...all) * 1.12, mn = 0;
  const X = (i) => pad.l + (i / (data.length - 1)) * iw;
  const Y = (v) => pad.t + ih - ((v - mn) / (mx - mn)) * ih;

  const ticks = 4;
  let grid = '';
  for (let i = 0; i <= ticks; i++) {
    const v = mn + (mx - mn) * (i / ticks), y = Y(v);
    grid += `<line class="grid-line" x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}"/>
             <text class="axis-txt" x="${pad.l - 9}" y="${y + 3.5}" text-anchor="end">${fmt(v)}</text>`;
  }
  let xl = '';
  const every = Math.ceil(data.length / 8);
  data.forEach((d, i) => {
    if (i % every === 0 || i === data.length - 1)
      xl += `<text class="axis-txt" x="${X(i)}" y="${H - 7}" text-anchor="middle">${d[xKey]}</text>`;
  });

  let paths = '', defs = '';
  yKeys.forEach((k, ki) => {
    const c = colors[ki];
    const id = 'ag' + ki + Math.random().toString(36).slice(2, 6);
    const pts = data.map((d, i) => [X(i), Y(d[k])]);
    const line = smooth(pts);
    defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c}" stop-opacity=".30"/>
      <stop offset="100%" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
    paths += `<path d="${line} L${X(data.length - 1)},${pad.t + ih} L${pad.l},${pad.t + ih} Z" fill="url(#${id})"/>
              <path d="${line}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
                    style="stroke-dasharray:2600;stroke-dashoffset:2600;animation:draw 1.5s var(--e-out) forwards"/>`;
  });

  host.innerHTML = `
    <div class="chart-box">
      <svg viewBox="0 0 ${W} ${H}">
        <defs>${defs}</defs>${grid}${paths}${xl}
        <line class="cross" x1="0" y1="${pad.t}" x2="0" y2="${pad.t + ih}" stroke="var(--text-3)" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>
        ${yKeys.map((k, ki) => `<circle class="dot d${ki}" r="4.5" fill="${colors[ki]}" stroke="var(--surface)" stroke-width="2.5" opacity="0"/>`).join('')}
        <rect x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent" class="hit"/>
      </svg>
      <div class="chart-tip"></div>
    </div>`;

  const svg = host.querySelector('svg'), tip = host.querySelector('.chart-tip');
  const cross = host.querySelector('.cross'), dots = qsa('.dot', host);
  host.querySelector('.hit').addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const sx = (e.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(((sx - pad.l) / iw) * (data.length - 1))));
    const d = data[i], x = X(i);
    cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('opacity', '.6');
    dots.forEach((dot, ki) => {
      dot.setAttribute('cx', x); dot.setAttribute('cy', Y(d[yKeys[ki]])); dot.setAttribute('opacity', '1');
    });
    tip.classList.add('show');
    tip.style.left = (x / W * r.width) + 'px';
    tip.style.top = (Y(Math.max(...yKeys.map(k => d[k]))) / H * r.height) + 'px';
    tip.innerHTML = `<b>${d[xKey]}</b>${yKeys.map((k, ki) =>
      `<span style="color:${colors[ki]}">●</span> ${k}: ${fmt(d[k])}`).join('<br>')}`;
  });
  host.querySelector('.hit').addEventListener('pointerleave', () => {
    cross.setAttribute('opacity', '0');
    dots.forEach(d => d.setAttribute('opacity', '0'));
    tip.classList.remove('show');
  });
}

/** Grouped bar chart */
export function barChart(host, data, { xKey, yKeys, colors, fmt = (v) => v, height = 230 }) {
  const W = 760, H = height, pad = { t: 14, r: 14, b: 26, l: 46 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const mx = Math.max(...yKeys.flatMap(k => data.map(d => d[k]))) * 1.14;
  const Y = (v) => pad.t + ih - (v / mx) * ih;
  const band = iw / data.length, bw = Math.min(26, (band * 0.62) / yKeys.length);

  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = mx * (i / 4), y = Y(v);
    grid += `<line class="grid-line" x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}"/>
             <text class="axis-txt" x="${pad.l - 9}" y="${y + 3.5}" text-anchor="end">${fmt(v)}</text>`;
  }
  let bars = '', labels = '';
  data.forEach((d, i) => {
    const cx = pad.l + band * i + band / 2;
    labels += `<text class="axis-txt" x="${cx}" y="${H - 7}" text-anchor="middle">${d[xKey]}</text>`;
    yKeys.forEach((k, ki) => {
      const h = Math.max(2, pad.t + ih - Y(d[k]));
      const x = cx - (bw * yKeys.length) / 2 + ki * bw + (ki ? 2 : 0);
      bars += `<rect class="bar" x="${x}" y="${Y(d[k])}" width="${bw - 2}" height="${h}" rx="4"
                 fill="${colors[ki]}" data-t="${d[xKey]} · ${k}: ${fmt(d[k])}"
                 style="animation:barGrow .8s var(--e-out) ${i * 55 + ki * 40}ms backwards"/>`;
    });
  });
  host.innerHTML = `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}">${grid}${bars}${labels}</svg><div class="chart-tip"></div></div>`;

  const tip = host.querySelector('.chart-tip'), svg = host.querySelector('svg');
  qsa('.bar', host).forEach(b => {
    b.addEventListener('pointerenter', () => {
      const r = svg.getBoundingClientRect(), br = b.getBBox();
      tip.classList.add('show');
      tip.style.left = ((br.x + br.width / 2) / W * r.width) + 'px';
      tip.style.top = (br.y / H * r.height) + 'px';
      tip.textContent = b.dataset.t;
    });
    b.addEventListener('pointerleave', () => tip.classList.remove('show'));
  });
}

/** Donut */
export function donut(parts, { size = 158, thickness = 15, centerVal, centerLbl }) {
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  const total = parts.reduce((a, b) => a + b.v, 0) || 1;
  let off = 0;
  const rings = parts.map(p => {
    const len = (p.v / total) * c;
    const seg = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${p.c}" stroke-width="${thickness}"
      stroke-dasharray="${len - 2.5} ${c - len + 2.5}" stroke-dashoffset="${-off}"/>`;
    off += len;
    return seg;
  }).join('');
  return `
    <div class="donut-wrap">
      <div class="donut" style="width:${size}px;height:${size}px;flex-basis:${size}px">
        <svg width="${size}" height="${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--surface-3)" stroke-width="${thickness}"/>
          ${rings}
        </svg>
        <div class="donut-center"><b>${centerVal}</b><span>${centerLbl}</span></div>
      </div>
      <div class="donut-legend">
        ${parts.map(p => `<div class="dl-row"><i class="sw" style="background:${p.c}"></i>
          <span class="nm">${esc(p.n)}</span><span class="vl">${p.fmt || p.v}</span></div>`).join('')}
      </div>
    </div>`;
}

/* Inject chart keyframes once */
document.head.appendChild(el(`<style>
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @keyframes barGrow { from { transform: scaleY(0); } }
</style>`));
