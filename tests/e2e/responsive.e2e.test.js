/* Mobile layout in emulated Pixel 7 (412 px) — NFR-3 */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, newDriver, openPage, click, text, attr, visible, waitText } from './helpers.js';

const ROUTES = ['dashboard', 'map', 'sessions', 'bookings', 'customers', 'analytics', 'alerts', 'staff', 'settings'];

let srv, base, driver;
before(async () => { ({ srv, base } = await serve()); driver = await newDriver({ mobile: true }); });
after(async () => { await driver?.quit(); srv?.close(); });

describe('E2E-MOB Mobile layout', () => {
  for (const route of ROUTES) {
    test(`E2E-MOB-${route}: no horizontal page scroll`, async () => {
      await openPage(driver, base, route);
      const { sw, cw } = await driver.executeScript(
        'return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }');
      assert.ok(sw <= cw, `scrollWidth ${sw} is wider than the ${cw}px viewport`);
    });
  }

  test('E2E-MOB-10: sidebar is an off-screen drawer that the menu button opens', async () => {
    await openPage(driver, base, 'dashboard');
    await visible(driver, '#menu');
    const right = await driver.executeScript("return document.querySelector('.rail').getBoundingClientRect().right");
    assert.ok(right <= 0, `drawer right edge at ${right}px, expected off-screen`);
    await click(driver, '#menu');
    /* Wait for the drawer's slide-in to finish before clicking inside it */
    await driver.wait(async () => (await driver.executeScript("return document.querySelector('.rail').getBoundingClientRect().left")) >= 0, 3000,
      'drawer never slid into view');
    await click(driver, '[data-route="alerts"]');
    await waitText(driver, '#pg-title', 'Alerts & Incidents');
    assert.ok(!(await attr(driver, 'body', 'class')).includes('rail-open'));
  });
});
