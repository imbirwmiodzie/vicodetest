import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const benchmarkDir = path.resolve(__dirname, "..");
const TYPES: Record<string, string> = {
  ".json": "application/json",
  ".png": "image/png",
  ".jpeg": "image/jpeg",
};

export default defineConfig({
  root: "demo",
  base: "./",
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "demo/index.html"),
        router: path.resolve(__dirname, "demo/router.html"),
      },
    },
  },
  plugins: [
    {
      // In dev, serve the shared benchmark/config/*.json and benchmark/media/* files.
      // In production the harness server serves benchmark/ so the same URLs work.
      name: "shared-files",
      configureServer(server) {
        for (const dir of ["config", "media"]) {
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
