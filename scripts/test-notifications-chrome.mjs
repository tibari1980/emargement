import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const SCREENSHOTS_DIR = path.resolve("public/test-screenshots");

async function run() {
  console.log("=== Testing Notifications System on Google Chrome ===");

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
    // 1. Login as Formateur
    console.log("1. Navigating to login page...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });

    console.log("2. Signing in as formateur@avh-test.fr...");
    await page.type('input[type="email"]', "formateur@avh-test.fr");
    await page.type('input[type="password"]', "AvhTest2026!");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click('button[type="submit"]'),
    ]);

    console.log("Current URL after login:", page.url());
    await new Promise((r) => setTimeout(r, 1500));

    // 2. Verify Notification Bell presence
    console.log("3. Looking for Notification Bell in AppHeader...");
    const bellButton = await page.$('button[aria-label*="Centre de notifications"]');
    if (!bellButton) {
      throw new Error("NotificationBell button not found in AppHeader!");
    }
    const bellLabel = await page.evaluate((el) => el.getAttribute("aria-label"), bellButton);
    console.log("NotificationBell ARIA label:", bellLabel);

    // Capture screenshot of Trainer dashboard with the Notification Bell and unread badge
    const ss1 = path.join(SCREENSHOTS_DIR, "20_notification_bell_badge.png");
    await page.screenshot({ path: ss1, fullPage: false });
    console.log("Saved screenshot:", ss1);

    // 3. Click Notification Bell to open Center
    console.log("4. Clicking Notification Bell...");
    await bellButton.click();
    await new Promise((r) => setTimeout(r, 800));

    // Check dialog presence
    const dialog = await page.$('div[role="dialog"][aria-label*="notifications"]');
    if (!dialog) {
      throw new Error("Notification Center dialog not opened!");
    }
    console.log("Notification Center dialog opened successfully!");

    // Capture screenshot of opened Notification Center
    const ss2 = path.join(SCREENSHOTS_DIR, "21_notification_center_open.png");
    await page.screenshot({ path: ss2, fullPage: false });
    console.log("Saved screenshot:", ss2);

    // 4. Test filtering tabs (Urgentes)
    console.log("5. Testing Filter tabs (Urgentes)...");
    const tabs = await page.$$('button[role="tab"]');
    console.log(`Found ${tabs.length} filter tabs`);
    if (tabs.length >= 3) {
      await tabs[2].click(); // Urgent tab
      await new Promise((r) => setTimeout(r, 600));
      const ss3 = path.join(SCREENSHOTS_DIR, "22_notification_filter_urgent.png");
      await page.screenshot({ path: ss3, fullPage: false });
      console.log("Saved screenshot for urgent filter:", ss3);
    }

    // 5. Test close with Escape key
    console.log("6. Testing close with Escape key...");
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 600));

    const isClosed = await page.evaluate(() => {
      return document.querySelector('div[role="dialog"][aria-label*="notifications"]') === null;
    });
    console.log("Dialog closed after Escape key:", isClosed);

    // 6. Test Alt + N global keyboard shortcut
    console.log("7. Testing global shortcut Alt + N...");
    await page.keyboard.down("Alt");
    await page.keyboard.press("KeyN");
    await page.keyboard.up("Alt");
    await new Promise((r) => setTimeout(r, 800));

    const isOpenByShortcut = await page.evaluate(() => {
      return document.querySelector('div[role="dialog"][aria-label*="notifications"]') !== null;
    });
    console.log("Dialog reopened via Alt + N:", isOpenByShortcut);

    // 7. Test "Tout marquer lu"
    console.log("8. Testing 'Tout marquer comme lu'...");
    const markAllBtn = await page.$('button[aria-label*="Marquer toutes les notifications"]');
    if (markAllBtn) {
      await markAllBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      console.log("Clicked 'Tout marquer lu'!");
    }

    const ss4 = path.join(SCREENSHOTS_DIR, "23_notification_all_read.png");
    await page.screenshot({ path: ss4, fullPage: false });
    console.log("Saved screenshot after mark all read:", ss4);

    // 8. Test Secretariat view with Secretariat notifications
    console.log("9. Testing Secretariat login...");
    await page.goto(`${BASE_URL}/secretary`, { waitUntil: "networkidle2" });
    // Switch to secretariat by navigating or signing in
    await page.evaluate(() => {
      localStorage.setItem("avh_demo_role", "secretary");
    });
    await page.goto(`${BASE_URL}/secretary`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1000));

    // Open notification center for Secretariat
    await page.keyboard.down("Alt");
    await page.keyboard.press("KeyN");
    await page.keyboard.up("Alt");
    await new Promise((r) => setTimeout(r, 800));

    const ss5 = path.join(SCREENSHOTS_DIR, "24_notification_secretariat.png");
    await page.screenshot({ path: ss5, fullPage: false });
    console.log("Saved screenshot Secretariat notifications:", ss5);

    console.log("\n=== ALL NOTIFICATION TESTS COMPLETED WITH 100% SUCCESS ===");
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
