import { DB, LOTS, metrics, money, compact } from "../core/store.js";
import { esc, areaChart, barChart, donut } from "../core/ui.js";
import { exportCSV } from "../core/forms.js";
export function render(root, ctx) {
  const selected = ctx?.lot || "all";
  const sessions = DB.sessions.filter(
    (s) => selected === "all" || s.lotId === selected,
  );
  const payments = DB.payments.filter((p) =>
    sessions.some((s) => s.id === p.sessionId),
  );
  const rev = payments.reduce((n, p) => n + p.amount, 0),
    completed = sessions.filter((s) => s.status === "completed");
  const series = DB.series;
  root.innerHTML = `<div class="page-head"><div class="ph-txt"><h2>Analytics</h2><p>Recorded payments and actual parking activity. Chart days use UTC; Revenue Today uses IST.</p></div><button class="btn btn-ghost" id="analytics-export">Download report</button></div><div class="grid g-4" style="margin-bottom:16px">${[
    ["Recorded Revenue", money(rev), "All recorded payments"],
    [
      "Average Ticket",
      money(completed.length ? rev / completed.length : 0),
      "Completed parking sessions",
    ],
    ["Completed Sessions", completed.length, "Checked out and recorded"],
    [
      "Turnover Today",
      metrics(selected).turnover + "x",
      "Sessions per bay today IST",
    ],
  ]
    .map(
      ([label, value, sub]) =>
        `<div class="card stat"><div class="stat-label">${label}</div><div class="stat-val">${value}</div><div class="stat-foot">${sub}</div></div>`,
    )
    .join(
      "",
    )}</div><div class="card" style="margin-bottom:16px"><div class="card-head"><h3>Estate Revenue by Month</h3><span class="badge neutral">All facilities · last six months</span></div><div class="card-body"><div id="revenue-chart"></div></div></div><div class="grid g-2"><div class="card"><div class="card-head"><h3>Estate Weekly Activity</h3></div><div class="card-body"><div id="week-chart"></div></div></div><div class="card"><div class="card-head"><h3>Payment Methods</h3></div><div class="card-body">${donut(
    ["Cash", "UPI", "Card", "Wallet", "FASTag"].map((m, i) => ({
      n: m,
      v: payments
        .filter((p) => p.method === m)
        .reduce((n, p) => n + p.amount, 0),
      c: ["#3366f2", "#06b6d4", "#10b981", "#8b5cf6", "#f59e0b"][i],
    })),
    { centerVal: money(rev), centerLbl: "Recorded" },
  )}</div></div></div><div class="card" style="margin-top:16px"><div class="card-head"><h3>Facility Benchmark</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Facility</th><th>Capacity</th><th>Occupied</th><th>Reserved</th><th>Maintenance</th><th>Rate</th><th>Recorded Today IST</th></tr></thead><tbody>${LOTS.filter(
    (l) => selected === "all" || l.id === selected,
  )
    .map((l) => {
      const m = metrics(l.id);
      return `<tr><td>${esc(l.name)}</td><td>${m.total}</td><td>${m.occupied}</td><td>${m.reserved}</td><td>${m.maintenance}</td><td>${money(l.rate)}</td><td>${money(m.todayRev)}</td></tr>`;
    })
    .join("")}</tbody></table></div></div>`;
  areaChart(
    root.querySelector("#revenue-chart"),
    series.months.map((m) => ({
      x: m.m,
      Recorded: m.rev,
      "Prior year": m.prev,
    })),
    {
      xKey: "x",
      yKeys: ["Recorded", "Prior year"],
      colors: ["#3366f2", "#94a3b8"],
      fmt: compact,
      height: 250,
    },
  );
  barChart(
    root.querySelector("#week-chart"),
    series.days.map((d) => ({ x: d.day, Sessions: d.sessions })),
    {
      xKey: "x",
      yKeys: ["Sessions"],
      colors: ["#06b6d4"],
      fmt: (v) => String(v),
      height: 220,
    },
  );
  root.querySelector("#analytics-export").onclick = () =>
    exportCSV("payments-report.csv", payments, [
      "id",
      "sessionId",
      "amount",
      "method",
      "reference",
      "paidAt",
      "kind",
    ]);
}
