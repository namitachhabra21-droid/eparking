/* Live bay map (FR-2) */
import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { serve, newDriver, openPage, click, text, attr, count, waitText, waitToast, visible, freeze, db } from './helpers.js';

let srv, base, driver;
before(async () => { ({ srv, base } = await serve()); driver = await newDriver(); });
after(async () => { await driver?.quit(); srv?.close(); });

const zoneTotal = () => driver.executeScript(
  "return [...document.querySelectorAll('.lot-zone-head .fs11')].reduce((a, n) => a + parseInt(n.textContent, 10), 0);");

describe('E2E-MAP Live bay map', () => {
  beforeEach(async () => {
    await openPage(driver, base, 'map');
    await freeze(driver);
    /* Switch facility twice so the zones are redrawn from the frozen store */
    await click(driver, '#lot-seg [data-lot="L2"]');
    await click(driver, '#lot-seg [data-lot="L1"]');
    await driver.wait(async () => (await count(driver, '.lot-zone')) === 3, 5000);
  });

  test('E2E-MAP-01: Central Plaza shows all 180 bays across 3 zones', async () => {
    assert.equal(await count(driver, '.lot-zone'), 3);
    assert.equal(await zoneTotal(), 180);
    assert.equal(await count(driver, '.slot[data-slot]'), 180);
  });

  test('E2E-MAP-02: switching facility repaints (Metro Interchange = 220 bays, ₹40/hr)', async () => {
    await click(driver, '#lot-seg [data-lot="L3"]');
    await driver.wait(async () => (await zoneTotal()) === 220, 5000);
    assert.equal(await driver.executeScript("return document.querySelectorAll('#mapstats .stat-val')[3].textContent.trim()"), '₹40');
  });

  test('E2E-MAP-03: "Free" filter shows only free bays and matches the Available tile', async () => {
    await click(driver, '#f-seg [data-f="free"]');
    const titles = await driver.executeScript("return [...document.querySelectorAll('.slot[data-slot]')].map(n => n.title)");
    assert.ok(titles.length > 0);
    for (const t of titles) assert.match(t, /· free$/);
    assert.equal(await text(driver, '#mapstats .stat-val'), String(titles.length));
  });

  test('E2E-MAP-04: "EV" filter shows only EV bays', async () => {
    await click(driver, '#f-seg [data-f="ev"]');
    const ids = await driver.executeScript("return [...document.querySelectorAll('.slot[data-slot]')].map(n => n.dataset.slot)");
    const types = await db(driver, (m, ids) => ids.map(id => m.DB.slots.find(s => s.id === id).type), ids);
    assert.ok(types.length > 0);
    assert.deepEqual([...new Set(types)], ['ev']);
  });

  test('E2E-MAP-05: reserving a free bay changes it to reserved', async () => {
    const id = await attr(driver, '.slot.free[data-slot]', 'data-slot');
    await click(driver, '.slot.free[data-slot]');
    await waitText(driver, '.modal h3', `Bay ${id}`);
    await click(driver, '.modal #res');
    await waitToast(driver, 'Bay reserved');
    assert.equal(await attr(driver, `[data-slot="${id}"]`, 'title'), `${id} · reserved`);
    assert.equal(await db(driver, (m, id) => m.DB.slots.find(s => s.id === id).status, id), 'reserved');
  });

  test('E2E-MAP-06: releasing an occupied bay frees it', async () => {
    const id = await attr(driver, '.slot.occupied[data-slot]', 'data-slot');
    await click(driver, '.slot.occupied[data-slot]');
    await visible(driver, '.modal #rel');
    await click(driver, '.modal #rel');
    await waitToast(driver, 'Bay released');
    assert.deepEqual(await db(driver, (m, id) => {
      const s = m.DB.slots.find(x => x.id === id);
      return [s.status, s.plate, s.since];
    }, id), ['free', null, null]);
  });
});
