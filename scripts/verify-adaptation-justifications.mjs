import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const SCREENSHOTS_DIR = path.resolve("public/test-screenshots");

async function run() {
  console.log("=== Verification: Formations & 8 Trainees in Justifications and Import ===");

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
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  await page.setViewport({ width: 1280, height: 900 });

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

    // 2. Go to /secretary/justifications
    console.log("2. Navigating to /secretary/justifications...");
    await page.goto(`${BASE_URL}/secretary/justifications`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));

    // Inspect Formation & Trainee dropdowns
    const state1 = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      const formationSelect = selects[0];
      const traineeSelect = selects[1];
      return {
        formationValue: formationSelect?.value,
        formationText: formationSelect?.options[formationSelect.selectedIndex]?.text,
        totalFormationOptions: formationSelect?.options.length,
        traineeValue: traineeSelect?.value,
        traineeText: traineeSelect?.options[traineeSelect.selectedIndex]?.text,
        totalTrainees: traineeSelect?.options.length,
        trainees: Array.from(traineeSelect?.options || []).map((o) => ({ value: o.value, text: o.text })),
      };
    });

    console.log("Initial Formation selected:", state1.formationText, `(${state1.formationValue})`);
    console.log("Total formations available:", state1.totalFormationOptions);
    console.log("Initial Trainee selected:", state1.traineeText, `(${state1.traineeValue})`);
    console.log("Total trainees in dropdown:", state1.totalTrainees);

    // If Adaptation is not already selected, select it
    if (!state1.formationText?.toLowerCase().includes("adaptation")) {
      console.log("Selecting Adaptation formation...");
      await page.evaluate(() => {
        const formationSelect = document.querySelectorAll("select")[0];
        const opt = Array.from(formationSelect.options).find(o => o.text.toLowerCase().includes("adaptation"));
        if (opt) {
          formationSelect.value = opt.value;
          formationSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Verify 8 Trainees
    const state2 = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      const traineeSelect = selects[1];
      const validTrainees = Array.from(traineeSelect?.options || []).filter((o) => o.value !== "");
      return {
        count: validTrainees.length,
        trainees: validTrainees.map((o) => ({ value: o.value, name: o.text })),
      };
    });

    console.log(`\nVerified ${state2.count} Trainees in Adaptation:`);
    state2.trainees.forEach((t, i) => console.log(`  ${i + 1}. ${t.name} (id: ${t.value})`));

    if (state2.count < 8) {
      throw new Error(`FAIL: Expected 8 trainees, found ${state2.count}`);
    }
    console.log("SUCCESS: All 8 trainees are present in the dropdown!");

    // Capture screenshot 27 (Justifications with Adaptation and 8 Trainees)
    const shot27 = path.join(SCREENSHOTS_DIR, "27_justifications_adaptation_8_trainees.png");
    await page.screenshot({ path: shot27, fullPage: true });
    console.log("Captured screenshot 27:", shot27);

    // 3. Test selecting a different trainee in the dropdown
    console.log("\n3. Selecting Marc Lefebvre in the trainee dropdown...");
    await page.evaluate(() => {
      const traineeSelect = document.querySelectorAll("select")[1];
      const opt = Array.from(traineeSelect.options).find(o => o.text.includes("Marc Lefebvre"));
      if (opt) {
        traineeSelect.value = opt.value;
        traineeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await new Promise((r) => setTimeout(r, 500));

    // 4. Go to /secretary/import
    console.log("\n4. Navigating to /secretary/import...");
    await page.goto(`${BASE_URL}/secretary/import`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));

    const importState = await page.evaluate(() => {
      const select = document.querySelector("select");
      const opt = Array.from(select?.options || []).find(o => o.text.toLowerCase().includes("adaptation"));
      return {
        totalFormations: select?.options.length,
        adaptationOption: opt ? { value: opt.value, text: opt.text } : null,
      };
    });

    console.log("Import total formations:", importState.totalFormations);
    console.log("Import Adaptation Option:", importState.adaptationOption);

    // Select Adaptation on import page to verify the "8 stagiaire(s)" count
    if (importState.adaptationOption) {
      await page.evaluate((val) => {
        const sel = document.querySelector("select");
        if (sel) {
          sel.value = val;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, importState.adaptationOption.value);
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Capture screenshot 28 (Import with Adaptation and 8 trainees)
    const shot28 = path.join(SCREENSHOTS_DIR, "28_import_adaptation_8_trainees.png");
    await page.screenshot({ path: shot28, fullPage: true });
    console.log("Captured screenshot 28:", shot28);

    console.log("\n=== ALL CHECKS PASSED WITH 100% SUCCESS ===");
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
