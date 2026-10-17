// Functional check: live config edit + loop:false. Usage: node live-check.mjs <tool> <outDir>
import { chromium } from "playwright-core";
import { startServer } from "./serve.mjs";
import { TOOLS, launchArgs, CHROME } from "./tools.mjs";
const tool = process.argv[2]; const out = process.argv[3];
const server = await startServer(8092);
const browser = await chromium.launch({ executablePath: CHROME, args: launchArgs });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => console.log("console", m.text()));
await page.addInitScript({ path: "bench-inject.js" });
await page.goto(`http://localhost:8092${TOOLS[tool].path}`);
await page.waitForTimeout(3500);
await page.evaluate(() => window.__benchApply({ title: "Edited live", value: 42, unit: "°C", accentColor: "#FF5A36", bars: [90, 10, 50, 20, 100], speed: 1, loop: true }));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/live-a.png` });
// loop:false should stop at 6.6 s with everything visible
await page.evaluate(() => window.__benchApply({ title: "Play once", value: 64, unit: "%", accentColor: "#22C55E", bars: [30, 55, 80, 45, 65], speed: 2, loop: false }));
await page.waitForTimeout(6000);
const f1 = await page.evaluate(() => window.__bench.frames);
await page.waitForTimeout(1000);
const f2 = await page.evaluate(() => window.__bench.frames);
await page.screenshot({ path: `${out}/live-b.png` });
console.log("frames while stopped (should be ~0):", f2 - f1);
await browser.close(); server.close();
