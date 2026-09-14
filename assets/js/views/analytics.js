import { DB, LOTS, metrics, money, compact } from '../core/store.js';
import { esc, areaChart, barChart, donut } from '../core/ui.js';
import { icon } from '../core/icons.js';

export function render(root) {
  const s = DB.series;
  const totalRev = s.months.reduce((a, b) => a + b.rev, 0);
  const growth = ((s.months.at(-1).rev / s.months[0].rev - 1) * 100).toFixed(1);
  /* Average ticket derived from the actual session ledger, not the period total */
  const settled = DB.sessions.filter(x => x.status !== 'active');
  const avgTicket = settled.length
    ? settled.reduce((a, b) => a + b.amount, 0) / settled.length : 0;
  const peakHour = s.hours.reduce((a, b) => (b.occ > a.occ ? b : a), s.hours[0]);

  root.innerHTML = `
    <div class="page-head">
      <div class="ph-txt"><h2>Analytics</h2>
        <p>Revenue performance, utilisation patterns and facility benchmarking.</p></div>
      <div class="ph-act">
        <select class="field" style="height:37px"><option>Last 6 months</option><option>Last 30 days</option><option>Year to date</option></select>
        <button class="btn btn-ghost">${icon('download')} Report</button>
      </div>
    </div>

    <div class="grid g-4" style="margin-bottom:16px">
      ${[['Total Revenue', money(totalRev), 'wallet', 'var(--ok-500)', `+${growth}% over period`],
         ['Avg Ticket', money(avgTicket), 'ticket', 'var(--brand-500)', `across ${settled.length} settled sessions`],
         ['Peak Occupancy', peakHour.occ + '%', 'trend', '#8b5cf6', `at ${String(peakHour.h).padStart(2, '0')}:00 hrs`],
         ['Turnover Rate', metrics().turnover + 'x', 'refresh', 'var(--warn-500)', 'bays per day']]
        .map(([l, v, i, t, sub]) => `
          <div class="card hoverable stat" style="--tint:${t}">
            <div class="stat-top"><span class="stat-label">${l}</span><div class="stat-ico">${icon(i)}</div></div>
            <div class="stat-val">${v}</div>
            <div class="stat-foot"><span>${sub}</span></div></div>`).join('')}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><div style="flex:1"><h3>Revenue — This Year vs Last Year</h3>
        <p>Monthly gross across all facilities</p></div>
        <span class="badge ok">${icon('arrUp')} +${growth}%</span></div>
      <div class="card-body"><div id="c1"></div></div>
    </div>

    <div class="grid g-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-head"><div style="flex:1"><h3>Weekly Pattern</h3><p>Revenue and session volume</p></div></div>
        <div class="card-body"><div id="c2"></div></div>
      </div>
      <div class="card">
        <div class="card-head"><div style="flex:1"><h3>Hourly Demand</h3><p>Average occupancy by hour</p></div></div>
        <div class="card-body"><div id="c3"></div></div>
      </div>
    </div>

    <div class="grid g-32">
      <div class="card">
        <div class="card-head"><div style="flex:1"><h3>Facility Benchmark</h3><p>Utilisation and yield per site</p></div></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Facility</th><th>Capacity</th><th>Occupancy</th><th>Rate</th><th>Est. Daily Yield</th><th>Trend</th></tr></thead>
          <tbody>
            ${LOTS.map(l => {
              const m = metrics(l.id);
              const yld = m.occupied * l.rate * 6;
              const up = m.occPct > 65;
              return `<tr>
                <td><div class="row" style="gap:9px"><i style="width:9px;height:9px;border-radius:3px;background:${l.tint}"></i>
                  <div><b class="fw6">${esc(l.name)}</b><div class="muted">${esc(l.addr)}</div></div></div></td>
                <td class="num">${m.total}</td>
                <td style="min-width:150px">
                  <div class="row" style="gap:9px"><div class="pl-track" style="flex:1"><div class="pl-fill" style="width:${m.occPct}%;background:${l.tint}"></div></div>
                  <span class="num fs12">${m.occPct}%</span></div></td>
                <td class="num">${money(l.rate)}</td>
                <td class="num">${money(yld)}</td>
                <td><span class="trend ${up ? 'up' : 'down'}">${icon(up ? 'arrUp' : 'arrDown')}${(Math.random() * 9 + 1).toFixed(1)}%</span></td>
              </tr>`;
            }).join('')}
          </tbody></table></div>
      </div>

      <div class="card">
        <div class="card-head"><div style="flex:1"><h3>Payment Mix</h3><p>Share of settled value</p></div></div>
        <div class="card-body">
          ${donut([
            { n: 'UPI', v: 42, c: '#3366f2', fmt: '42%' },
            { n: 'Card', v: 28, c: '#06b6d4', fmt: '28%' },
            { n: 'FASTag', v: 19, c: '#10b981', fmt: '19%' },
            { n: 'Wallet', v: 11, c: '#f59e0b', fmt: '11%' },
          ], { centerVal: '4', centerLbl: 'Rails' })}
        </div>
      </div>
    </div>`;

  areaChart(root.querySelector('#c1'), s.months.map(m => ({ x: m.m, 'This Yr': m.rev, 'Last Yr': m.prev })),
    { xKey: 'x', yKeys: ['This Yr', 'Last Yr'], colors: ['#3366f2', '#94a3b8'], fmt: compact, height: 260 });
  barChart(root.querySelector('#c2'), s.days.map(d => ({ x: d.day, Revenue: d.rev, Sessions: d.sessions * 40 })),
    { xKey: 'x', yKeys: ['Revenue', 'Sessions'], colors: ['#10b981', '#8b5cf6'], fmt: compact, height: 222 });
  areaChart(root.querySelector('#c3'), s.hours.map(h => ({ x: `${h.h}h`, Occupancy: h.occ })),
    { xKey: 'x', yKeys: ['Occupancy'], colors: ['#f59e0b'], fmt: v => Math.round(v) + '%', height: 222 });
}
