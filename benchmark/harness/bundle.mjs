// Production bundle size (gzip -9) and runtime dependencies per tool.
//   node bundle.mjs [results/raw.json]  ->  results/bundle.json
// "Loaded" counts only files the page actually requested during a benchmark
// run (from raw.json); "dist" counts every file in the build output.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execSync } from "node:child_process";
import { TOOLS } from "./tools.mjs";

const raw = fs.existsSync(process.argv[2] ?? "results/raw.json")
  ? JSON.parse(fs.readFileSync(process.argv[2] ?? "results/raw.json", "utf8"))
  : [];
const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );

const out = {};
for (const [tool, t] of Object.entries(TOOLS)) {
  const dist = path.resolve(t.dist);
  const files = walk(dist).map((f) => {
    const buf = fs.readFileSync(f);
    return { file: path.relative(dist, f), bytes: buf.length, gzip: gz(buf) };
  });
  const run = raw.find((r) => r.tool === tool && r.requests);
  const loadedPaths = new Set(
    (run?.requests ?? [])
      .filter((r) => !r.external && r.url.includes(t.path))
      .map((r) => decodeURIComponent(new URL(r.url).pathname.slice(t.path.length)) || "index.html"),
  );
  const loaded = files.filter((f) => loadedPaths.has(f.file));
  const sum = (arr, k) => arr.reduce((a, f) => a + f[k], 0);

  const projectDir = path.resolve(t.dist, "..");
  const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
  let prodTreeCount = null;
  try {
    prodTreeCount = execSync("npm ls --omit=dev --all --parseable", { cwd: projectDir, encoding: "utf8" })
      .trim()
      .split("\n").length - 1;
  } catch (e) {
    prodTreeCount = (e.stdout ?? "").trim().split("\n").length - 1;
  }
  out[tool] = {
    distBytes: sum(files, "bytes"),
    distGzip: sum(files, "gzip"),
    loadedBytes: sum(loaded, "bytes"),
    loadedGzip: sum(loaded, "gzip"),
    loadedFiles: loaded,
    externalRequests: (run?.requests ?? []).filter((r) => r.external).map((r) => r.url),
    dependencies: pkg.dependencies ?? {},
    prodPackagesInstalled: prodTreeCount,
  };
}
fs.mkdirSync("results", { recursive: true });
fs.writeFileSync("results/bundle.json", JSON.stringify(out, null, 1));
for (const [tool, b] of Object.entries(out)) {
  console.log(
    `${tool.padEnd(12)} loaded ${(b.loadedGzip / 1024).toFixed(1)} KB gz (${(b.loadedBytes / 1024).toFixed(0)} KB raw), ` +
      `dist ${(b.distGzip / 1024).toFixed(1)} KB gz, deps: ${Object.keys(b.dependencies).join(", ")}, ` +
      `prod packages: ${b.prodPackagesInstalled}`,
  );
}
