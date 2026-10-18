import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const benchmarkDir = path.resolve(here, "..");
// The compositions are project-root HTML files plus their vendored scripts.
const compositionFiles = [
  "index.html",
  "router.html",
  "conntrack.html",
  "kitchen.html",
  "cars.html",
  "vendor/gsap.min.js",
  "vendor/hyperframe.runtime.iife.js",
  "vendor/router-scene.js",
  "vendor/router-dom.js",
  "vendor/conntrack-scene.js",
  "vendor/analogy-scene.js",
];
const TYPES: Record<string, string> = { ".json": "application/json", ".png": "image/png", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" };

export default defineConfig({
  root: "demo",
  base: "./",
  // The demo pages import the shared scenes and editor from ../shared.
  server: { fs: { allow: [benchmarkDir] } },
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(here, "demo/index.html"),
        router: path.resolve(here, "demo/router.html"),
        conntrack: path.resolve(here, "demo/conntrack.html"),
        kitchen: path.resolve(here, "demo/kitchen.html"),
        cars: path.resolve(here, "demo/cars.html"),
      },
    },
  },
  plugins: [
    {
      name: "composition-and-config",
      configureServer(server) {
        // In dev, serve benchmark/config/*.json and benchmark/media/*; in production the
        // harness server serves benchmark/ so the same URLs work.
        for (const dir of ["config", "media", "vector"]) {
          server.middlewares.use(`/${dir}`, (req, res, next) => {
            const file = path.join(benchmarkDir, dir, path.basename((req.url ?? "").split("?")[0]));
            if (!fs.existsSync(file)) return next();
            res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
            res.end(fs.readFileSync(file));
          });
        }
        server.middlewares.use("/composition", (req, res, next) => {
          const rel = (req.url ?? "/").split("?")[0].replace(/^\/$/, "/index.html").slice(1);
          if (!compositionFiles.includes(rel)) return next();
          res.setHeader("Content-Type", rel.endsWith(".html") ? "text/html" : "text/javascript");
          res.end(fs.readFileSync(path.join(here, rel)));
        });
      },
      closeBundle() {
        for (const f of compositionFiles) {
          const dest = path.join(here, "dist-demo/composition", f);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(path.join(here, f), dest);
        }
      },
    },
  ],
});
