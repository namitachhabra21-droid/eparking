/* Booking wizard, beyond the original E2E-11…13 (FR-4) */
import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { serve, newDriver, openPage, click, attr, count, text, waitToast, visible, freeze, db, By, Key } from './helpers.js';

let srv, base, driver;
before(async () => { ({ srv, base } = await serve()); driver = await newDriver(); });
after(async () => { await driver?.quit(); srv?.close(); });

describe('E2E-BK Booking wizard', () => {
  beforeEach(async () => {
    await openPage(driver, base, 'bookings');
    await freeze(driver);
    await click(driver, '[data-act="new"]');
    await visible(driver, '.modal #wz');
  });

  test('E2E-BK-01: step 1 lists all 4 facilities with their rates', async () => {
    assert.equal(await count(driver, '.modal [data-lot]'), 4);
    for (const [id, rate] of [['L1', '₹60'], ['L2', '₹80'], ['L3', '₹40'], ['L4', '₹100']]) {
      const label = await text(driver, `.modal [data-lot="${id}"]`);
      assert.ok(label.includes(`${rate}/hr`), `${id}: ${label}`);
    }
  });

  test('E2E-BK-02: cannot continue from step 2 without a bay', async () => {
    await click(driver, '.modal #next');
    await click(driver, '.modal #next');
    await waitToast(driver, 'Pick a bay');
    assert.equal(await count(driver, '.modal #hrs'), 1);   /* still on step 2 */
  });

  test('E2E-BK-03: total payable = hourly rate × hours (₹80 × 3 h = ₹240)', async () => {
    await click(driver, '.modal [data-lot="L2"]');
    await click(driver, '.modal #next');
    await click(driver, '.modal [data-slot]');
    await click(driver, '.modal #hrs option[value="3"]');
    await click(driver, '.modal #next');
    const total = await driver.executeScript(
      "const r = [...document.querySelectorAll('.modal .row')].find(n => n.textContent.includes('Total payable')); return r.querySelector('b').textContent.trim();");
    assert.equal(total, '₹240');
  });

  test('E2E-BK-04: confirming reserves the bay and creates a confirmed reservation', async () => {
    await click(driver, '.modal #next');
    const id = await attr(driver, '.modal [data-slot]', 'data-slot');
    await click(driver, '.modal [data-slot]');
    await click(driver, '.modal #next');
    /* Pick the payment method first: choosing it after typing clears the fields (DEF-08) */
    await click(driver, '.modal [data-m="FASTag"]');
    await driver.findElement(By.css('.modal #nm')).sendKeys('Selenium Tester');
    await driver.findElement(By.css('.modal #pl')).sendKeys('KA 01 PW 2026');
    await click(driver, '.modal #next');
    await waitToast(driver, 'Booking confirmed');
    const r = await db(driver, (m, id) => {
      const slot = m.DB.slots.find(s => s.id === id);
      const res = m.DB.reservations[0];
      return { slot: slot.status, plate: slot.plate, res: [res.user, res.plate, res.slot, res.hours, res.amount, res.status] };
    }, id);
    assert.equal(r.slot, 'reserved');
    assert.equal(r.plate, 'KA 01 PW 2026');
    assert.deepEqual(r.res, ['Selenium Tester', 'KA 01 PW 2026', id, 2, 120, 'confirmed']);
  });

  test('E2E-BK-05: Back keeps the chosen facility', async () => {
    await click(driver, '.modal [data-lot="L4"]');
    await click(driver, '.modal #next');
    await click(driver, '.modal #back');
    const border = await driver.findElement(By.css('.modal [data-lot="L4"]')).getCssValue('border-top-width');
    assert.equal(border, '2px');
  });

  test('E2E-BK-06: Escape closes the wizard without saving', async () => {
    const before = await db(driver, m => m.DB.reservations.length);
    await driver.actions().sendKeys(Key.ESCAPE).perform();
    await driver.wait(async () => (await count(driver, '.modal-scrim')) === 0, 3000);
    assert.equal(await db(driver, m => m.DB.reservations.length), before);
  });
});
