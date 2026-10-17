import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

const benchmarkDir = path.resolve(here, "..");
const TYPES: Record<string, string> = {
  ".json": "application/json",
  ".png": "image/png",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml",
};

export default defineConfig({
  root: "demo",
  base: "./",
  // The router demo imports the shared scene from ../shared.
  server: { fs: { allow: [benchmarkDir] } },
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(here, "demo/index.html"),
        router: path.resolve(here, "demo/router.html"),
      },
    },
  },
  plugins: [
    {
      // In dev, serve the shared benchmark/config, media and vector files.
      // In production the harness server serves benchmark/ so the same URLs work.
      name: "shared-files",
      configureServer(server) {
        for (const dir of ["config", "media", "vector"]) {
          server.middlewares.use(`/${dir}`, (req, res, next) => {
            const file = path.join(benchmarkDir, dir, path.basename(req.url ?? ""));
            if (!fs.existsSync(file)) return next();
            res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
            res.end(fs.readFileSync(file));
          });
        }
      },
    },
  ],
});
