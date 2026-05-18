import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const figuresDir = join(__dirname, "paper", "figures");

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });

  const page = await browser.newPage();

  console.log("Navigating to app...");
  await page.goto("https://letters-cambridge.web.app/stories/flyering/", {
    waitUntil: "networkidle",
    timeout: 60000,
  });

  // Wait for map tiles to render
  console.log("Waiting for map tiles...");
  await page.waitForTimeout(5000);

  // --- Desktop screenshot (full sidebar + map) ---
  console.log("Taking desktop screenshot...");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: join(figuresDir, "app-desktop.png"),
    fullPage: false,
  });
  console.log("  -> app-desktop.png");

  // --- Desktop screenshot 2 (algorithm panel expanded) ---
  // Click the algorithm expand button if available
  console.log("Taking desktop screenshot 2 (algorithm panel)...");
  const expandBtn = page.locator('button:has-text("↗")').first();
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({
    path: join(figuresDir, "app-desktop-2.png"),
    fullPage: false,
  });
  console.log("  -> app-desktop-2.png");

  // Close the panel if we opened it
  const closeBtn = page.locator('button:has-text("✕")').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // --- Mobile screenshot ---
  console.log("Taking mobile screenshot...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: join(figuresDir, "app-mobile.png"),
    fullPage: false,
  });
  console.log("  -> app-mobile.png");

  await browser.close();
  console.log("\nDone! Screenshots saved to paper/figures/");
}

takeScreenshots().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
