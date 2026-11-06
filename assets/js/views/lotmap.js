import { action } from "../core/store.js";
import { formDialog, confirmAction } from "../core/forms.js";
import { openBooking } from "./booking.js";
import {
  DB,
  LOTS,
  metrics,
  money,
  dur,
  ago,
  subscribe,
} from "../core/store.js";
import { esc, toast, modal, qsa } from "../core/ui.js";
import { icon } from "../core/icons.js";

const LEGEND = [
  ["Available", "var(--ok-500)"],
  ["Occupied", "var(--bad-500)"],
  ["Reserved", "var(--info-500)"],
  ["EV Charging", "var(--warn-500)"],
  ["Accessible", "var(--text-3)"],
  ["Maintenance", "var(--text-3)"],
];

const cls = (s) =>
  s.type === "acc" && s.status === "free"
    ? "disabled"
    : s.type === "ev" && s.status !== "occupied"
      ? "ev"
      : s.status;

const slotIco = (s) =>
  s.type === "ev"
    ? "bolt"
    : s.type === "acc"
      ? "users"
      : s.status === "occupied"
        ? "car"
        : s.status === "reserved"
          ? "clock"
          : "pin";

export function render(root, ctx) {
  let lotId = ctx.lot === "all" ? LOTS[0].id : ctx.lot;
  let filter = "all";

  root.innerHTML = `
    <div class="page-head">
      <div class="ph-txt">
        <h2>Live Bay Map</h2>
        <p>Click any bay to inspect, reserve or release it. Status updates stream in every few seconds.</p>
      </div>
      <div class="ph-act">
        <span class="live-pill"><i class="ld"></i> Syncing</span>
        <button class="btn btn-ghost" data-act="scan">${icon("qr")} Find Plate</button>
        <button class="btn btn-primary" data-act="assign">${icon("plus")} Assign Bay</button>
      </div>
    </div>

    <div class="grid g-4" id="mapstats" style="margin-bottom:16px"></div>

    <div class="card">
      <div class="toolbar">
        <div class="seg" id="lot-seg">
          ${LOTS.map((l) => `<button data-lot="${l.id}" class="${l.id === lotId ? "on" : ""}">${esc(l.name)}</button>`).join("")}
        </div>
        <div class="spacer"></div>
        <div class="seg" id="f-seg">
          ${[
            ["all", "All"],
            ["free", "Free"],
            ["occupied", "Occupied"],
            ["reserved", "Reserved"],
            ["ev", "EV"],
            ["maintenance", "Maintenance"],
          ]
            .map(
              ([f, l]) =>
                `<button data-f="${f}" class="${f === "all" ? "on" : ""}">${l}</button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="lot-wrap">
        <div class="lot-legend">
          ${LEGEND.map(([n, c]) => `<div class="lg-item"><i class="lg-swatch" style="background:${c}"></i>${n}</div>`).join("")}
        </div>
        <div id="zones"></div>
      </div>
    </div>`;

  const zonesEl = root.querySelector("#zones");
  const statsEl = root.querySelector("#mapstats");

  function drawStats() {
    const m = metrics(lotId);
    const lot = LOTS.find((l) => l.id === lotId);
    const tiles = [
      [
        "Available Now",
        m.free,
        "pin",
        "var(--ok-500)",
        `${m.total} total bays`,
      ],
      [
        "Occupied",
        m.occupied,
        "car",
        "var(--bad-500)",
        `${m.occPct}% utilised`,
      ],
      ["Reserved", m.reserved, "clock", "var(--info-500)", "pre-booked today"],
      [
        "Hourly Rate",
        money(lot.rate),
        "wallet",
        "var(--brand-500)",
        esc(lot.addr),
      ],
    ];
    statsEl.innerHTML = tiles
      .map(
        ([l, v, i, t, s]) => `
      <div class="card stat" style="--tint:${t}">
        <div class="stat-top"><span class="stat-label">${l}</span><div class="stat-ico">${icon(i)}</div></div>
        <div class="stat-val">${v}</div>
        <div class="stat-foot"><span>${s}</span></div>
      </div>`,
      )
      .join("");
  }

  function drawZones() {
    const lot = LOTS.find((l) => l.id === lotId);
    zonesEl.innerHTML = lot.zones
      .map((z) => {
        let list = DB.slots.filter((s) => s.lot === lotId && s.zone === z);
        if (filter === "ev") list = list.filter((s) => s.type === "ev");
        else if (filter !== "all")
          list = list.filter((s) => s.status === filter);
        const free = DB.slots.filter(
          (s) => s.lot === lotId && s.zone === z && s.status === "free",
        ).length;
        return `
        <div class="lot-zone">
          <div class="lot-zone-head">
            <h4>Zone ${z} · Level ${lot.zones.indexOf(z) + 1}</h4>
            <span class="badge ${free > 8 ? "ok" : free > 2 ? "warn" : "bad"}">${free} free</span>
            <i class="line"></i>
            <span class="fs11 t3 fw6">${list.length} bays</span>
          </div>
          <div class="lot-grid">
            ${
              list.length
                ? list
                    .map(
                      (s, i) => `
              <button class="slot ${cls(s)}" data-slot="${s.id}" style="animation-delay:${Math.min(i * 9, 500)}ms"
                      title="${s.id} · ${s.status}">
                ${s.status === "occupied" ? '<i class="live-ring"></i>' : ""}
                ${icon(slotIco(s))}
                <span class="sid">${s.zone}${String(s.num).padStart(2, "0")}</span>
              </button>`,
                    )
                    .join("")
                : `<div class="empty" style="grid-column:1/-1;padding:24px">
                   <p class="t3 fs12">No bays match this filter in Zone ${z}</p></div>`
            }
          </div>
        </div>`;
      })
      .join("");
  }

  drawStats();
  drawZones();

  root.querySelector("#lot-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    lotId = b.dataset.lot;
    qsa("#lot-seg button", root).forEach((x) =>
      x.classList.toggle("on", x === b),
    );
    drawStats();
    drawZones();
  });
  root.querySelector("#f-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    filter = b.dataset.f;
    qsa("#f-seg button", root).forEach((x) =>
      x.classList.toggle("on", x === b),
    );
    drawZones();
  });

  root.addEventListener("click", (e) => {
    const s = e.target.closest("[data-slot]");
    if (s)
      return slotModal(
        DB.slots.find((x) => x.id === s.dataset.slot),
        () => {
          drawStats();
          drawZones();
        },
      );
    const a = e.target.closest("[data-act]")?.dataset.act;
    if (a === "scan")
      modal({
        title: "Find vehicle",
        body: '<label class="lbl" for="plate-lookup">Vehicle plate</label><input class="field" id="plate-lookup" style="width:100%"><div id="plate-results" class="feed"></div>',
        onMount(root) {
          root.querySelector("input").oninput = (e) => {
            const q = e.target.value.trim().toUpperCase();
            root.querySelector("#plate-results").innerHTML = q
              ? DB.slots
                  .filter((s) => s.plate?.includes(q))
                  .map(
                    (s) =>
                      `<p class="empty-note">${esc(s.plate)} · ${esc(s.id)} · ${esc(s.status)}</p>`,
                  )
                  .join("") || '<p class="empty-note">No matching vehicle</p>'
              : "";
          };
        },
      });
    if (a === "assign") ctx.openBooking();
  });

  /* Live re-paint without losing scroll */
  const off = subscribe((evt) => {
    if (!root.isConnected) return off();
    if (evt.type === "tick") {
      qsa(".slot", root).forEach((node) => {
        const s = DB.slots.find((x) => x.id === node.dataset.slot);
        if (!s) return;
        const want = cls(s);
        if (!node.classList.contains(want)) {
          node.className = `slot ${want}`;
          node.style.animation = "slotIn .3s var(--e-spring)";
          node.innerHTML = `${s.status === "occupied" ? '<i class="live-ring"></i>' : ""}${icon(slotIco(s))}<span class="sid">${s.zone}${String(s.num).padStart(2, "0")}</span>`;
        }
      });
      drawStats();
    }
  });
  return off;
}

function slotModal(s, refresh) {
  if (!s) return;
  const lot = LOTS.find((l) => l.id === s.lot);
  const badge = {
    free: "ok",
    occupied: "bad",
    reserved: "info",
    maintenance: "neutral",
  }[s.status];
  const ses = DB.sessions.find(
    (x) => x.slot === s.id && ["active", "overstay"].includes(x.status),
  );
  modal({
    title: `Bay ${s.id}`,
    sub: `${lot.name} · Zone ${s.zone} · Level ${s.floor}`,
    body: `
      <div class="row" style="gap:8px;margin-bottom:14px;flex-wrap:wrap">
        <span class="badge ${badge}"><i class="bdot"></i>${s.status.toUpperCase()}</span>
        ${s.type === "ev" ? `<span class="badge warn">${icon("bolt")} EV Charger</span>` : ""}
        ${s.type === "acc" ? `<span class="badge neutral">${icon("users")} Accessible</span>` : ""}
        <span class="badge brand">${money(lot.rate)}/hr</span>
      </div>
      ${
        s.status !== "free" && s.status !== "maintenance"
          ? `
        <div class="grid g-2" style="gap:11px">
          <div style="background:var(--surface-2);border:1px solid var(--border-soft);border-radius:var(--r-md);padding:12px">
            <div class="fs11 t3 fw6">VEHICLE</div><div class="plate" style="margin-top:5px">${esc(s.plate)}</div></div>
          <div style="background:var(--surface-2);border:1px solid var(--border-soft);border-radius:var(--r-md);padding:12px">
            <div class="fs11 t3 fw6">OCCUPIED FOR</div>
            <div class="fw7" style="margin-top:5px;font-size:15px">${dur(Math.round((Date.now() - s.since) / 60000))}</div></div>
        </div>
        ${ses ? `<div style="margin-top:12px" class="fs12 t2">Linked session <b>${ses.id}</b> · accrued <b>${money(ses.amount)}</b> via ${ses.method}</div>` : ""}
      `
          : `
        <div class="empty" style="padding:26px 10px">
          <div class="empty-ico">${icon("pin")}</div>
          <h4>${s.status === "maintenance" ? "Maintenance hold" : "Bay is free"}</h4><p>${s.status === "maintenance" ? esc(s.reason || "Under maintenance") : "Reserve it for a driver or hold it for maintenance."}</p>
        </div>`
      }`,
    foot:
      s.status === "free"
        ? `<button class="btn btn-ghost" data-close>Cancel</button>
         <button class="btn btn-ghost" id="hold">${icon("shield")} Hold</button>
         <button class="btn btn-primary" id="res">${icon("check")} Reserve Bay</button>`
        : `<button class="btn btn-ghost" data-close>Close</button>
         <button class="btn btn-danger" id="rel">${icon("x")} Release Bay</button>`,
    onMount(scrim, close) {
      scrim.querySelector("#res")?.addEventListener("click", () => {
        close();
        openBooking(null, s.id);
      });
      scrim.querySelector("#hold")?.addEventListener("click", () => {
        close();
        formDialog({
          title: "Maintenance hold",
          fields: [
            {
              name: "reason",
              label: "Reason for maintenance",
              minlength: 3,
              wide: true,
            },
          ],
          onSave: async (v) => {
            await action("hold", { slot: s.id, reason: v.reason });
            toast("Maintenance saved", s.id, "ok");
          },
        });
      });
      scrim.querySelector("#rel")?.addEventListener("click", () => {
        close();
        if (s.status === "occupied") {
          toast(
            "Checkout required",
            "Open the linked session and check out to record payment before releasing this bay",
            "warn",
          );
          return;
        }
        confirmAction(
          "Release bay",
          `Release ${s.id} and cancel its reservation if any?`,
          "release",
          { slot: s.id },
        );
      });
    },
  });
}
