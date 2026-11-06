/* Alerts (FR-8), settings (FR-10) and dashboard (FR-1) */
import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { serve, newDriver, openPage, click, text, attr, count, waitText, waitToast, visible, freeze, db } from './helpers.js';

let srv, base, driver;
before(async () => { ({ srv, base } = await serve()); driver = await newDriver(); });
after(async () => { await driver?.quit(); srv?.close(); });

describe('E2E-ALR Alerts', () => {
  beforeEach(async () => {
    await openPage(driver, base, 'alerts');
    await freeze(driver);
  });

  test('E2E-ALR-01: "Open" filter lists exactly the unacknowledged alerts', async () => {
    const open = await db(driver, m => m.DB.alerts.filter(a => !a.ack).length);
    await click(driver, '#a-seg [data-f="open"]');
    assert.equal(await count(driver, '#alist .feed-item'), open);
  });

  test('E2E-ALR-02: acknowledging one alert removes it from "Open"', async () => {
    await click(driver, '#a-seg [data-f="open"]');
    const n = await count(driver, '#alist .feed-item');
    const id = await attr(driver, '[data-ack]', 'data-ack');
    await click(driver, '[data-ack]');
    await waitToast(driver, 'Acknowledged');
    await driver.wait(async () => (await count(driver, '#alist .feed-item')) === n - 1, 3000);
    assert.equal(await db(driver, (m, id) => m.DB.alerts.find(a => a.id === id).ack, id), true);
  });

  test('E2E-ALR-03: "Acknowledge All" leaves nothing open', async () => {
    await click(driver, '[data-act="ackall"]');
    await click(driver, '#a-seg [data-f="open"]');
    await waitText(driver, '#alist .empty h4', 'All clear');
  });

  test('E2E-ALR-04: dismissing removes the alert', async () => {
    const n = await count(driver, '#alist .feed-item');
    await click(driver, '[data-dis]');
    await driver.wait(async () => (await count(driver, '#alist .feed-item')) === n - 1, 3000);
  });
});

describe('E2E-SET Settings', () => {
  beforeEach(async () => { await openPage(driver, base, 'settings'); });

  test('E2E-SET-01: all 5 tabs open their pane', async () => {
    for (const tab of ['general', 'pricing', 'facilities', 'hardware', 'notify']) {
      await click(driver, `[data-tab="${tab}"]`);
      assert.match(await attr(driver, `[data-tab="${tab}"]`, 'class'), /active/);
      await visible(driver, '#pane .card');
    }
  });

  test('E2E-SET-02: tariff table shows rate, daily cap (8×) and overstay fee (2×)', async () => {
    await click(driver, '[data-tab="pricing"]');
    const rows = await driver.executeScript(
      "return [...document.querySelectorAll('#pane table tbody tr')].map(r => [...r.querySelectorAll('td')].map(td => td.textContent.trim()))");
    assert.deepEqual(rows.map(r => [r[1], r[2], r[4]]), [
      ['₹60', '₹480', '₹120'],
      ['₹80', '₹640', '₹160'],
      ['₹40', '₹320', '₹80'],
      ['₹100', '₹800', '₹200'],
    ]);
  });

  test('E2E-SET-03: surge threshold slider updates its label', async () => {
    await click(driver, '[data-tab="pricing"]');
    /* Range inputs are set through the DOM, then the input event fires as a drag would */
    await driver.executeScript("const r = document.querySelector('#rng'); r.value = 92; r.dispatchEvent(new Event('input'));");
    await waitText(driver, '#rngv', '92%');
  });

  test('E2E-SET-04: dark-mode switch changes theme and aria-checked', async () => {
    await click(driver, '[data-sw="theme"]');
    assert.equal(await attr(driver, '[data-sw="theme"]', 'aria-checked'), 'true');
    assert.equal(await driver.executeScript('return document.documentElement.dataset.theme'), 'dark');
  });

  test('E2E-SET-05: Save Changes confirms', async () => {
    await click(driver, '[data-act="save"]');
    await waitToast(driver, 'Settings saved');
  });
});

describe('E2E-DSH Dashboard', () => {
  test('E2E-DSH-01: chart range switch 24h / 7d / 6m redraws the chart', async () => {
    await openPage(driver, base, 'dashboard');
    for (const r of ['7d', '6m', '24h']) {
      await click(driver, `#curve-seg [data-r="${r}"]`);
      assert.match(await attr(driver, `#curve-seg [data-r="${r}"]`, 'class'), /on/);
      await visible(driver, '#curve svg');
    }
  });

  test('E2E-DSH-02: facility picker changes the rail meter to that facility', async () => {
    await openPage(driver, base, 'dashboard');
    await click(driver, '#lot-pick option[value="L4"]');
    /* The meter refreshes on the next 4 s tick (DEF-06), so allow up to 6 s */
    await driver.wait(async () => {
      const expected = await db(driver, m => `${m.metrics('L4').occPct}%`);
      return (await text(driver, '#load-val')) === expected;
    }, 6000, 'rail meter never showed the L4 occupancy');
  });
});
