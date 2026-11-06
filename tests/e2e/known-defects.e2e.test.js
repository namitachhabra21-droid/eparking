/*
 * Regression tests for open defects (Experiment 9 defect log).
 * Each test asserts the behaviour the SRS requires. Node's `todo` option runs it and
 * reports the failure without failing the suite; when the bug is fixed the test
 * reports as passing, so the todo marker can be removed.
 */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, newDriver, openPage, click, text, count, waitText, waitToast, visible, freeze, db, By } from './helpers.js';

let srv, base, driver;
before(async () => { ({ srv, base } = await serve()); driver = await newDriver(); });
after(async () => { await driver?.quit(); srv?.close(); });

describe('E2E-DEF Known defects (todo)', () => {
  test('E2E-DEF-01: Check Out should complete the session (FR-3.4)', { todo: 'DEF-01 open: Check Out only shows a toast' }, async () => {
    await openPage(driver, base, 'sessions');
    await freeze(driver);
    await click(driver, 'select[data-f="status"] option[value="active"]');
    const id = await text(driver, '[data-body] tr td:first-child');
    await click(driver, '[data-body] tr');
    await click(driver, '#m-out');
    await driver.wait(async () => (await db(driver, (m, id) => m.DB.sessions.find(s => s.id === id).status, id)) === 'completed', 2000,
      'session status did not change to completed');
  });

  test('E2E-DEF-02: Cancel Booking should cancel the reservation (FR-5)', { todo: 'DEF-02 open: Cancel only shows a toast' }, async () => {
    await openPage(driver, base, 'bookings');
    const id = await text(driver, '[data-body] tr td:first-child');
    await click(driver, '[data-body] tr');
    await click(driver, '#cx');
    await driver.wait(async () => (await db(driver, (m, id) => m.DB.reservations.find(r => r.id === id).status, id)) === 'cancelled', 2000,
      'reservation status did not change to cancelled');
  });

  test('E2E-DEF-04: chosen start time should become the reservation arrival (FR-4.1)', { todo: 'DEF-04 open: start time input is ignored' }, async () => {
    await openPage(driver, base, 'bookings');
    await freeze(driver);
    await click(driver, '[data-act="new"]');
    await visible(driver, '.modal #wz');
    await click(driver, '.modal #next');
    await click(driver, '.modal [data-slot]');
    await driver.executeScript("const t = document.querySelector('.modal #tm'); t.value = '23:30'; t.dispatchEvent(new Event('change'));");
    await click(driver, '.modal #next');
    await click(driver, '.modal #next');
    await waitToast(driver, 'Booking confirmed');
    const at = await db(driver, m => { const d = new Date(m.DB.reservations[0].at); return [d.getHours(), d.getMinutes()]; });
    assert.deepEqual(at, [23, 30]);
  });

  test('E2E-DEF-06: alert badge should update immediately after Ack (FR-8)', { todo: 'DEF-06 open: badge refreshes only on the next 4 s tick' }, async () => {
    await openPage(driver, base, 'alerts');
    const before = Number(await text(driver, '#alert-count'));
    await click(driver, '[data-ack]');
    /* Read straight after the click: the badge should already show one fewer */
    assert.equal(Number(await text(driver, '#alert-count')), before - 1);
  });

  test('E2E-DEF-07: re-visiting a page should not stack click handlers (one click = one dialog)', { todo: 'DEF-07 open: views add listeners to the shared #view on every render' }, async () => {
    await openPage(driver, base, 'map');
    await click(driver, '[data-route="dashboard"]');
    await waitText(driver, '#pg-title', 'Operations Overview');
    await click(driver, '[data-route="map"]');
    await waitText(driver, '#pg-title', 'Live Bay Map');
    await click(driver, '.slot[data-slot]');
    assert.equal(await count(driver, '.modal'), 1);
  });

  test('E2E-DEF-08: name and plate should survive choosing a payment method (FR-4.1)', { todo: 'DEF-08 open: choosing a payment method repaints step 3 and clears typed fields' }, async () => {
    await openPage(driver, base, 'bookings');
    await freeze(driver);
    await click(driver, '[data-act="new"]');
    await visible(driver, '.modal #wz');
    await click(driver, '.modal #next');
    await click(driver, '.modal [data-slot]');
    await click(driver, '.modal #next');
    await driver.findElement(By.css('.modal #nm')).sendKeys('Asha Rao');
    await driver.findElement(By.css('.modal #pl')).sendKeys('DL 05 AR 7788');
    await click(driver, '.modal [data-m="Card"]');
    assert.equal(await driver.executeScript("return document.querySelector('.modal #nm').value"), 'Asha Rao');
    assert.equal(await driver.executeScript("return document.querySelector('.modal #pl').value"), 'DL 05 AR 7788');
  });
});
