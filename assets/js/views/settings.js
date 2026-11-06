import { DB, LOTS, money, action } from "../core/store.js";
import { esc, toast } from "../core/ui.js";
import { confirmAction } from "../core/forms.js";
import { facilityForm } from "../core/forms.js";
import { currentUser } from "../core/api.js";
export function render(root, ctx) {
  root.innerHTML = `<div class="page-head"><div class="ph-txt"><h2>Settings</h2><p>Organization details, pricing, facilities and operating policy.</p></div></div><div class="grid g-23"><div class="card" style="align-self:start"><nav class="nav" style="padding:10px">${[
    ["general", "Organization"],
    ["facilities", "Facilities and pricing"],
    ["policy", "Alerts and reservations"],
    ["integrations", "Integrations"],
    ["demo", "Sample demo data"],
  ]
    .map(
      ([id, label]) =>
        `<button class="nav-item ${id === "general" ? "active" : ""}" data-tab="${id}">${label}</button>`,
    )
    .join("")}</nav></div><div id="settings-pane"></div></div>`;
  const pane = root.querySelector("#settings-pane");
  let tab = "general";
  const paint = () => {
    if (tab === "general")
      pane.innerHTML = `<div class="card"><div class="card-head"><h3>Organization</h3></div><div class="card-body"><form id="settings-form"><div class="form-grid"><div><label class="lbl" for="org-name">Organization name</label><input class="field" id="org-name" name="name" value="${esc(DB.settings.name)}" minlength="2" maxlength="120" required></div><div><label class="lbl" for="org-email">Support email</label><input class="field" id="org-email" name="email" type="email" value="${esc(DB.settings.email || "")}"></div></div><p class="fs12 t3" style="margin:18px 0">Currency INR · Operational day Asia/Kolkata. Session timestamps are stored in UTC.</p><p class="form-error" role="alert"></p><button class="btn btn-primary" type="submit">Save organization</button></form></div></div><div class="card" style="margin-top:16px"><div class="card-body"><h3>Appearance</h3><p class="t2 fs12" style="margin:10px 0">Your theme preference is stored on this device.</p><button class="btn btn-ghost" id="settings-theme">Toggle dark mode</button></div></div>`;
    else if (tab === "facilities")
      pane.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:16px"><p class="t2 fs12">Rates apply to new bookings. Existing sessions keep their agreed rate.</p><button class="btn btn-primary" id="add-facility">Add facility</button></div><div class="grid g-2">${LOTS.map((l) => `<div class="card"><div class="card-body"><h3>${esc(l.name)}</h3><p class="fs12 t3" style="margin:8px 0">${esc(l.addr)}</p><p>${l.cap} bays · ${money(l.rate)}/hour</p><p class="fs12 t3" style="margin:8px 0">Zones ${l.zones.map(esc).join(", ")}</p><button class="btn btn-ghost btn-sm" data-edit-facility="${l.id}">Edit facility and tariff</button></div></div>`).join("")}</div>`;
    else if (tab === "policy")
      pane.innerHTML = `<div class="card"><div class="card-head"><h3>Operating policy</h3></div><div class="card-body"><form id="policy-form"><div class="form-grid"><div><label class="lbl" for="occupancy-threshold">Occupancy alert threshold percent</label><input class="field" name="occupancyThreshold" id="occupancy-threshold" type="number" min="50" max="100" value="${DB.settings.occupancyThreshold}" required></div><div><label class="lbl" for="reservation-grace">Reservation arrival grace minutes</label><input class="field" name="reservationGrace" id="reservation-grace" type="number" min="5" max="120" value="${DB.settings.reservationGrace}" required></div></div><p class="fs12 t3" style="margin:16px 0">An unclaimed reservation becomes a no-show after the grace period. Overdue sessions raise an alert. Alerts are evaluated when the workspace syncs.</p><p class="form-error" role="alert"></p><button class="btn btn-primary" type="submit">Save policy</button></form></div></div>`;
    else if (tab === "demo")
      pane.innerHTML = `<div class="card"><div class="card-head"><h3>Sample demo data</h3></div><div class="card-body"><p>Populate your workspace with fictional parking records for presentations.</p><p class="fs12 t3" style="margin:16px 0">Includes 12 customers, 8 staff members, 18 active sessions, 84 completed sessions with sample receipts, 10 upcoming bookings and 2 maintenance bays. Existing records are preserved and only available bays are used. Loading again does not create duplicates.</p>${DB.demo ? '<span class="badge info">Sample data already loaded</span>' : '<button class="btn btn-primary" id="load-demo-data">Load sample data</button>'}<p class="fs12 t3" style="margin-top:16px">Sample payments are fictional amounts for demonstration, not real money received.</p></div></div>`;
    else
      pane.innerHTML = `<div class="card"><div class="card-head"><h3>Integrations</h3></div><div class="card-body"><p class="t2">This workspace uses manually managed arrivals and manually recorded payments.</p><div class="account-list">${[
        ["Database", "Connected · PostgreSQL"],
        [
          "Online payment gateway",
          "Not connected · no online charges are made",
        ],
        [
          "ANPR cameras and barriers",
          "Not connected · use Find Plate and Check In",
        ],
        [
          "Email SMS and EV telemetry",
          "Not connected · alerts are available inside the application",
        ],
      ]
        .map(
          ([k, v]) =>
            `<div class="account-row"><b class="fs12">${k}</b><span class="fs12 t3">${v}</span></div>`,
        )
        .join(
          "",
        )}</div><p class="fs12 t3">Use the Team module for shift records. Workspace login permissions are managed from your account menu.</p></div></div>`;
    pane
      .querySelector("#load-demo-data")
      ?.addEventListener("click", () =>
        confirmAction(
          "Load sample data",
          "Add fictional demonstration records? Existing records will be preserved.",
          "demo",
          {},
        ),
      );
    pane
      .querySelector("#settings-theme")
      ?.addEventListener("click", () =>
        ctx.setTheme(
          document.documentElement.dataset.theme === "dark" ? "light" : "dark",
        ),
      );
    pane
      .querySelector("#add-facility")
      ?.addEventListener("click", () => facilityForm());
    pane
      .querySelectorAll("[data-edit-facility]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            facilityForm(LOTS.find((l) => l.id === b.dataset.editFacility))),
      );
    for (const form of pane.querySelectorAll("form"))
      form.onsubmit = async (e) => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        const b = form.querySelector("button");
        b.disabled = true;
        try {
          await action("settings", {
            ...DB.settings,
            ...values,
            occupancyThreshold: Number(
              values.occupancyThreshold ?? DB.settings.occupancyThreshold,
            ),
            reservationGrace: Number(
              values.reservationGrace ?? DB.settings.reservationGrace,
            ),
          });
          toast(
            "Settings saved",
            "Changes are stored for your workspace",
            "ok",
          );
        } catch (error) {
          form.querySelector(".form-error").textContent = error.message;
          b.disabled = false;
        }
      };
    if (currentUser.role !== "admin")
      pane
        .querySelectorAll(
          "form button,[data-edit-facility],#add-facility,#load-demo-data",
        )
        .forEach((b) => (b.disabled = true));
  };
  root.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.tab;
        root
          .querySelectorAll("[data-tab]")
          .forEach((x) => x.classList.toggle("active", x === b));
        paint();
      }),
  );
  paint();
}
