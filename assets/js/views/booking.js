import { DB, LOTS, money, action } from "../core/store.js";
import { esc, modal, toast } from "../core/ui.js";
export function openBooking(onDone, initialSlot) {
  let step = 1,
    busy = false;
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  const data = {
    lot: initialSlot
      ? DB.slots.find((s) => s.id === initialSlot)?.lot || LOTS[0].id
      : LOTS[0].id,
    slot: initialSlot || "",
    hours: 2,
    at: local,
    name: "",
    plate: "",
    email: "",
    method: "Cash",
    vehicle: "",
  };
  modal({
    title: "New Reservation",
    sub: "Reserve a bay in three steps",
    wide: true,
    body: '<div id="wz"></div>',
    foot: '<button class="btn btn-ghost" id="back">Back</button><div style="flex:1"></div><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="next">Continue</button>',
    onMount(root, close) {
      const body = root.querySelector("#wz"),
        back = root.querySelector("#back"),
        next = root.querySelector("#next");
      const capture = () => {
        body
          .querySelectorAll("[name]")
          .forEach(
            (el) =>
              (data[el.name] =
                el.type === "number" ? Number(el.value) : el.value),
          );
      };
      const paint = () => {
        const lot = LOTS.find((l) => l.id === data.lot);
        let content = "";
        if (step === 1)
          content = `<div class="grid g-2">${LOTS.map((l) => `<button class="card hoverable" data-lot="${l.id}" style="padding:16px;text-align:left;border:2px solid ${data.lot === l.id ? "var(--brand-500)" : "var(--border)"}"><b>${esc(l.name)}</b><p class="fs12 t3" style="margin:8px 0">${esc(l.addr)}</p><span class="badge ok">${DB.slots.filter((s) => s.lot === l.id && s.status === "free").length} free</span> <span class="badge brand">${money(l.rate)}/hr</span></button>`).join("")}</div>`;
        else if (step === 2) {
          const bays = DB.slots.filter(
            (s) => s.lot === data.lot && s.status === "free",
          );
          content = `<label class="lbl">Choose a bay</label><div class="lot-grid" style="max-height:230px;overflow:auto;margin-bottom:18px">${bays.map((s) => `<button class="slot ${data.slot === s.id ? "selected" : s.type === "ev" ? "ev" : "free"}" data-slot="${s.id}" title="${esc(s.type)}">${esc(s.zone)}${String(s.num).padStart(2, "0")}</button>`).join("") || '<p class="t3">No free bays in this facility.</p>'}</div><div class="form-grid"><div><label class="lbl" for="booking-hours">Duration in hours</label><input class="field" name="hours" id="booking-hours" type="number" min="1" max="168" value="${data.hours}"></div><div><label class="lbl" for="booking-arrival">Arrival date and time</label><input class="field" id="booking-arrival" name="at" type="datetime-local" value="${esc(data.at)}"></div></div>`;
        } else
          content = `<div class="form-grid">${[
            ["name", "Driver name", "text"],
            ["plate", "Vehicle plate", "text"],
            ["email", "Email address optional", "email"],
            ["vehicle", "Vehicle make and model", "text"],
          ]
            .map(
              ([name, label, type]) =>
                `<div><label class="lbl" for="booking-${name}">${label}</label><input class="field" id="booking-${name}" name="${name}" type="${type}" value="${esc(data[name])}" maxlength="${name === "plate" ? 20 : 100}"></div>`,
            )
            .join(
              "",
            )}<div class="span-2"><label class="lbl" for="booking-method">Expected payment method</label><select class="field" id="booking-method" name="method">${["Cash", "UPI", "Card", "Wallet", "FASTag"].map((m) => `<option ${data.method === m ? "selected" : ""}>${m}</option>`).join("")}</select></div></div><div style="margin-top:18px;padding:16px;background:var(--surface-2);border-radius:8px"><b>${esc(lot.name)} · ${esc(data.slot)}</b><p class="t2 fs12" style="margin:8px 0">${data.hours} hours · ${new Date(data.at).toLocaleString("en-IN")}</p><strong style="font-size:22px">${money(lot.rate * data.hours)}</strong><p class="t3 fs12" style="margin-top:8px">Reservation estimate. No online charge is made. The operator records payment at checkout; actual duration determines the final fare.</p></div>`;
        body.innerHTML = `<p class="fs12 t3" style="margin-bottom:18px">Step ${step} of 3 · ${["Facility", "Bay and arrival", "Driver and confirmation"][step - 1]}</p>${content}<p class="form-error" role="alert" id="booking-error"></p>`;
        back.hidden = step === 1;
        next.textContent = step === 3 ? "Confirm reservation" : "Continue";
      };
      body.addEventListener("input", capture);
      body.addEventListener("change", capture);
      body.addEventListener("click", (e) => {
        capture();
        const l = e.target.closest("[data-lot]");
        if (l) {
          data.lot = l.dataset.lot;
          data.slot = "";
          paint();
        }
        const s = e.target.closest("[data-slot]");
        if (s) {
          data.slot = s.dataset.slot;
          paint();
        }
      });
      back.onclick = () => {
        capture();
        if (step > 1) {
          step--;
          paint();
        }
      };
      next.onclick = async () => {
        if (busy) return;
        capture();
        const error = body.querySelector("#booking-error");
        if (step === 2) {
          if (!data.slot) {
            error.textContent = "Pick an available bay to continue";
            return;
          }
          if (
            !Number.isInteger(data.hours) ||
            data.hours < 1 ||
            data.hours > 168 ||
            !Number.isFinite(+new Date(data.at))
          ) {
            error.textContent =
              "Enter a valid arrival time and a duration between 1 and 168 hours";
            return;
          }
        }
        if (step < 3) {
          step++;
          paint();
          return;
        }
        busy = true;
        next.disabled = true;
        next.textContent = "Reserving…";
        try {
          const r = await action("book", {
            slot: data.slot,
            name: data.name,
            plate: data.plate,
            email: data.email,
            hours: Number(data.hours),
            at: +new Date(data.at),
            method: data.method,
            vehicle: data.vehicle || "Vehicle",
          });
          toast("Booking confirmed", `${r.slot} reserved for ${r.user}`, "ok");
          close();
          onDone?.();
        } catch (e) {
          error.textContent = e.message;
          busy = false;
          next.disabled = false;
          next.textContent = "Confirm reservation";
        }
      };
      paint();
    },
  });
}
