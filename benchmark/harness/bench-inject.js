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
    animTime: 0, // composition seconds advanced (loop wraps unrolled)
    lastT: null,
    // t = current composition time in seconds (0..8), if the demo knows it.
    frame(t) {
      b.frames++;
      if (typeof t === "number") {
        if (b.lastT !== null) {
          let d = t - b.lastT;
          if (d < -1) d += 8; // wrapped around the 8 s loop
          if (d > 0) b.animTime += d;
        }
        b.lastT = t;
      }
      if (b.firstRenderAt === null) {
        b.firstRenderAt = performance.now();
        requestAnimationFrame(() => (b.firstFrameAt = performance.now()));
      }
    },
    start() {
      b.raf = [];
      b.framesAtStart = b.frames;
      b.animAtStart = b.animTime;
      b.recording = true;
    },
    stop() {
      b.recording = false;
      return { raf: b.raf, frames: b.frames - b.framesAtStart, animSeconds: b.animTime - b.animAtStart };
    },
  });
  const loop = (ts) => {
    if (b.recording) b.raf.push(ts);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
