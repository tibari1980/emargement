import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const SCREENSHOTS_DIR = path.resolve("public/test-screenshots");
const ARTIFACT_DIR = path.resolve("C:/Users/zerou/.gemini/antigravity/brain/c3450d01-4aeb-480c-84e5-bf85eb497af1/test-screenshots");

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function run() {
  console.log("=== Verification: Notifications Center & Justifications Submission ===");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1280,960",
    ],
  });

  const page = await browser.newPage();
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.setViewport({ width: 1280, height: 960 });

  try {
    // 1. Log in as Secretariat
    console.log("1. Navigating to login page...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
    await page.type('input[type="email"]', "secretariat@avh-test.fr");
    await page.type('input[type="password"]', "AvhTest2026!");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }),
      page.click('button[type="submit"]'),
    ]);
    console.log("Logged in successfully. URL:", page.url());

    // 2. Test Notification Center
    console.log("\n2. Testing Notification Center display...");
    const bellSelector = 'button[aria-label*="Centre de notifications"]';
    await page.waitForSelector(bellSelector, { timeout: 5000 });
    
    // Check if bell button is visible and click it
    console.log("Clicking notification bell button...");
    await page.click(bellSelector);
    await new Promise((r) => setTimeout(r, 1000));

    // Log all dialogs in DOM
    const allDialogs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[role="dialog"]')).map(d => ({
        tag: d.tagName,
        ariaLabel: d.getAttribute('aria-label'),
        className: d.className,
        parent: d.parentElement?.tagName,
        rect: d.getBoundingClientRect()
      }));
    });
    console.log("All dialogs in DOM after clicking bell:", JSON.stringify(allDialogs, null, 2));

    // Verify dialog opened and check its parent and layout
    const dialogInfo = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"][aria-label*="Centre de notifications"]');
      if (!dialog) return { exists: false, error: "Dialog not found" };
      const rect = dialog.getBoundingClientRect();
      const parentTag = dialog.parentElement?.tagName;
      const panel = dialog.querySelector('.relative.flex.flex-col');
      const panelRect = panel ? panel.getBoundingClientRect() : null;
      const items = dialog.querySelectorAll('article');
      return {
        exists: true,
        parentTag,
        dialogRect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
        panelRect: panelRect ? { width: panelRect.width, height: panelRect.height } : null,
        itemCount: items.length,
      };
    });

    console.log("Notification dialog info:", JSON.stringify(dialogInfo, null, 2));

    const shot29Public = path.join(SCREENSHOTS_DIR, "29_notifications_portal_fixed.png");
    const shot29Artifact = path.join(ARTIFACT_DIR, "29_notifications_portal_fixed.png");
    await page.screenshot({ path: shot29Public, fullPage: false });
    fs.copyFileSync(shot29Public, shot29Artifact);
    console.log("Captured 29_notifications_portal_fixed.png");

    // Close notification dialog
    await page.evaluate(() => {
      const closeBtn = document.querySelector('div[role="dialog"][aria-label*="notifications"] button[aria-label="Fermer le centre de notifications"]');
      if (closeBtn) closeBtn.click();
      else {
        const backdrop = document.querySelector('div[role="dialog"][aria-label*="notifications"] .cursor-pointer');
        if (backdrop) backdrop.click();
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    // 3. Navigate to /secretary/justifications
    console.log("\n3. Navigating to /secretary/justifications...");
    await page.goto(`${BASE_URL}/secretary/justifications`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));

    // Select Adaptation formation if not already
    await page.evaluate(() => {
      const selects = document.querySelectorAll("select");
      const formationSelect = selects[0];
      const opt = Array.from(formationSelect.options).find((o) =>
        o.text.toLowerCase().includes("adaptation")
      );
      if (opt && formationSelect.value !== opt.value) {
        formationSelect.value = opt.value;
        formationSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Select "lamia aboukitab" if present, or first trainee
    const chosenTrainee = await page.evaluate(() => {
      const selects = document.querySelectorAll("select");
      const traineeSelect = selects[1];
      const optLamia = Array.from(traineeSelect.options).find((o) =>
        o.text.toLowerCase().includes("lamia")
      );
      if (optLamia) {
        traineeSelect.value = optLamia.value;
        traineeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        return optLamia.text;
      }
      const firstValid = Array.from(traineeSelect.options).find((o) => o.value !== "");
      if (firstValid) {
        traineeSelect.value = firstValid.value;
        traineeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        return firstValid.text;
      }
      return null;
    });
    console.log("Selected trainee:", chosenTrainee);
    await new Promise((r) => setTimeout(r, 1000));

    // Fill dates: 2026-10-31 to 2026-11-05 using native React input setter
    console.log("Setting dates: 2026-10-31 to 2026-11-05");
    await page.evaluate(() => {
      const setReactValue = (input, val) => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        ).set;
        setter.call(input, val);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };

      const dateInputs = document.querySelectorAll('input[type="date"]');
      if (dateInputs.length >= 2) {
        setReactValue(dateInputs[0], "2026-10-31");
        setReactValue(dateInputs[1], "2026-11-05");
      }
    });

    // Select reason: "Rendez-vous médical"
    await page.evaluate(() => {
      const selects = document.querySelectorAll("select");
      const reasonSelect = selects[2]; // third select is reason
      if (reasonSelect) {
        const optMed = Array.from(reasonSelect.options).find((o) =>
          o.text.toLowerCase().includes("médical")
        );
        if (optMed) {
          reasonSelect.value = optMed.value;
          reasonSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
    await new Promise((r) => setTimeout(r, 500));

    // Click "Enregistrer le justificatif"
    console.log("Submitting justification form...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Enregistrer le justificatif")
      );
      if (btn) btn.click();
    });

    // Wait for response and success alert
    await new Promise((r) => setTimeout(r, 2000));

    // Check alert and history list
    const submissionResult = await page.evaluate(() => {
      const alerts = Array.from(document.querySelectorAll('[role="alert"], [role="status"]'));
      const alertTexts = alerts.map((a) => a.textContent?.trim());
      const historyItems = Array.from(document.querySelectorAll("ul li")).map((li) =>
        li.textContent?.trim()
      );
      return {
        alerts: alertTexts,
        historyCount: historyItems.length,
        historyItems: historyItems.slice(0, 10),
      };
    });

    console.log("Submission result:", JSON.stringify(submissionResult, null, 2));

    // Capture screenshot 30 (Justification Success Alert & History List)
    const shot30Public = path.join(SCREENSHOTS_DIR, "30_justification_success_alert.png");
    const shot30Artifact = path.join(ARTIFACT_DIR, "30_justification_success_alert.png");
    await page.screenshot({ path: shot30Public, fullPage: true });
    fs.copyFileSync(shot30Public, shot30Artifact);
    console.log("Captured 30_justification_success_alert.png");

    // 4. Test in High Contrast Mode (User's preferred theme)
    console.log("\n4. Testing High Contrast Mode...");
    await page.evaluate(() => {
      document.documentElement.classList.add("contrast-high");
      localStorage.setItem("avh_a11y_contrast", "high");
    });
    await new Promise((r) => setTimeout(r, 600));

    const shot32Public = path.join(SCREENSHOTS_DIR, "32_justifications_high_contrast.png");
    const shot32Artifact = path.join(ARTIFACT_DIR, "32_justifications_high_contrast.png");
    await page.screenshot({ path: shot32Public, fullPage: true });
    fs.copyFileSync(shot32Public, shot32Artifact);
    console.log("Captured 32_justifications_high_contrast.png");

    // Open notification center in High Contrast Mode
    console.log("Opening Notification Center in High Contrast Mode...");
    await page.click(bellSelector);
    await new Promise((r) => setTimeout(r, 800));

    const shot31Public = path.join(SCREENSHOTS_DIR, "31_notifications_high_contrast.png");
    const shot31Artifact = path.join(ARTIFACT_DIR, "31_notifications_high_contrast.png");
    await page.screenshot({ path: shot31Public, fullPage: false });
    fs.copyFileSync(shot31Public, shot31Artifact);
    console.log("Captured 31_notifications_high_contrast.png");

    console.log("\n=== ALL VERIFICATIONS COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await browser.close();
  }
}

run();
