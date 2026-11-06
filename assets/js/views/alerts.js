import { DB, ago, action } from "../core/store.js";
import { esc, toast } from "../core/ui.js";
import { icon } from "../core/icons.js";
export function render(root, ctx) {
  let filter = "all";
  root.innerHTML = `<div class="page-head"><div class="ph-txt"><h2>Alerts and Incidents</h2><p>Actionable occupancy and session alerts from your parking records.</p></div><div class="ph-act"><button class="btn btn-ghost" id="ack-all">Acknowledge all</button><button class="btn btn-primary" id="alert-policy">Alert policy</button></div></div><div class="grid g-3" style="margin-bottom:16px">${[
    ["Critical", DB.alerts.filter((a) => a.sev === "bad" && !a.ack).length],
    ["Warnings", DB.alerts.filter((a) => a.sev === "warn" && !a.ack).length],
    ["Unacknowledged", DB.alerts.filter((a) => !a.ack).length],
  ]
    .map(
      ([label, n]) =>
        `<div class="card stat"><div class="stat-label">${label}</div><div class="stat-val">${n}</div></div>`,
    )
    .join(
      "",
    )}</div><div class="card"><div class="toolbar"><div class="seg" id="a-seg"><button class="on" data-f="all">All</button><button data-f="open">Open</button><button data-f="ack">Acknowledged</button></div></div><div class="feed" id="alist"></div></div>`;
  const paint = () => {
    const list = DB.alerts.filter(
      (a) => filter === "all" || (filter === "open" ? !a.ack : a.ack),
    );
    root.querySelector("#alist").innerHTML =
      list
        .map(
          (a) =>
            `<div class="feed-item"><div class="feed-ico">${icon(a.icon || "alert")}</div><div class="feed-body"><b>${esc(a.title)}</b> <span class="badge ${a.ack ? "neutral" : "warn"}">${a.ack ? "acknowledged" : esc(a.sev)}</span><p>${esc(a.body)}</p><div class="feed-time">${esc(a.lot)} · ${ago(a.at)}</div></div><div class="row">${!a.ack ? `<button class="btn btn-sm btn-ghost" data-ack="${a.id}">Ack</button>` : ""}<button class="btn btn-sm btn-ghost" data-dis="${a.id}" aria-label="Dismiss alert">Dismiss</button></div></div>`,
        )
        .join("") ||
      '<div class="empty"><h4>All clear</h4><p>No incidents match this filter.</p></div>';
  };
  root.querySelectorAll("[data-f]").forEach(
    (b) =>
      (b.onclick = () => {
        filter = b.dataset.f;
        root
          .querySelectorAll("[data-f]")
          .forEach((x) => x.classList.toggle("on", x === b));
        paint();
      }),
  );
  root.onclick = async (e) => {
    const a = e.target.closest("[data-ack],[data-dis],#ack-all");
    if (!a) return;
    a.disabled = true;
    try {
      await action(
        a.id === "ack-all" ? "ackall" : "alert",
        a.id === "ack-all"
          ? {}
          : {
              id: a.dataset.ack || a.dataset.dis,
              action: a.dataset.ack ? "ack" : "dismiss",
            },
      );
      toast("Alerts updated", "", "ok");
    } catch (error) {
      toast("Unable to update", error.message, "bad");
      a.disabled = false;
    }
  };
  root.querySelector("#alert-policy").onclick = () => ctx.go("settings");
  paint();
}
