# PLAN: configurable "status card" animation, 3-tool benchmark

Status: **approved** (defaults: 30 fps, `loop:false` stops at 6.6 s, no device). Clarifications added during the build are marked *(build note)*.

The animation is the default "status card" from the handover, since no custom animation was given.
All three versions (Remotion, HyperFrames, Revideo) follow this spec. Where a tool can't match it
exactly, the deviation goes into RESULTS.md.

---

## 1. Canvas and global settings

| Setting | Value |
|---|---|
| Resolution | 1280 x 720, device pixel ratio 1 |
| Composition frame rate | 30 fps (an embedded-friendly target; the timeline is defined in seconds, so 60 fps works too) |
| Loop length | 8.0 s at `speed = 1.0`, so 240 frames at 30 fps |
| Audio | None. No audio elements, assets or dependencies in any version. |
| Fonts | Generic system `sans-serif` only. No web fonts and no network fetches, so the page works offline like a device would. |
| Assets | None. Everything is drawn from shapes and text. |

## 2. Layout (in 1280x720 coordinates)

```
+--------------------------------------------------------------------------+  background #0E1116
|   +------------------------------------------------------------------+   |
|   |  System status                       (title, x=120, baseline~150)|   |  card: x=80 y=80
|   |                                                                  |   |  1120 x 560, radius 24
|   |        .-~~~~-.                       _                          |   |  fill #171B22
|   |      /          \              _     | |    _                    |   |
|   |     |    78%     |            | |  _ | |   | |                   |   |
|   |      \          /         _   | | | || |   | |                   |   |
|   |        `-____-´          | |  | | | || |   | |                   |   |
|   |   ring centre (380,410)  bars: baseline y=580, x from 700        |   |
|   +------------------------------------------------------------------+   |
+--------------------------------------------------------------------------+
```

| Element | Spec |
|---|---|
| Background | Solid `#0E1116`, full frame, always visible |
| Card | Rect x=80, y=80, 1120x560, corner radius 24, fill `#171B22`, **always visible** (so the loop seam is invisible) |
| Title | `config.title`, 52 px, weight 600, color `#E6EAF2`, left-aligned at x=120, top y=110 |
| Ring track | Circle centre (380, 410), radius 150, stroke 26, color `#2A2F3A`, full circle |
| Ring fill | Same circle, stroke 26, color `accentColor`, round caps, starts at 12 o'clock, clockwise, arc = `progress x clamp(value,0,100)/100 x 360deg` |
| Ring end dot | Circle of radius 9, fill `#FFFFFF`, sits at the leading end of the ring fill (only during hold, see timeline) |
| Number | Centred in the ring. Integer part of the count-up, 104 px, weight 700, `#FFFFFF`. Unit `config.unit` right after it, 44 px, weight 600, `accentColor`. |
| Bars | 5 bars, width 56, gap 36, left edge of first bar at x=700, baseline y=580, max height 320. Bar i height = `clamp(bars[i],0,100)/100 x 320`. Fill `accentColor`, top corners radius 8. Behind each bar a full-height track, `#232833`. |
| Bar labels | none (kept minimal so text rendering doesn't dominate) |

## 3. Timeline (seconds at `speed = 1.0`)

The loop starts and ends on the **same frame**: an empty card, no title, ring or bars. That makes the
loop seamless.

| Time (s) | Element | Animation | Easing |
|---|---|---|---|
| 0.00 - 0.30 | – | empty card (rest) | – |
| 0.30 - 1.10 | Title | opacity 0 to 1, translateY +40 px to 0 | easeOutCubic |
| 0.60 - 1.00 | Ring track + bar tracks + number/unit | opacity 0 to 1 *(build note: number and unit fade in with the tracks)* | linear |
| 0.80 - 2.80 | Ring fill | progress 0 to 1 (arc 0 to value%) | easeInOutCubic |
| 0.80 - 2.80 | Number | counts 0 to `value`, same curve as the ring; shown as `Math.round` | easeInOutCubic |
| 1.20 - 2.70 | Bars | each bar's height goes 0 to target over 0.90 s; bar i starts at 1.20 + i x 0.15 s | easeOutCubic |
| 2.80 - 6.60 | Hold | everything static except the **ring end dot**, which fades in over 0.2 s *(build note)* and pulses radius 9 to 13 to 9, two full cycles (period 1.9 s) | sine |
| 6.60 - 7.60 | Title, ring, number, bars, tracks | opacity 1 to 0; title also translateY 0 to -20 px. Values stay at target while fading. | easeInCubic |
| 7.60 - 8.00 | – | empty card (rest), identical to t=0 | – |

Easing formulas (so all three tools use exactly the same curves rather than "similar-looking" presets):
- `easeOutCubic(t) = 1 - (1-t)^3`
- `easeInCubic(t) = t^3`
- `easeInOutCubic(t) = t < .5 ? 4t^3 : 1 - (-2t+2)^3 / 2`
- pulse: `9 + 4 x (0.5 - 0.5 cos(2pi x (t-2.80)/1.9))`

Note: GSAP (likely used by HyperFrames) names cubic `power2`, so `power2.out` = easeOutCubic. I'll
check this against the code rather than rely on the preset names.

The ring end dot pulse keeps a little continuous motion during the hold. Without it, half the loop
would be static frames, which would flatter tools that skip unchanged frames.

## 4. Config contract (`config/config.json`)

| Field | Effect | Validation |
|---|---|---|
| `title` | title text | string; truncated visually if too long (no wrapping) |
| `value` | count-up target and ring % | number; ring uses clamp 0..100; number shows the real value, rounded |
| `unit` | label after the number | string |
| `accentColor` | ring fill, bars, unit text | any CSS color string; invalid falls back to `#3D8BFF` |
| `bars` | 5 bar heights in % | array of numbers; missing entries count as 0, extras are ignored, each clamped 0..100 |
| `speed` | playback speed multiplier | clamp 0.1..4. Loop period = 8 s / speed. |
| `loop` | loop or play once | `false` means play once and stop at t = 6.60 s (end of hold, everything visible), not on the empty last frame |

Runtime rules (the key requirement):
- Each demo page **fetches** `/config/config.json` at runtime. It is never `import`ed into the bundle,
  so editing the file and reloading the page works on a production build with no rebuild.
- Each demo page has a live editor: a JSON textarea plus quick controls (title text box, value slider,
  colour picker, 5 bar sliders, speed slider, loop checkbox). Edits apply immediately (invalid JSON is
  shown as an error and ignored).
- On a config change the animation should update **without restarting**, keeping the playhead where
  it is. If a tool can only apply changes by remounting or restarting, I'll record that as a finding.
- Each page exposes the same small hook for the harness:
  `window.__bench = { applyConfig(cfg), onFirstFrame, ready }`.

## 5. Per-tool implementation notes (to confirm against current docs)

Current npm versions (checked 2026-10-17): `@remotion/player` 4.0.536, `hyperframes` /
`@hyperframes/player` 0.8.169, `@revideo/*` 0.11.0 (last published 2026-07-10).

| Tool | Expected approach | Config mapping |
|---|---|---|
| Remotion | `<Composition>` component using `useCurrentFrame()` + `interpolate()`; demo page = Vite/React app with `<Player>` | config passed as `inputProps`; speed via `playbackRate` (or `durationInFrames`) |
| HyperFrames | HTML/CSS composition with its timeline (GSAP-based, to verify); demo page with `<hyperframes-player>` | to work out from the docs: variables or attributes, postMessage, or regenerating the timeline |
| Revideo | `makeScene2D` generator scene with signals; demo page with `@revideo/player-react` | player `variables` prop read through `useScene().variables`; speed via player playback rate |

Things to tell you before installing (from the package manifests, nothing installed yet):
- **Revideo**: `@revideo/cli` pulls in `@revideo/renderer`, and that pulls in `puppeteer` (downloads a
  Chrome build on `npm install` unless skipped) and `@ffmpeg-installer` / `@ffprobe-installer`
  (download FFmpeg binaries). These are only for rendering MP4s. I plan to install them with
  `PUPPETEER_SKIP_DOWNLOAD=1` and, if possible, keep the demo/player package free of renderer deps.
  If the scaffold won't work without them, I'll ask first.
- **HyperFrames**: the `hyperframes` CLI depends on `sharp` (prebuilt native binary), `puppeteer-core`
  and `@puppeteer/browsers` (can fetch Chrome when needed for rendering). I'll avoid any render or
  browser-download step and use the Chromium that's already installed if preview needs one.
- **Remotion**: `create-video` scaffolds normally. The renderer only downloads
  `chrome-headless-shell` when you render, and we won't render.
- The environment already has Node 22.22, npm 10.9, Playwright's Chromium 1194 and FFmpeg. No system
  packages or global installs should be needed.

## 6. Measurement harness

Layout: `harness/serve.mjs` is a tiny static server built on Node's `http` module (no deps). It serves
`benchmark/` so every demo can fetch `/config/config.json`. `harness/run.mjs` uses `playwright-core`
plus the Chromium already installed. `harness/bench-inject.js` is injected identically into every page.

All runs use **production builds**, a 1280x720 viewport, DPR 1, and the same browser binary and flags.

| Metric | Method |
|---|---|
| Avg FPS, 5th-percentile FPS | rAF timestamps over 30 s after a 5 s warm-up. Avg = frames / time. p5 FPS = 1000 / p95 frame time. Also count long frames (>50 ms). |
| Animation updates/s | how often the player updated the animation (per-frame hook in each demo), since rAF can run at 60 while the player draws at 30 or less |
| Playback rate *(build note)* | composition seconds advanced per wall-clock second (ideal 1.00). Added because Revideo advances a fixed number of frames per tick, so a slow CPU makes it play slower instead of dropping frames. |
| CPU load | (a) CDP `Performance.getMetrics` TaskDuration delta / wall time = main-thread busy %; (b) CPU time from `/proc/<pid>/stat` summed over all Chromium processes (renderer + GPU + browser) / wall time, as % of one core |
| Memory | after 60 s: `performance.memory.usedJSHeapSize` (with `--enable-precise-memory-info`), JS heap after forced GC through CDP, and total RSS of all Chromium processes from `/proc` |
| Time to first frame | `performance.now()` (relative to navigation start) at the first rAF after the player signals that its first frame has rendered. Each tool's event is named in RESULTS.md. |
| Bundle size (gzipped) | sum of `gzip -9` sizes of every JS/CSS/HTML file the demo page actually loads (taken from Playwright's network log, so lazy chunks count only if they're loaded) |
| Runtime dependencies | `dependencies` of each demo's package.json + resolved tree size; note whether React is required |
| Config update latency | the harness calls `__bench.applyConfig()` with a new `accentColor` and records the time; a CDP screencast detects the first painted frame where the accent pixels change. Median of 10 changes. Resolution is limited by the screencast frame interval (~16-33 ms), and RESULTS.md will say so. |

Conditions: no throttle, 4x and 6x CPU throttling (`Emulation.setCPUThrottlingRate`). 3 runs each,
median reported. Tools run in rotated order to spread out VM noise.

## 7. Honest caveats, known up front

- **This runs in a cloud container, not on your laptop or the device.** It has 4 vCPUs, 15 GiB RAM,
  **no GPU** (Chromium falls back to software rendering), headless Chromium, and noisy shared
  hardware. Absolute numbers will not carry over to the device. The comparison between tools on the
  same box is what counts, and small gaps will be called "not significant".
- DevTools CPU throttling slows the page's main thread only. It does not model a slow GPU or
  compositor, slow storage or low RAM, so it's a rough proxy for an embedded SoC.
- I can't "close other apps" on a shared VM. The 3 runs plus median handle the noise partly.
- Long-run stability (hours), memory leaks and real-device numbers are out of scope unless you
  provide the device.
- "Prompts needed" will be logged as build/fix iterations, since I'm working autonomously after your
  approval. Effort cap: about 8 fix attempts per tool, then I record the blocker and move on.

## 8. Deliverables

```
benchmark/
  PLAN.md               (this file)
  config/config.json    (shared, done)
  remotion/             (own project + demo page)
  hyperframes/          (own project + demo page)
  revideo/              (own project + demo page)
  harness/              (serve.mjs, run.mjs, bench-inject.js, raw results JSON)
  RESULTS.md
```

## 9. Questions for you (defaults apply if you just say "approved")

1. Frame rate: **30 fps** (default) or 60 fps?
2. `loop: false` behaviour: stop on the fully visible frame at 6.6 s (default)?
3. Do you have the real device, or a similar SBC (e.g. a Raspberry Pi), I could run the harness on
   later? If not, the 4x/6x throttled numbers are the proxy.
