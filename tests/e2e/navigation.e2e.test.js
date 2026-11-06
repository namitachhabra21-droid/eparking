/* Shell & navigation — every module renders without JS errors (FR-1, FR-11) */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, newDriver, openPage, click, text, attr, waitText, severeErrors, Key } from './helpers.js';

const ROUTES = [
  ['dashboard', 'Operations Overview'],
  ['map', 'Live Bay Map'],
  ['sessions', 'Parking Sessions'],
  ['bookings', 'Reservations'],
  ['customers', 'Customers'],
  ['analytics', 'Analytics'],
  ['alerts', 'Alerts & Incidents'],
  ['staff', 'Team & Shifts'],
  ['settings', 'Settings'],
];

let srv, base, driver;
before(async () => { ({ srv, base } = await serve()); driver = await newDriver(); });
after(async () => { await driver?.quit(); srv?.close(); });

describe('E2E-NAV Shell & navigation', () => {
  for (const [route, title] of ROUTES) {
    test(`E2E-NAV-${route}: page renders with no JavaScript errors`, async () => {
      await severeErrors(driver);
      await openPage(driver, base, route);
      await waitText(driver, '#pg-title', title);
      assert.equal(await driver.getTitle(), `${title} — ParkFlow`);
      assert.match(await attr(driver, `[data-route="${route}"]`, 'class'), /active/);
      assert.notEqual(await text(driver, '#view'), '');
      assert.deepEqual(await severeErrors(driver), []);
    });
  }

  test('E2E-NAV-13: Ctrl+B collapses the sidebar and the choice persists', async () => {
    await openPage(driver, base, 'dashboard');
    await driver.actions().keyDown(Key.CONTROL).sendKeys('b').keyUp(Key.CONTROL).perform();
    await driver.wait(async () => (await attr(driver, '.rail', 'class')).includes('collapsed'), 3000);
    assert.equal(await driver.executeScript("return localStorage.getItem('pf-rail')"), '1');
    await click(driver, '#collapse');   /* leave the shared browser in the default state */
  });
});
