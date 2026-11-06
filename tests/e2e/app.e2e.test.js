/* Selenium end-to-end suite — run with `npm run test:e2e` (needs Chrome) */
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/* Tiny static server so the suite has no other runtime deps */
function serve() {
  const srv = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    try {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  return new Promise(r => srv.listen(0, () => r(srv)));
}

let srv, base, driver;
const $ = (css) => driver.wait(until.elementLocated(By.css(css)), 5000);
const $$ = (css) => driver.findElements(By.css(css));
const text = async (css) => (await $(css)).getText();
const toastSays = (s) => driver.wait(async () =>
  (await $$('.toast b')).length && (await Promise.all((await $$('.toast b')).map(b => b.getText()))).includes(s), 5000);

before(async () => {
  srv = await serve();
  base = `http://localhost:${srv.address().port}/`;
  const opts = new chrome.Options().addArguments('--headless=new', '--window-size=1440,900');
  driver = await new Builder().forBrowser('chrome').setChromeOptions(opts).build();
});
after(async () => { await driver?.quit(); srv?.close(); });

beforeEach(async () => {
  await driver.get(base);
  await driver.executeScript('localStorage.clear()');
  await driver.get(base + '#dashboard');
  await driver.navigate().refresh();
  await $('#pg-title');
});

describe('TS-E1 Shell & navigation', () => {
  test('E2E-01 app boots on the dashboard', async () => {
    assert.equal(await text('#pg-title'), 'Operations Overview');
    assert.equal(await driver.getTitle(), 'Operations Overview — ParkFlow');
  });

  test('E2E-02 sidebar lists all 9 modules', async () => {
    assert.equal((await $$('.nav-item')).length, 9);
  });

  test('E2E-03 clicking a nav item routes to that page', async () => {
    await (await $('[data-route="sessions"]')).click();
    await driver.wait(until.elementTextIs(await $('#pg-title'), 'Parking Sessions'), 3000);
    assert.match(await driver.getCurrentUrl(), /#sessions$/);
  });

  test('E2E-04 unknown route falls back to the dashboard', async () => {
    await driver.get(base + '#does-not-exist');
    await driver.navigate().refresh();
    await driver.wait(until.elementTextIs(await $('#pg-title'), 'Operations Overview'), 3000);
  });

  test('E2E-05 rail meter shows a percentage', async () => {
    assert.match(await text('#load-val'), /^\d{1,3}%$/);
  });
});

describe('TS-E2 Sessions ledger', () => {
  beforeEach(async () => {
    await driver.get(base + '#sessions');
    await $('[data-body] tr');
  });

  test('E2E-06 search narrows the table to matching rows', async () => {
    const before = await text('[data-count]');
    await (await $('[data-q]')).sendKeys('SES-8000');
    await driver.wait(async () => (await text('[data-count]')) === '1 record', 3000);
    assert.notEqual(before, '1 record');
  });

  test('E2E-07 nonsense search shows the empty state', async () => {
    await (await $('[data-q]')).sendKeys('zzzz-no-match');
    assert.equal(await text('.empty h4'), 'No results');
    assert.equal(await text('[data-count]'), '0 records');
  });

  test('E2E-08 status filter keeps only that status', async () => {
    await (await $('select[data-f="status"] option[value="completed"]')).click();
    /* Rows fade in, so read textContent rather than visible text */
    const badges = await $$('[data-body] tr td:last-child .badge');
    assert.ok(badges.length > 0);
    for (const b of badges) assert.equal((await b.getAttribute('textContent')).trim(), 'completed');
  });

  test('E2E-09 clicking a header sorts ascending then descending', async () => {
    const th = await $('th[data-k="amount"]');
    await th.click();
    assert.equal(await th.findElement(By.css('.sort-ico')).getText(), '↑');
    await th.click();
    assert.equal(await th.findElement(By.css('.sort-ico')).getText(), '↓');
  });

  test('E2E-10 pagination: Prev disabled on page 1, Next advances', async () => {
    assert.equal(await (await $('[data-pg="-1"]')).isEnabled(), false);
    const nextBtn = await $('[data-pg="1"]');
    await driver.executeScript('arguments[0].scrollIntoView({block:"center",behavior:"instant"})', nextBtn);
    await nextBtn.click();
    assert.match(await text('[data-page]'), /^2 \/ \d+$/);
  });
});

describe('TS-E3 Booking wizard', () => {
  const next = () => $('.modal #next');

  beforeEach(async () => {
    await driver.get(base + '#bookings');
    await (await $('[data-act="new"]')).click();
    await $('.modal #wz');
  });

  test('E2E-11 cannot pass step 2 without choosing a bay', async () => {
    await (await next()).click();
    await $('.modal [data-slot]');
    await (await next()).click();
    await toastSays('Pick a bay');
  });

  test('E2E-12 full booking holds the bay and confirms', async () => {
    await (await next()).click();
    const bay = await $('.modal [data-slot]');
    const id = await bay.getAttribute('data-slot');
    await bay.click();
    await (await next()).click();
    await (await $('.modal #nm')).sendKeys('Selenium Tester');
    await (await $('.modal #pl')).sendKeys('MH 12 AB 1234');
    await (await next()).click();
    await toastSays('Booking confirmed');
    const status = await driver.executeScript(
      `return import('./assets/js/core/store.js').then(m => m.DB.slots.find(s => s.id === arguments[0]).status)`, id);
    assert.equal(status, 'reserved');
  });

  test('E2E-13 Cancel closes the wizard', async () => {
    await (await $('.modal-foot [data-close]')).click();
    await driver.wait(async () => (await $$('.modal-scrim')).length === 0, 3000);
  });
});

describe('TS-E4 Preferences & shortcuts', () => {
  test('E2E-14 dark mode toggles and survives reload', async () => {
    await (await $('#theme-btn')).click();
    const theme = () => driver.executeScript('return document.documentElement.dataset.theme');
    assert.equal(await theme(), 'dark');
    await driver.navigate().refresh();
    await $('#pg-title');
    assert.equal(await theme(), 'dark');
  });

  test('E2E-15 Ctrl+K opens the command palette and navigates', async () => {
    await driver.actions().keyDown(Key.CONTROL).sendKeys('k').keyUp(Key.CONTROL).perform();
    const q = await $('.modal #cq');
    await q.sendKeys('Analytics');
    await (await $('.modal #clist [data-i]')).click();
    await driver.wait(until.elementTextIs(await $('#pg-title'), 'Analytics'), 3000);
  });
});
