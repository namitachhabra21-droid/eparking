/* Data tables across modules (FR-3, FR-5, FR-6, FR-9) */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, newDriver, openPage, click, waitText, count, text, db, By } from './helpers.js';

let srv, base, driver;
before(async () => { ({ srv, base } = await serve()); driver = await newDriver(); });
after(async () => { await driver?.quit(); srv?.close(); });

const plural = (n) => `${n} record${n === 1 ? '' : 's'}`;
const tileValue = (label) => driver.executeScript(
  "return [...document.querySelectorAll('.stat')].find(s => s.textContent.includes(arguments[0])).querySelector('.stat-val').textContent.trim();", label);

describe('E2E-TBL Data tables', () => {
  test('E2E-TBL-01: sessions search by plate finds that session', async () => {
    await openPage(driver, base, 'sessions');
    const plate = await db(driver, m => m.DB.sessions[0].plate);
    await driver.findElement(By.css('[data-q]')).sendKeys(plate);
    await driver.wait(async () => (await text(driver, '[data-body] tr')).includes(plate), 3000);
  });

  test('E2E-TBL-02: sessions "overstay" filter count matches the Overstays tile', async () => {
    await openPage(driver, base, 'sessions');
    const tile = await tileValue('Overstays');
    await click(driver, 'select[data-f="status"] option[value="overstay"]');
    await waitText(driver, '[data-count]', plural(Number(tile)));
  });

  test('E2E-TBL-03: sorting Amount ascending gives a non-decreasing column', async () => {
    await openPage(driver, base, 'sessions');
    await click(driver, 'th[data-k="amount"]');
    const vals = (await driver.executeScript("return [...document.querySelectorAll('[data-body] tr td:nth-child(7)')].map(n => n.textContent)"))
      .map(t => Number(t.replace(/[^\d]/g, '')));
    assert.equal(vals.length, 12);
    assert.deepEqual(vals, [...vals].sort((a, b) => a - b));
  });

  test('E2E-TBL-04: pagination range text is consistent and Prev enables on page 2', async () => {
    await openPage(driver, base, 'sessions');
    const total = await db(driver, m => m.DB.sessions.length);
    await waitText(driver, '[data-range]', `Showing 1–12 of ${total}`);
    await click(driver, '[data-pg="1"]');
    await waitText(driver, '[data-range]', `Showing 13–24 of ${total}`);
    assert.equal(await driver.findElement(By.css('[data-pg="-1"]')).isEnabled(), true);
  });

  test('E2E-TBL-05: reservations search by reference returns exactly one row', async () => {
    await openPage(driver, base, 'bookings');
    await driver.findElement(By.css('[data-q]')).sendKeys('RSV-4200');
    await waitText(driver, '[data-count]', '1 record');
    assert.equal(await count(driver, '[data-body] tr'), 1);
  });

  test('E2E-TBL-06: customers "Enterprise" filter shows only Enterprise accounts', async () => {
    await openPage(driver, base, 'customers');
    const n = await db(driver, m => m.DB.customers.filter(c => c.plan === 'Enterprise').length);
    await click(driver, 'select[data-f="plan"] option[value="Enterprise"]');
    await waitText(driver, '[data-count]', plural(n));
    const plans = await driver.executeScript("return [...document.querySelectorAll('[data-body] tr td:nth-child(2)')].map(n => n.textContent.trim())");
    for (const p of plans) assert.equal(p, 'Enterprise');
  });

  test('E2E-TBL-07: customer row opens the account detail', async () => {
    await openPage(driver, base, 'customers');
    const name = await db(driver, m => m.DB.customers[0].name);
    await click(driver, '[data-body] tr');
    await waitText(driver, '.modal h3', name);
  });

  test('E2E-TBL-08: staff "on-duty" filter count matches the On Duty tile', async () => {
    await openPage(driver, base, 'staff');
    const tile = await tileValue('On Duty');
    await click(driver, 'select[data-f="status"] option[value="on-duty"]');
    await waitText(driver, '[data-count]', plural(Number(tile)));
  });

  test('E2E-TBL-09: a search with no match shows the empty state', async () => {
    await openPage(driver, base, 'staff');
    await driver.findElement(By.css('[data-q]')).sendKeys('nobody-by-this-name');
    await waitText(driver, '.empty h4', 'No results');
    await waitText(driver, '[data-count]', '0 records');
  });
});
