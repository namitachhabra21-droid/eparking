/* Multi-step booking wizard */
import { DB, LOTS, money, ri } from '../core/store.js';
import { el, esc, modal, toast, qsa } from '../core/ui.js';
import { icon } from '../core/icons.js';

export function openBooking(onDone) {
  let step = 1;
  const data = { lot: LOTS[0].id, slot: null, hours: 2, name: '', plate: '', method: 'UPI', ev: false };

  const close = modal({
    title: 'New Booking', sub: 'Reserve a bay in three steps', wide: true,
    body: `<div id="wz"></div>`,
    foot: `<button class="btn btn-ghost" id="back">Back</button>
           <div style="flex:1"></div>
           <button class="btn btn-ghost" data-close>Cancel</button>
           <button class="btn btn-primary" id="next">Continue</button>`,
    onMount(scrim) {
      const wz = scrim.querySelector('#wz');
      const back = scrim.querySelector('#back');
      const next = scrim.querySelector('#next');

      const steps = () => `
        <div class="row" style="gap:0;margin-bottom:18px">
          ${['Facility', 'Bay & Time', 'Confirm'].map((s, i) => {
            const n = i + 1, on = n === step, done = n < step;
            return `<div class="row" style="gap:8px;flex:${i < 2 ? 1 : 0}">
              <div style="width:26px;height:26px;border-radius:99px;display:grid;place-items:center;font-size:11.5px;font-weight:700;
                background:${done || on ? 'var(--brand-500)' : 'var(--surface-3)'};color:${done || on ? '#fff' : 'var(--text-3)'};flex:0 0 26px">
                ${done ? '✓' : n}</div>
              <span class="fs12 fw6" style="color:${on ? 'var(--text)' : 'var(--text-3)'}">${s}</span>
              ${i < 2 ? `<div style="flex:1;height:2px;background:${done ? 'var(--brand-500)' : 'var(--border)'};border-radius:2px"></div>` : ''}
            </div>`;
          }).join('')}
        </div>`;

      const paint = () => {
        let b = '';
        if (step === 1) {
          b = `<div class="grid g-2" style="gap:11px">
            ${LOTS.map(l => {
              const free = DB.slots.filter(s => s.lot === l.id && s.status === 'free').length;
              return `<button class="card hoverable" data-lot="${l.id}" style="text-align:left;padding:14px;border-color:${data.lot === l.id ? 'var(--brand-500)' : 'var(--border)'};border-width:${data.lot === l.id ? '2px' : '1px'}">
                <div class="row" style="gap:10px;margin-bottom:9px">
                  <div class="stat-ico" style="--tint:${l.tint}">${icon('building')}</div>
                  <div style="flex:1;min-width:0"><b class="fw7 fs13">${esc(l.name)}</b>
                    <div class="fs11 t3">${esc(l.addr)}</div></div></div>
                <div class="row" style="gap:7px"><span class="badge ${free > 20 ? 'ok' : 'warn'}">${free} free</span>
                  <span class="badge brand">${money(l.rate)}/hr</span></div></button>`;
            }).join('')}</div>`;
        } else if (step === 2) {
          const free = DB.slots.filter(s => s.lot === data.lot && s.status === 'free').slice(0, 24);
          b = `<label class="lbl">Pick an available bay</label>
            <div class="lot-grid" style="margin-bottom:16px">
              ${free.map(s => `<button class="slot ${data.slot === s.id ? 'selected' : ''} ${s.type === 'ev' ? 'ev' : 'free'}" data-slot="${s.id}">
                ${icon(s.type === 'ev' ? 'bolt' : 'pin')}<span class="sid">${s.zone}${String(s.num).padStart(2, '0')}</span></button>`).join('')}
            </div>
            <div class="grid g-2" style="gap:12px">
              <div><label class="lbl">Duration</label>
                <select class="field" id="hrs" style="width:100%;height:38px">
                  ${[1, 2, 3, 4, 6, 8, 12, 24].map(h => `<option value="${h}" ${data.hours === h ? 'selected' : ''}>${h} hour${h > 1 ? 's' : ''}</option>`).join('')}
                </select></div>
              <div><label class="lbl">Start</label><input class="field" type="time" id="tm" style="width:100%;height:38px" value="${new Date().toTimeString().slice(0, 5)}"></div>
            </div>`;
        } else {
          const lot = LOTS.find(l => l.id === data.lot);
          const total = lot.rate * data.hours;
          b = `<div class="grid g-2" style="gap:12px;margin-bottom:14px">
              <div><label class="lbl">Driver name</label><input class="field" id="nm" style="width:100%;height:38px" placeholder="Full name" value="${esc(data.name)}"></div>
              <div><label class="lbl">Vehicle plate</label><input class="field" id="pl" style="width:100%;height:38px" placeholder="MH 12 AB 1234" value="${esc(data.plate)}"></div>
            </div>
            <label class="lbl">Payment method</label>
            <div class="row wrap" style="gap:8px;margin-bottom:16px">
              ${['UPI', 'Card', 'Wallet', 'FASTag'].map(m => `
                <button class="btn btn-sm ${data.method === m ? 'btn-primary' : 'btn-ghost'}" data-m="${m}">${m}</button>`).join('')}
            </div>
            <div style="padding:15px;border-radius:var(--r-md);background:var(--surface-2);border:1px solid var(--border-soft)">
              ${[['Facility', lot.name], ['Bay', data.slot || '—'], ['Duration', data.hours + ' hours'], ['Rate', money(lot.rate) + '/hr']]
                .map(([k, v]) => `<div class="row" style="padding:5px 0"><span class="fs12 t2" style="flex:1">${k}</span><b class="fs13 fw6">${esc(v)}</b></div>`).join('')}
              <div class="divider" style="margin:9px 0"></div>
              <div class="row"><span class="fs13 fw6" style="flex:1">Total payable</span>
                <b style="font-size:21px;font-weight:770;letter-spacing:-.6px">${money(total)}</b></div>
            </div>`;
        }
        wz.innerHTML = steps() + b;
        back.style.visibility = step === 1 ? 'hidden' : 'visible';
        next.innerHTML = step === 3 ? `${icon('check')} Confirm &amp; Pay` : 'Continue';
      };

      wz.addEventListener('click', e => {
        const l = e.target.closest('[data-lot]');
        if (l) { data.lot = l.dataset.lot; data.slot = null; paint(); }
        const s = e.target.closest('[data-slot]');
        if (s) { data.slot = s.dataset.slot; paint(); }
        const m = e.target.closest('[data-m]');
        if (m) { data.method = m.dataset.m; paint(); }
      });
      wz.addEventListener('change', e => {
        if (e.target.id === 'hrs') data.hours = +e.target.value;
      });

      back.onclick = () => { step--; paint(); };
      next.onclick = () => {
        if (step === 2 && !data.slot) return toast('Pick a bay', 'Select an available bay to continue', 'warn');
        if (step === 3) {
          data.name = wz.querySelector('#nm')?.value || 'Walk-in Guest';
          data.plate = wz.querySelector('#pl')?.value || `MH ${ri(10, 49)} XX ${ri(1000, 9999)}`;
          const lot = LOTS.find(l => l.id === data.lot);
          const slot = DB.slots.find(s => s.id === data.slot);
          if (slot) { slot.status = 'reserved'; slot.since = Date.now(); slot.plate = data.plate; }
          DB.reservations.unshift({
            id: `RSV-${ri(4300, 4999)}`, user: data.name, plate: data.plate,
            lot: lot.name, lotId: lot.id, slot: data.slot, at: Date.now() + 600000,
            hours: data.hours, amount: lot.rate * data.hours, status: 'confirmed', channel: 'Web',
          });
          toast('Booking confirmed', `${data.slot} held for ${data.name} · ${money(lot.rate * data.hours)}`, 'ok');
          close(); onDone?.();
          return;
        }
        step++; paint();
      };
      paint();
    },
  });
}
