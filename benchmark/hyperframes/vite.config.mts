import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const here = path.dirname(new URL(import.meta.url).pathname);
const configFile = path.resolve(here, "../config/config.json");
// The composition is the project-root index.html plus its vendored scripts.
const compositionFiles = ["index.html", "vendor/gsap.min.js", "vendor/hyperframe.runtime.iife.js"];

export default defineConfig({
  root: "demo",
  base: "./",
  build: { outDir: "../dist-demo", emptyOutDir: true },
  plugins: [
    {
      name: "composition-and-config",
      configureServer(server) {
        server.middlewares.use("/config/config.json", (_req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.end(fs.readFileSync(configFile));
        });
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
