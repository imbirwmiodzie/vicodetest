import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const configFile = path.resolve(__dirname, "../config/config.json");

export default defineConfig({
  root: "demo",
  base: "./",
  build: { outDir: "../dist-demo", emptyOutDir: true },
  plugins: [
    {
      // In dev, serve the shared benchmark/config/config.json at /config/config.json.
      // In production the harness server serves benchmark/ so the same URL works.
      name: "shared-config",
      configureServer(server) {
        server.middlewares.use("/config/config.json", (_req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.end(fs.readFileSync(configFile));
        });
      },
    },
  ],
});
