import { modal, esc, toast } from "./ui.js";
import { DB, LOTS, action, money, dateStr } from "./store.js";
import { currentUser } from "./api.js";
export function formDialog({
  title,
  sub = "",
  fields,
  values = {},
  submit = "Save",
  onSave,
}) {
  const field = (f) => {
    const value = values[f.name] ?? f.value ?? "";
    const attrs = `name="${esc(f.name)}" id="f-${esc(f.name)}" ${f.required === false ? "" : "required"} ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.minlength ? `minlength="${f.minlength}"` : ""} maxlength="${f.maxlength || 200}"`;
    return `<div class="${f.wide ? "span-2" : ""}"><label class="lbl" for="f-${esc(f.name)}">${esc(f.label)}</label>${
      f.type === "select"
        ? `<select class="field" ${attrs}>${f.options
            .map((o) => {
              const [v, l] = Array.isArray(o) ? o : [o, o];
              return `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(l)}</option>`;
            })
            .join("")}</select>`
        : `<input class="field" type="${f.type || "text"}" ${attrs} value="${esc(value)}" ${f.step ? `step="${f.step}"` : ""} ${f.type === "password" ? 'autocomplete="new-password"' : ""}>`
    }${f.help ? `<p class="fs11 t3">${esc(f.help)}</p>` : ""}</div>`;
  };
  modal({
    title,
    sub,
    body: `<form id="edit-form"><div class="form-grid">${fields.map(field).join("")}</div><p class="form-error" id="edit-error" role="alert"></p></form>`,
    foot: `<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="edit-form">${esc(submit)}</button>`,
    onMount(root, close) {
      root.querySelector("form").onsubmit = async (e) => {
        e.preventDefault();
        const b = root.querySelector("[type=submit]");
        b.disabled = true;
        const v = Object.fromEntries(new FormData(e.target));
        for (const f of fields)
          if (f.type === "number") v[f.name] = Number(v[f.name]);
        try {
          await onSave(v);
          close();
        } catch (error) {
          root.querySelector("#edit-error").textContent = error.message;
          b.disabled = false;
        }
      };
      root.querySelector("input,select")?.focus();
    },
  });
}
export function confirmAction(title, message, type, data) {
  modal({
    title,
    body: `<p>${esc(message)}</p><p role="alert" class="form-error"></p>`,
    foot: '<button class="btn btn-ghost" data-close>Keep record</button><button class="btn btn-primary" id="confirm-operation">Confirm</button>',
    onMount(root, close) {
      root.querySelector("#confirm-operation").onclick = async (e) => {
        e.target.disabled = true;
        try {
          await action(type, data);
          toast(title, "Saved successfully", "ok");
          close();
        } catch (error) {
          root.querySelector(".form-error").textContent = error.message;
          e.target.disabled = false;
        }
      };
    },
  });
}
export function exportCSV(filename, rows, keys) {
  const safe = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const content = [
    keys.map(safe).join(","),
    ...rows.map((r) => keys.map((k) => safe(r[k])).join(",")),
  ].join("\r\n");
  download(filename, "\uFEFF" + content, "text/csv;charset=utf-8");
}
export function download(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function customerForm(c) {
  formDialog({
    title: c ? "Edit customer" : "Add customer",
    values: c || {},
    fields: [
      { name: "name", label: "Full name", minlength: 2 },
      { name: "email", label: "Email address", type: "email" },
      {
        name: "plan",
        label: "Plan",
        type: "select",
        options: ["Basic", "Plus", "Business", "Enterprise"],
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["active", "dormant"],
      },
      {
        name: "ev",
        label: "EV eligibility",
        type: "select",
        options: [
          ["false", "Standard"],
          ["true", "EV eligible"],
        ],
      },
    ],
    onSave: async (v) => {
      await action("customer", {
        ...v,
        ev: v.ev === "true",
        ...(c ? { id: c.id } : {}),
      });
      toast("Customer saved", v.name, "ok");
    },
  });
}
export function staffForm(member) {
  formDialog({
    title: member ? "Edit team member" : "Add team member",
    values: member || {},
    fields: [
      { name: "name", label: "Full name", minlength: 2 },
      { name: "email", label: "Email", type: "email" },
      { name: "role", label: "Job role", value: "Attendant", minlength: 2 },
      {
        name: "lotId",
        label: "Facility",
        type: "select",
        options: LOTS.map((l) => [l.id, l.name]),
      },
      {
        name: "shift",
        label: "Shift",
        type: "select",
        options: ["06:00–14:00", "14:00–22:00", "22:00–06:00"],
      },
      {
        name: "status",
        label: "Duty",
        type: "select",
        options: ["on-duty", "off-duty"],
      },
    ],
    onSave: async (v) => {
      await action("staff", { ...v, ...(member ? { id: member.id } : {}) });
      toast("Team member saved", v.name, "ok");
    },
  });
}
export function facilityForm(lot) {
  formDialog({
    title: lot ? "Edit facility" : "Add facility",
    sub: "Capacity and zones can change only when every bay is free.",
    values: lot
      ? { ...lot, zones: lot.zones.join(",") }
      : { cap: 50, rate: 60, zones: "A" },
    fields: [
      { name: "name", label: "Facility name", minlength: 2 },
      { name: "addr", label: "Address", minlength: 3 },
      { name: "cap", label: "Bay capacity", type: "number", min: 1, max: 1000 },
      {
        name: "rate",
        label: "Hourly rate INR",
        type: "number",
        min: 1,
        max: 10000,
      },
      {
        name: "zones",
        label: "Zone codes separated by commas",
        wide: true,
        help: "Uppercase letters and numbers, such as A,B,C",
      },
    ],
    onSave: async (v) => {
      await action("facility", {
        ...v,
        zones: v.zones
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
        ...(lot ? { id: lot.id } : {}),
      });
      toast("Facility saved", v.name, "ok");
    },
  });
}
export function checkoutForm(s) {
  formDialog({
    title: "Check out and record payment",
    sub: `${s.plate} · ${s.slot} · currently ${money(s.amount)}. The server calculates the final charge.`,
    submit: "Record payment and check out",
    fields: [
      {
        name: "method",
        label: "Payment received by",
        type: "select",
        options: ["Cash", "UPI", "Card", "Wallet", "FASTag"],
      },
      {
        name: "reference",
        label: "External transaction reference",
        required: false,
        help: "Required for non-cash payments. Verify receipt in your payment provider before recording.",
      },
    ],
    onSave: async (v) => {
      const out = await action("checkout", {
        id: s.id,
        method: v.method,
        ...(v.reference ? { reference: v.reference } : {}),
      });
      toast("Checked out", `${money(out.amount)} payment recorded`, "ok");
      receipt(out);
    },
  });
}
export function receipt(s) {
  const payment = DB.payments.find((p) => p.sessionId === s.id);
  const text = `${DB.settings.name}\nPARKING RECEIPT\n\nSession: ${s.id}\nDriver: ${s.user}\nPlate: ${s.plate}\nFacility: ${s.lot}\nBay: ${s.slot}\nEntry: ${new Date(s.start).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}\nExit: ${s.end ? new Date(s.end).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "In progress"}\nDuration: ${s.mins} minutes\nRate: ${money(s.rate)} / hour\nTotal: ${money(s.amount)}\nPayment: ${payment ? payment.method + " recorded" : "Unpaid"}\nReference: ${payment?.reference || payment?.id || "—"}\nRecorded by: ${currentUser?.name || ""}\n\nThis receipt records a manually confirmed payment.`;
  modal({
    title: "Parking receipt",
    body: `<pre class="receipt">${esc(text)}</pre>`,
    foot: '<button class="btn btn-ghost" data-close>Close</button><button class="btn btn-primary" id="download-receipt">Download receipt</button>',
    onMount(root) {
      root.querySelector("#download-receipt").onclick = () =>
        download(`receipt-${s.id}.txt`, text);
    },
  });
}
