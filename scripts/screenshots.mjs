// One-shot screenshot script for README assets
// Run with: node scripts/screenshots.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE_URL = "http://localhost:3000";
const OUT_DIR = "docs/screenshots";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 900 },
    deviceScaleFactor: 2,
    isMobile: false,
  });
  const page = await ctx.newPage();

  // 01 — input mode (default)
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/01-input.png` });
  console.log("captured 01-input.png");

  // Locate the top mode tabs and click deck
  // The tabs render text "input / deck / proof"
  const deckTab = page.getByRole("button", { name: /deck/i }).first();
  if (await deckTab.count()) {
    await deckTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/02-deck.png` });
    console.log("captured 02-deck.png");
  } else {
    console.warn("deck tab not found by role; trying text fallback");
    await page.getByText(/^deck$/i).first().click({ trial: true }).catch(() => {});
    await page.screenshot({ path: `${OUT_DIR}/02-deck.png` });
  }

  const proofTab = page.getByRole("button", { name: /proof/i }).first();
  if (await proofTab.count()) {
    await proofTab.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT_DIR}/03-proof.png` });
    console.log("captured 03-proof.png");
  } else {
    await page.getByText(/^proof$/i).first().click({ trial: true }).catch(() => {});
    await page.screenshot({ path: `${OUT_DIR}/03-proof.png` });
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
