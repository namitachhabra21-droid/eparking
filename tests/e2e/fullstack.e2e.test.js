import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createDatabase } from "../../server/database.js";
import { createApp } from "../../server/app.js";
import {
  newDriver,
  By,
  Key,
  visible,
  click,
  text,
  count,
  severeErrors,
} from "./helpers.js";
let database, server, base, driver;
const fill = async (css, value) => {
  const el = await visible(driver, css);
  await el.clear();
  await el.sendKeys(value);
};
const waitBody = async (words) =>
  driver.wait(
    async () => String(await text(driver, "body")).includes(words),
    7000,
  );
before(
  async () => {
    database = createDatabase(new PGlite());
    await database.init();
    server = createApp(database).listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${server.address().port}`;
    driver = await newDriver();
    await driver.get(base);
  },
  { timeout: 30000 },
);
after(async () => {
  await driver?.quit();
  await new Promise((r) => server?.close(r));
  await database?.close();
});
test("login page renders and registration opens authenticated dashboard", async () => {
  await click(driver, '[data-mode="register"]');
  await fill("#auth-name", "UI Test Admin");
  await fill("#auth-org", "UI Parking");
  await fill("#auth-email", "ui@example.com");
  await fill("#auth-pass", "Strong UI Parking Password 123!");
  await click(driver, '#auth-form [type="submit"]');
  await visible(driver, "#app");
  assert.equal(await text(driver, ".user-meta b"), "UI Test Admin");
  await waitBody("Operations Overview");
  const initialErrors = await severeErrors(driver);
  assert.ok(
    initialErrors.every((e) => e.includes("/api/auth/me") && e.includes("401")),
  );
});
test("all operational pages render without JavaScript errors", async () => {
  for (const route of [
    "map",
    "sessions",
    "bookings",
    "customers",
    "analytics",
    "alerts",
    "staff",
    "settings",
    "dashboard",
  ]) {
    await driver.get(base + "/#" + route);
    await visible(driver, "#view > *");
  }
  assert.deepEqual(await severeErrors(driver), []);
});
test("booking preserves driver data and payment selection and creates persistent reservation", async () => {
  await click(driver, '[data-act="new-booking"]');
  await click(driver, "#next");
  await visible(driver, "[data-slot]");
  await click(driver, '[data-slot="L1-A01"]');
  await click(driver, "#next");
  await fill("#booking-name", "Asha Rao");
  await fill("#booking-plate", "MH12AB1234");
  await fill("#booking-email", "asha@example.com");
  await fill("#booking-vehicle", "Tata Nexon");
  const method = await visible(driver, "#booking-method");
  await method.sendKeys("UPI");
  assert.equal(
    await (await visible(driver, "#booking-name")).getAttribute("value"),
    "Asha Rao",
  );
  await click(driver, "#next");
  await waitBody("Booking confirmed");
  await driver.get(base + "/#bookings");
  await waitBody("Asha Rao");
  await driver.navigate().refresh();
  await waitBody("Asha Rao");
});
test("reservation checks in and session checks out with receipt", async () => {
  await click(driver, ".tbl tbody tr");
  await click(driver, "#ci");
  await waitBody("Checked in");
  await driver.get(base + "/#sessions");
  await waitBody("Asha Rao");
  await click(driver, ".tbl tbody tr");
  await click(driver, "#m-out");
  await visible(driver, "#edit-form");
  await click(driver, '[type="submit"][form="edit-form"]');
  await waitBody("Parking receipt");
  assert.ok((await text(driver, ".receipt")).includes("Cash recorded"));
  await click(driver, ".modal-scrim:last-of-type [data-close]");
  await driver.get(base + "/#map");
  await visible(driver, '[data-slot="L1-A01"]');
  assert.ok(
    (
      await (
        await visible(driver, '[data-slot="L1-A01"]')
      ).getAttribute("class")
    ).includes("free"),
  );
});
test("customer create and organization settings save across reload", async () => {
  await driver.get(base + "/#customers");
  await visible(driver, "#view > *");
  await click(driver, '[data-act="invite"]');
  await fill("#f-name", "Corporate Driver");
  await fill("#f-email", "corporate@example.com");
  await click(driver, '[type="submit"][form="edit-form"]');
  await waitBody("Corporate Driver");
  await driver.get(base + "/#settings");
  await visible(driver, "#org-name");
  await fill("#org-name", "UI Parking Updated");
  await click(driver, '#settings-form [type="submit"]');
  await waitBody("Settings saved");
  await driver.navigate().refresh();
  await visible(driver, "#org-name");
  assert.equal(
    await (await visible(driver, "#org-name")).getAttribute("value"),
    "UI Parking Updated",
  );
});
test("maintenance hold blocks a bay and can be released", async () => {
  await driver.get(base + "/#map");
  await visible(driver, '[data-slot="L1-A03"]');
  await click(driver, '[data-slot="L1-A03"]');
  await click(driver, "#hold");
  await fill("#f-reason", "Scheduled surface repair");
  await click(driver, '[type="submit"][form="edit-form"]');
  await waitBody("Maintenance saved");
  await driver.navigate().refresh();
  await visible(driver, '[data-slot="L1-A03"].maintenance');
  await click(driver, '[data-slot="L1-A03"]');
  await click(driver, "#rel");
  await click(driver, "#confirm-operation");
  await waitBody("Release bay");
  await visible(driver, '[data-slot="L1-A03"].free');
});
test("revisiting pages does not duplicate dialogs and dark theme persists", async () => {
  for (let i = 0; i < 3; i++) {
    await driver.get(base + "/#sessions");
    await visible(driver, "#view > *");
    await driver.get(base + "/#dashboard");
    await visible(driver, "#view > *");
  }
  await click(driver, '[data-act="new-booking"]');
  assert.equal(await count(driver, ".modal-scrim"), 1);
  await driver.actions().sendKeys(Key.ESCAPE).perform();
  await click(driver, "#theme-btn");
  await driver.navigate().refresh();
  await visible(driver, "#app");
  assert.equal(
    await (await driver.findElement(By.css("html"))).getAttribute("data-theme"),
    "dark",
  );
});
test("mobile layout is usable without horizontal document overflow", async () => {
  await driver.manage().window().setRect({ width: 390, height: 844 });
  await driver.get(base + "/#dashboard");
  await visible(driver, "#app");
  const widths = await driver.executeScript(
    "return {viewport:innerWidth,body:document.documentElement.scrollWidth}",
  );
  assert.ok(widths.body <= widths.viewport + 2, JSON.stringify(widths));
  await click(driver, "#menu");
  assert.ok(
    (
      await (await driver.findElement(By.css("body"))).getAttribute("class")
    ).includes("rail-open"),
  );
});
