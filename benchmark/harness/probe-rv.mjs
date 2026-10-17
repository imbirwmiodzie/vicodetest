import { chromium } from "playwright-core";
import { startServer } from "./serve.mjs";
import { launchArgs, CHROME } from "./tools.mjs";
const tool = process.argv[2] ?? "revideo";
const server = await startServer(8094);
const browser = await chromium.launch({ executablePath: CHROME, args: launchArgs });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript({ path: "bench-inject.js" });
await page.goto(`http://localhost:8094/${tool}/dist-demo/`);
await page.waitForTimeout(3500);
const r = await page.evaluate(async () => {
  const log = [];
  const t0 = performance.now();
  const sample = () => log.push([Math.round(performance.now() - t0), window.__bench.lastT?.toFixed(2)]);
  sample();
  window.__benchApply({ title: "Edited live", value: 42, unit: "C", accentColor: "#FF5A36", bars: [90, 10, 50, 20, 100], speed: 1, loop: true });
  for (let i = 0; i < 12; i++) { await new Promise((r) => setTimeout(r, 50)); sample(); }
  return log;
});
console.log(JSON.stringify(r));
await browser.close(); server.close();
