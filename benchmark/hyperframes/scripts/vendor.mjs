// Copy GSAP and the HyperFrames runtime next to the composition, so the player
// never falls back to fetching the runtime from jsDelivr (offline device).
import fs from "node:fs";
fs.mkdirSync("vendor", { recursive: true });
fs.copyFileSync("node_modules/gsap/dist/gsap.min.js", "vendor/gsap.min.js");
fs.copyFileSync(
  "node_modules/@hyperframes/core/dist/hyperframe.runtime.iife.js",
  "vendor/hyperframe.runtime.iife.js",
);
