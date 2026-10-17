// Benchmark runner: measures each demo's production build in headless Chromium.
//
//   node run.mjs [--runs 3] [--throttle 1,4,6] [--tools remotion,hyperframes,revideo]
//                [--measure 30] [--warmup 5] [--out results/raw.json]
//
// Every run uses a fresh browser. Results are appended to the output file as
// one JSON object per (tool, throttle, run); summarize.mjs turns them into tables.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { startServer } from "./serve.mjs";
import { TOOLS, launchArgs, CHROME } from "./tools.mjs";
import { decodePng } from "./png.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const RUNS = Number(args.runs ?? 3);
const THROTTLES = (args.throttle ?? "1,4,6").split(",").map(Number);
const TOOL_NAMES = (args.tools ?? "remotion,hyperframes,revideo").split(",");
const MEASURE_S = Number(args.measure ?? 30);
const WARMUP_S = Number(args.warmup ?? 5);
const MEMORY_AT_S = 60;
const LATENCY_SAMPLES = Number(args.latency ?? 10);
const OUT = args.out ?? "results/raw.json";
const PORT = 8090;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const dbg = (...a) => process.env.DEBUG && console.error(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
const CLK_TCK = 100; // Linux USER_HZ

// ---- /proc helpers: CPU time and memory of the whole Chromium process tree ----
function descendants(rootPid) {
  const children = new Map();
  for (const d of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${d}/stat`, "utf8");
      const ppid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
      if (!children.has(ppid)) children.set(ppid, []);
      children.get(ppid).push(Number(d));
    } catch {}
  }
  const out = [];
  const walk = (pid) => {
    out.push(pid);
    for (const c of children.get(pid) ?? []) walk(c);
  };
  walk(rootPid);
  return out;
}
function procType(pid) {
  try {
    const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
    const m = cmd.match(/--type=([a-z-]+)/);
    if (!m) return cmd.includes("chrome") ? "browser" : "other";
    if (m[1] === "utility" && cmd.includes("NetworkService")) return "network";
    return m[1];
  } catch {
    return "gone";
  }
}
function cpuTicks(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const f = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return Number(f[11]) + Number(f[12]); // utime + stime
  } catch {
    return 0;
  }
}
function pssKb(pid) {
  try {
    const m = fs.readFileSync(`/proc/${pid}/smaps_rollup`, "utf8").match(/^Pss:\s+(\d+)/m);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}
function cpuSnapshot(rootPid) {
  const byType = {};
  for (const pid of descendants(rootPid)) {
    const t = procType(pid);
    byType[t] = (byType[t] ?? 0) + cpuTicks(pid);
  }
  return byType;
}
function memorySnapshot(rootPid) {
  const byType = {};
  let total = 0;
  for (const pid of descendants(rootPid)) {
    const kb = pssKb(pid);
    const t = procType(pid);
    byType[t] = (byType[t] ?? 0) + kb;
    total += kb;
  }
  return { totalPssMB: total / 1024, byTypeMB: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v / 1024])) };
}

// ---- stats ----
const percentile = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
};
const median = (arr) => percentile(arr, 50);

// ---- one measured run ----
async function measure(tool, throttle, run) {
  // launchServer exposes the browser process, so its process tree can be read from /proc.
  const server = await chromium.launchServer({ executablePath: CHROME, args: launchArgs });
  const rootPid = server.process().pid;
  const browser = await chromium.connect(server.wsEndpoint());
  try {
    return await measureIn(browser, rootPid, tool, throttle, run);
  } finally {
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

async function measureIn(browser, rootPid, tool, throttle, run) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable", { timeDomain: "timeTicks" });
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });

  const requests = [];
  const errors = [];
  page.on("response", async (res) => {
    const url = res.url();
    let bytes = 0;
    try {
      bytes = (await res.body()).length;
    } catch {}
    requests.push({ url, status: res.status(), bytes, external: !url.startsWith(`http://localhost:${PORT}`) });
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript({ path: path.resolve("bench-inject.js") });

  dbg("goto");
  const loadStart = Date.now();
  await page.goto(`http://localhost:${PORT}${TOOLS[tool].path}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__bench?.firstFrameAt != null, null, { timeout: 60000 });
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return {
      firstFrameMs: window.__bench.firstFrameAt,
      firstRenderMs: window.__bench.firstRenderAt,
      domContentLoadedMs: nav?.domContentLoadedEventEnd,
      loadMs: nav?.loadEventEnd,
      fcpMs: fcp?.startTime ?? null,
    };
  });

  dbg("first frame ok");
  await sleep(WARMUP_S * 1000);

  // Measurement window
  const metric = async () =>
    Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  dbg("measure start");
  const m0 = await metric();
  const c0 = cpuSnapshot(rootPid);
  const w0 = performance.now();
  await page.evaluate(() => window.__bench.start());
  await sleep(MEASURE_S * 1000);
  const rec = await page.evaluate(() => window.__bench.stop());
  const w1 = performance.now();
  const m1 = await metric();
  const c1 = cpuSnapshot(rootPid);
  const wallS = (w1 - w0) / 1000;

  const raf = rec.raf;
  const deltas = raf.slice(1).map((t, i) => t - raf[i]);
  const spanS = (raf.at(-1) - raf[0]) / 1000;
  const cpuPct = {};
  for (const k of new Set([...Object.keys(c0), ...Object.keys(c1)])) {
    cpuPct[k] = (((c1[k] ?? 0) - (c0[k] ?? 0)) / CLK_TCK / wallS) * 100;
  }
  const cpuTotalPct = Object.values(cpuPct).reduce((a, b) => a + b, 0);

  dbg("measure done");
  // Memory 60 s after load
  const waitMem = MEMORY_AT_S * 1000 - (Date.now() - loadStart);
  if (waitMem > 0) await sleep(waitMem);
  const jsHeap = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  await cdp.send("HeapProfiler.enable");
  await cdp.send("HeapProfiler.collectGarbage");
  const heapAfterGc = (await cdp.send("Runtime.getHeapUsage")).usedSize;
  const mem = memorySnapshot(rootPid);

  dbg("memory done");
  // Config update latency (screencast-based)
  const latency = await measureLatency(page, cdp);

  return {
    tool,
    throttle,
    run,
    timestamp: new Date().toISOString(),
    timing,
    fps: {
      avg: (raf.length - 1) / spanS,
      p5: 1000 / percentile(deltas, 95),
      longFrames50ms: deltas.filter((d) => d > 50).length,
      frameTimeP50ms: median(deltas),
      frameTimeP95ms: percentile(deltas, 95),
      frameTimeMaxMs: Math.max(...deltas),
    },
    animation: {
      updatesPerSec: rec.frames / wallS,
      playbackRate: rec.animSeconds / wallS, // 1.0 = real time at speed 1
    },
    cpu: {
      mainThreadBusyPct: ((m1.TaskDuration - m0.TaskDuration) / wallS) * 100,
      scriptPct: ((m1.ScriptDuration - m0.ScriptDuration) / wallS) * 100,
      layoutPct: ((m1.LayoutDuration - m0.LayoutDuration) / wallS) * 100,
      styleRecalcPct: ((m1.RecalcStyleDuration - m0.RecalcStyleDuration) / wallS) * 100,
      processPctOfOneCore: cpuPct,
      processTotalPctOfOneCore: cpuTotalPct,
    },
    memory: {
      usedJSHeapMB: jsHeap / 2 ** 20,
      jsHeapAfterGcMB: heapAfterGc / 2 ** 20,
      ...mem,
    },
    latency,
    requests,
    errors,
  };
}

// Change the accent colour while the bars are fully grown (hold phase) and time
// how long until a screencast frame shows the new colour inside bar 3.
async function measureLatency(page, cdp) {
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ ts: f.metadata.timestamp * 1000, data: f.data });
    try {
      await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId });
    } catch {}
  });
  await cdp.send("Page.startScreencast", { format: "png", maxWidth: 640, maxHeight: 360, everyNthFrame: 1 });
  // Bar 3 (80 %) spans x 884..940 and y 324..580 during the hold; sample its middle.
  const PX = { x: 912 / 2, y: 500 / 2 };
  const COLORS = [
    { hex: "#FF0000", rgb: [255, 0, 0] },
    { hex: "#00FF00", rgb: [0, 255, 0] },
  ];
  const samples = [];
  for (let i = 0; i < LATENCY_SAMPLES; i++) {
    // wait for the hold phase (composition time 3.0..5.5 s)
    const okPhase = await page
      .waitForFunction(() => {
        const t = window.__bench.lastT;
        return t != null && t > 3.0 && t < 5.5;
      }, null, { timeout: 30000, polling: 20 })
      .then(() => true, () => false);
    dbg('latency sample', i, okPhase);
    if (!okPhase) break;
    const color = COLORS[i % 2];
    frames.length = 0;
    const t0 = await page.evaluate((hex) => {
      const cfg = {
        title: "System status",
        value: 78,
        unit: "%",
        accentColor: hex,
        bars: [30, 55, 80, 45, 65],
        speed: 1,
        loop: true,
      };
      const t = performance.timeOrigin + performance.now();
      window.__benchApply(cfg);
      return t;
    }, color.hex);
    await sleep(1000);
    let hit = null;
    for (const f of [...frames].sort((a, b) => a.ts - b.ts)) {
      if (f.ts < t0) continue;
      const img = decodePng(Buffer.from(f.data, "base64"));
      const o = (Math.round(PX.y) * img.width + Math.round(PX.x)) * 4;
      const px = [img.pixels[o], img.pixels[o + 1], img.pixels[o + 2]];
      if (px.every((v, k) => Math.abs(v - color.rgb[k]) < 40)) {
        hit = f.ts - t0;
        break;
      }
    }
    samples.push(hit);
    await sleep(200);
  }
  await cdp.send("Page.stopScreencast");
  const ok = samples.filter((s) => s != null);
  return { samplesMs: samples, medianMs: median(ok), missed: samples.length - ok.length };
}

// ---- main ----
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const server = await startServer(PORT);
const results = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
for (let run = 1; run <= RUNS; run++) {
  for (const throttle of THROTTLES) {
    // rotate tool order per run to spread machine noise
    const order = TOOL_NAMES.map((_, i) => TOOL_NAMES[(i + run - 1) % TOOL_NAMES.length]);
    for (const tool of order) {
      const label = `run ${run}/${RUNS} throttle ${throttle}x ${tool}`;
      process.stdout.write(`${label} ... `);
      try {
        const r = await measure(tool, throttle, run);
        results.push(r);
        fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
        console.log(
          `fps ${r.fps.avg.toFixed(1)} (p5 ${r.fps.p5.toFixed(1)}), main ${r.cpu.mainThreadBusyPct.toFixed(0)}%, ` +
            `cpu ${r.cpu.processTotalPctOfOneCore.toFixed(0)}%, rate ${r.animation.playbackRate.toFixed(2)}, ` +
            `ttff ${r.timing.firstFrameMs.toFixed(0)}ms, lat ${r.latency.medianMs?.toFixed(0)}ms`,
        );
      } catch (e) {
        console.log(`FAILED: ${e.message}`);
        results.push({ tool, throttle, run, failed: e.message });
        fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
      }
    }
  }
}
server.close();
