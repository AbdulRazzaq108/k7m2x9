// Local browser verification using Playwright. No system-wide installation needed.
// Set PLAYWRIGHT_MODULE to an installed Playwright module path if it is not on NODE_PATH.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  fs.mkdirSync("artifacts", { recursive: true });
  try {
    await page.goto("http://127.0.0.1:8000", { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "Day-ahead wind outlook" })
      .waitFor();
    await page.getByText("24 matched timestamps", { exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => {
      const container = document.querySelector(".chart-container");
      const chart = document.querySelector(".recharts-wrapper");
      return (
        container &&
        chart &&
        Math.abs(
          container.getBoundingClientRect().width -
            chart.getBoundingClientRect().width,
        ) < 2
      );
    });
    assert.equal(
      await page.locator("#decision-date").inputValue(),
      "2026-01-01",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Previous decision day", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(await page.locator("tbody tr").count(), 8);
    const historicalMetrics = await page.locator(".metric-grid").textContent();
    const demandInput = page.getByLabel("Forecast customer demand", {
      exact: true,
    });
    const windInput = page.getByLabel("Wind supply available to the utility", {
      exact: true,
    });
    const securedInput = page.getByLabel("Other supply already secured", {
      exact: true,
    });
    const procurementResult = page.locator("#procurement-result");
    assert.equal(await procurementResult.textContent(), "300.0");
    await demandInput.fill("1600");
    assert.equal(await procurementResult.textContent(), "900.0");
    await demandInput.fill("500");
    assert.equal(await procurementResult.textContent(), "0.0");
    assert.ok(
      (await page.locator(".scenario-result").textContent()).includes(
        "Illustrative surplus: 200.0 MW",
      ),
    );
    await demandInput.fill("700");
    assert.equal(await procurementResult.textContent(), "0.0");
    assert.ok(
      (await page.locator(".scenario-result").textContent()).includes(
        "matches the illustrative demand",
      ),
    );
    await demandInput.fill("");
    assert.equal(await procurementResult.textContent(), "—");
    assert.equal(await demandInput.getAttribute("aria-invalid"), "true");
    await demandInput.fill("-1");
    assert.equal(await procurementResult.textContent(), "—");
    await demandInput.fill("0");
    await windInput.fill("0");
    await securedInput.fill("0");
    assert.equal(await procurementResult.textContent(), "0.0");
    await page
      .getByRole("button", { name: "Reset example", exact: true })
      .click();
    assert.equal(await demandInput.inputValue(), "1000");
    assert.equal(await windInput.inputValue(), "300");
    assert.equal(await securedInput.inputValue(), "400");
    assert.equal(await procurementResult.textContent(), "300.0");
    assert.equal(
      await page.locator(".metric-grid").textContent(),
      historicalMetrics,
    );
    await page.screenshot({
      path: "artifacts/dashboard-desktop.png",
      fullPage: true,
    });

    await page.locator("#decision-date").selectOption("2026-01-31");
    await page
      .getByRole("heading", {
        name: "Forecast vs actual generation",
        exact: true,
      })
      .waitFor();
    await page.waitForFunction(() =>
      document
        .querySelector(".delivery-date")
        ?.textContent?.includes("1 Feb 2026"),
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Next decision day", exact: true })
        .isDisabled(),
      true,
    );
    assert.ok(
      (
        await page.locator(".chart-panel .panel-heading p").textContent()
      ).includes("1 February 2026"),
    );
    assert.equal(await procurementResult.textContent(), "300.0");
    await page
      .getByRole("combobox", { name: "Filter observations" })
      .selectOption("matched");
    await page.waitForFunction(() =>
      [...document.querySelectorAll("tbody tr")].every((row) =>
        row.textContent.includes("Matched"),
      ),
    );
    assert.equal(await page.locator("tbody tr").count(), 8);
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    assert.equal(
      await page.locator("tbody tr:first-child .time-cell").textContent(),
      "08:00",
    );
    await page
      .getByRole("combobox", { name: "Filter observations" })
      .selectOption("unavailable");
    await page.waitForFunction(
      () =>
        document.querySelector("tbody tr:first-child .time-cell")
          ?.textContent === "00:30",
    );
    assert.ok(
      (await page.locator("tbody tr:first-child").textContent()).includes(
        "No eligible forecast",
      ),
    );
    await page.locator("summary").click();
    assert.equal(await page.locator("details").getAttribute("open"), "");

    await page.locator("#decision-date").selectOption("2026-01-15");
    await page
      .getByRole("heading", {
        name: "Forecast vs actual generation",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("combobox", { name: "Filter observations" })
      .selectOption("all");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "artifacts/dashboard-mobile.png",
      fullPage: true,
    });
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert.ok(
      dimensions.content <= dimensions.viewport,
      `Mobile page overflow: ${JSON.stringify(dimensions)}`,
    );
    assert.equal(
      await page.locator("#decision-date").inputValue(),
      "2026-01-15",
    );

    // A failed request must show a readable retry state and must not retain old metrics.
    await page.route("**/api/decisions/2026-01-16", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Snapshot temporarily unavailable." }),
      }),
    );
    await page.locator("#decision-date").selectOption("2026-01-16");
    await page.getByRole("alert").waitFor();
    assert.ok(
      (await page.getByRole("alert").textContent()).includes(
        "Snapshot temporarily unavailable.",
      ),
    );
    assert.equal(await page.locator(".chart-panel").count(), 0);
    await page.unroute("**/api/decisions/2026-01-16");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page.getByText("24 matched timestamps", { exact: true }).waitFor();
    assert.equal(await page.getByRole("alert").count(), 0);
    assert.deepEqual(failures, []);
    console.log(
      JSON.stringify(
        {
          status: "passed",
          checks: [
            "real data render",
            "date boundaries",
            "February delivery",
            "table filters",
            "pagination",
            "methodology disclosure",
            "illustrative procurement inputs, calculation, surplus, validation and reset",
            "procurement independence from historical metrics and selected date",
            "mobile viewport",
            "error and retry",
            "no uncaught browser errors",
          ],
          screenshots: [
            "artifacts/dashboard-desktop.png",
            "artifacts/dashboard-mobile.png",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
