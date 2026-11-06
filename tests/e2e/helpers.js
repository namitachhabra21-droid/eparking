/* Shared Selenium helpers for the ParkFlow UI suites (headless Chrome via WebDriver) */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, Key, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

export { By, Key, until };

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/* Static server on a random free port, so suites never clash with a running dev server */
export function serve() {
  const srv = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    try {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  return new Promise(resolve => srv.listen(0, () => resolve({ srv, base: `http://localhost:${srv.address().port}/` })));
}

/* Headless Chrome. `mobile` emulates a Pixel 7 (412 px wide) for the responsive suite */
export function newDriver({ mobile = false } = {}) {
  const opts = new chrome.Options().addArguments('--headless=new');
  if (mobile) opts.setMobileEmulation({ deviceName: 'Pixel 7' });
  else opts.addArguments('--window-size=1440,900');
  opts.setLoggingPrefs({ browser: 'ALL' });
  return new Builder().forBrowser('chrome').setChromeOptions(opts).build();
}

let loads = 0;
/* Full page load of a route. Clears stored preferences and reloads, so the seeded store starts fresh */
export async function openPage(driver, base, route = 'dashboard') {
  await driver.get(base);
  await driver.executeScript('localStorage.clear()');
  await driver.get(`${base}?run=${++loads}#${route}`);
  await visible(driver, '#view > *');
}

export async function visible(driver, css, timeout = 5000) {
  const el = await driver.wait(until.elementLocated(By.css(css)), timeout);
  await driver.wait(until.elementIsVisible(el), timeout);
  return el;
}

export const count = (driver, css) => driver.findElements(By.css(css)).then(list => list.length);

/* textContent is read directly, so text inside hidden or animating elements still counts */
export const text = (driver, css) => driver.executeScript(
  'const e = document.querySelector(arguments[0]); return e ? e.textContent.trim() : null;', css);

export const attr = (driver, css, name) => driver.executeScript(
  'const e = document.querySelector(arguments[0]); return e ? e.getAttribute(arguments[1]) : null;', css, name);

export const waitText = (driver, css, expected, timeout = 5000) =>
  driver.wait(async () => (await text(driver, css)) === expected, timeout,
    `${css} never showed "${expected}"`);

/* Scroll into view first (the content pane uses smooth scrolling), then click */
export async function click(driver, css) {
  const el = await driver.wait(until.elementLocated(By.css(css)), 5000);
  await driver.executeScript('arguments[0].scrollIntoView({ block: "center", behavior: "instant" })', el);
  await el.click();
}

export const waitToast = (driver, title) => driver.wait(async () => {
  const titles = await driver.executeScript("return [...document.querySelectorAll('.toast b')].map(b => b.textContent)");
  return titles.includes(title);
}, 5000, `toast "${title}" never appeared`);

/* Stop the 4 s live simulation so bay states hold still while a test reads them */
export const freeze = (driver) =>
  driver.executeScript("return import('./assets/js/core/store.js').then(m => m.stopLive());");

/* Run a function against the app's live store module in the browser and return its result */
export const db = (driver, fn, arg = null) =>
  driver.executeScript(`return import('./assets/js/core/store.js').then(m => (${fn.toString()})(m, arguments[0]));`, arg);

/* Browser console errors logged since the last call. Failed loads from the Google Fonts CDN are
   ignored: they are a network issue outside the app (the test machine may be offline). */
export async function severeErrors(driver) {
  const logs = await driver.manage().logs().get('browser');
  return logs
    .filter(entry => entry.level.name === 'SEVERE')
    .filter(entry => !/fonts\.(googleapis|gstatic)\.com.*Failed to load resource/.test(entry.message))
    .map(entry => entry.message);
}
