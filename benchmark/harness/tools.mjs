export const CHROME = process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
export const launchArgs = [
  "--autoplay-policy=no-user-gesture-required",
  "--enable-precise-memory-info",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
];
// Production build of each demo, served from benchmark/ by serve.mjs.
export const TOOLS = {
  remotion: { path: "/remotion/dist-demo/", dist: "../remotion/dist-demo" },
  hyperframes: { path: "/hyperframes/dist-demo/", dist: "../hyperframes/dist-demo" },
  revideo: { path: "/revideo/dist-demo/", dist: "../revideo/dist-demo" },
};
