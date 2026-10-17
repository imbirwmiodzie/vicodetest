// Visual smoke test: screenshots of a demo page at fixed wall-clock times.
// Usage: node shots.mjs <tool> [outDir]
import { chromium } from "playwright-core";
import fs from "node:fs";
import { startServer } from "./serve.mjs";
import { TOOLS, launchArgs, CHROME } from "./tools.mjs";

const tool = process.argv[2];
const out = process.argv[3] ?? `shots/${tool}`;
fs.mkdirSync(out, { recursive: true });
const server = await startServer(8091);
const browser = await chromium.launch({ executablePath: CHROME, args: launchArgs });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("request", (r) => { if (!r.url().startsWith("http://localhost")) logs.push(`[external request] ${r.url()}`); });
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript({ path: "bench-inject.js" });
await page.goto(`http://localhost:8091${TOOLS[tool].path}`);
const t0 = Date.now();
for (const t of [0.6, 1.6, 2.4, 4.0, 7.2, 8.6]) {
  await page.waitForTimeout(Math.max(0, t * 1000 - (Date.now() - t0)));
  await page.screenshot({ path: `${out}/t${t.toFixed(1)}.png` });
}
console.log(await page.evaluate(() => JSON.stringify({ frames: window.__bench.frames, firstFrameAt: window.__bench.firstFrameAt })));
console.log(logs.join("\n"));
await browser.close();
server.close();
