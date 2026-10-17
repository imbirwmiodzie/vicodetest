// Injected into every demo page before its own scripts (Playwright addInitScript).
// Demo pages call window.__bench?.frame?.() each time the player renders an
// animation frame; everything else here is passive measurement.
(() => {
  if (window !== window.top) return; // compositions in iframes report to the top window
  const b = (window.__bench = {
    frames: 0, // animation frames rendered by the player
    firstRenderAt: null, // performance.now() when the first animation frame was rendered
    firstFrameAt: null, // first rAF after that, i.e. after it was painted
    raf: [],
    recording: false,
    framesAtStart: 0,
    frame() {
      b.frames++;
      if (b.firstRenderAt === null) {
        b.firstRenderAt = performance.now();
        requestAnimationFrame(() => (b.firstFrameAt = performance.now()));
      }
    },
    start() {
      b.raf = [];
      b.framesAtStart = b.frames;
      b.recording = true;
    },
    stop() {
      b.recording = false;
      return { raf: b.raf, frames: b.frames - b.framesAtStart };
    },
  });
  const loop = (ts) => {
    if (b.recording) b.raf.push(ts);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
