import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const SCREENSHOTS_DIR = path.resolve("public/test-screenshots");

async function run() {
  console.log("=== Verifying Plannings with NO fictitious data on Google Chrome ===");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1280,900",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // 1. Sign in as Secretariat
    console.log("1. Navigating to login page...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });

    console.log("2. Signing in as secretariat@avh-test.fr...");
    await page.type('input[type="email"]', "secretariat@avh-test.fr");
    await page.type('input[type="password"]', "AvhTest2026!");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click('button[type="submit"]'),
    ]);

    await new Promise((r) => setTimeout(r, 1000));

    // 2. Navigate to /planning
    console.log("3. Navigating to /planning...");
    await page.goto(`${BASE_URL}/planning`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));

    // 3. Check for any dummy data warning
    const pageContent = await page.content();
    const hasDummyText = pageContent.includes("Données fictives de test détectées");
    console.log("Page contains 'Données fictives de test détectées':", hasDummyText);
    if (hasDummyText) {
      throw new Error("FAIL: Page content contains 'Données fictives de test détectées'!");
    }

    // Capture clean screenshot
    const ss = path.join(SCREENSHOTS_DIR, "25_clean_plannings_no_dummy_data.png");
    await page.screenshot({ path: ss, fullPage: false });
    console.log("Saved clean plannings screenshot:", ss);

    // Also check Reports view
    console.log("4. Checking /pedagogical/reports...");
    await page.goto(`${BASE_URL}/pedagogical/reports`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));

    const reportsContent = await page.content();
    const hasReportPurge = reportsContent.includes("Purger données fictives");
    console.log("Reports page contains 'Purger données fictives':", hasReportPurge);
    if (hasReportPurge) {
      throw new Error("FAIL: Reports page still has 'Purger données fictives' button!");
    }

    const ssReports = path.join(SCREENSHOTS_DIR, "26_clean_reports_no_dummy_data.png");
    await page.screenshot({ path: ssReports, fullPage: false });
    console.log("Saved clean reports screenshot:", ssReports);

    console.log("\n=== ALL CLEANUP CHECKS PASSED: ZERO DUMMY DATA / ZERO PURGE BANNERS ===");
  } catch (err) {
    console.error("Verification error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
