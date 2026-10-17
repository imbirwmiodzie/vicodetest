// Copy GSAP and the HyperFrames runtime next to the composition, so the player
// never falls back to fetching the runtime from jsDelivr (offline device).
// The router composition also needs the shared scene modules.
import fs from "node:fs";
fs.mkdirSync("vendor", { recursive: true });
fs.copyFileSync("node_modules/gsap/dist/gsap.min.js", "vendor/gsap.min.js");
fs.copyFileSync(
  "node_modules/@hyperframes/core/dist/hyperframe.runtime.iife.js",
  "vendor/hyperframe.runtime.iife.js",
);
for (const f of ["router-scene.js", "router-dom.js"]) fs.copyFileSync(`../shared/${f}`, `vendor/${f}`);
