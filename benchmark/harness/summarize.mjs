// Median-of-runs tables from results/raw.json -> results/summary.md (+ summary.json).
//   node summarize.mjs [results/raw.json]
import fs from "node:fs";

const file = process.argv[2] ?? "results/raw.json";
const raw = JSON.parse(fs.readFileSync(file, "utf8")).filter((r) => !r.failed);
const failed = JSON.parse(fs.readFileSync(file, "utf8")).filter((r) => r.failed);
const TOOLS = ["remotion", "hyperframes", "revideo"];
const THROTTLES = [...new Set(raw.map((r) => r.throttle))].sort((a, b) => a - b);

const median = (xs) => {
  const s = xs.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const range = (xs) => {
  const s = xs.filter((x) => x != null && Number.isFinite(x));
  return s.length ? [Math.min(...s), Math.max(...s)] : null;
};

const METRICS = [
  ["Avg FPS (rAF)", (r) => r.fps.avg, 1],
  ["5th-percentile FPS (rAF)", (r) => r.fps.p5, 1],
  ["Frames > 50 ms (per 30 s)", (r) => r.fps.longFrames50ms, 0],
  ["Animation updates / s", (r) => r.animation.updatesPerSec, 1],
  ["Playback rate (anim s / wall s, ideal 1.00)", (r) => r.animation.playbackRate, 2],
  ["Main-thread busy %", (r) => r.cpu.mainThreadBusyPct, 0],
  ["Script %", (r) => r.cpu.scriptPct, 0],
  ["Style + layout %", (r) => r.cpu.styleRecalcPct + r.cpu.layoutPct, 0],
  ["CPU, all Chromium processes (% of 1 core)", (r) => r.cpu.processTotalPctOfOneCore, 0],
  ["  renderer process", (r) => r.cpu.processPctOfOneCore.renderer, 0],
  ["  GPU process", (r) => r.cpu.processPctOfOneCore["gpu-process"], 0],
  ["JS heap used @60 s (MB)", (r) => r.memory.usedJSHeapMB, 1],
  ["JS heap after GC @60 s (MB)", (r) => r.memory.jsHeapAfterGcMB, 1],
  ["Total PSS, all processes @60 s (MB)", (r) => r.memory.totalPssMB, 0],
  ["  renderer PSS (MB)", (r) => r.memory.byTypeMB.renderer, 0],
  ["Time to first frame (ms)", (r) => r.timing.firstFrameMs, 0],
  ["Config update latency, median (ms)", (r) => r.latency.medianMs, 0],
];

const summary = {};
let md = `# Benchmark summary\n\nSource: \`${file}\`, ${raw.length} successful runs` +
  (failed.length ? `, ${failed.length} failed` : "") + `. Values are medians over runs; [min-max] across runs.\n`;
for (const th of THROTTLES) {
  md += `\n## CPU throttle ${th}x\n\n| Metric | ${TOOLS.join(" | ")} |\n|---|${TOOLS.map(() => "---:").join("|")}|\n`;
  summary[th] = {};
  for (const [name, get, dp] of METRICS) {
    const cells = TOOLS.map((tool) => {
      const rs = raw.filter((r) => r.tool === tool && r.throttle === th);
      const vals = rs.map((r) => {
        try {
          return get(r);
        } catch {
          return null;
        }
      });
      const m = median(vals);
      const rg = range(vals);
      (summary[th][tool] ??= {})[name.trim()] = { median: m, range: rg, n: vals.length };
      if (m == null) return "n/a";
      return rs.length > 1 && rg ? `${m.toFixed(dp)} [${rg[0].toFixed(dp)}-${rg[1].toFixed(dp)}]` : m.toFixed(dp);
    });
    md += `| ${name} | ${cells.join(" | ")} |\n`;
  }
  const missed = TOOLS.map((tool) =>
    raw.filter((r) => r.tool === tool && r.throttle === th).reduce((a, r) => a + (r.latency?.missed ?? 0), 0),
  );
  md += `| Latency samples not detected | ${missed.join(" | ")} |\n`;
}
const errs = raw.filter((r) => r.errors?.length).map((r) => `- ${r.tool} ${r.throttle}x run ${r.run}: ${[...new Set(r.errors)].join("; ")}`);
if (errs.length) md += `\n## Page errors\n\n${errs.join("\n")}\n`;
const ext = [...new Set(raw.flatMap((r) => (r.requests ?? []).filter((q) => q.external).map((q) => `${r.tool}: ${q.url}`)))];
md += `\n## External requests during runs\n\n${ext.length ? ext.map((e) => `- ${e}`).join("\n") : "None."}\n`;
if (failed.length) md += `\n## Failed runs\n\n${failed.map((f) => `- ${f.tool} ${f.throttle}x run ${f.run}: ${f.failed}`).join("\n")}\n`;

fs.writeFileSync(file.replace(/[^/]+$/, "summary.md"), md);
fs.writeFileSync(file.replace(/[^/]+$/, "summary.json"), JSON.stringify(summary, null, 1));
console.log(md);
