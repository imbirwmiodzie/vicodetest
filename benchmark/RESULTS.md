# RESULTS: configurable status card in Remotion, HyperFrames and Revideo

One 8-second, silent, config-driven "status card" animation (spec in [PLAN.md](PLAN.md)), built once per
tool and measured as a live browser player. Raw notes are in [DEVLOG.md](DEVLOG.md). Raw data:
[harness/results/benchmark-raw.json](harness/results/benchmark-raw.json); generated tables:
[harness/results/summary.md](harness/results/summary.md).

## Short version

- **All three work.** Each one plays the spec and updates live from the config without reloading or losing
  the playhead. Remotion and HyperFrames got there with no fixes to the animation itself. Revideo needed
  7 fix iterations, all found by reading its source.
- **Under 6x CPU throttling, only Revideo breaks down.** It drops to about 45 FPS and the animation
  plays 9% slower than real time, because it steps frames instead of skipping them. Remotion and
  HyperFrames hold 60 FPS and real time.
- **Remotion is the lightest:** 27% main-thread busy at 6x, against 43% for HyperFrames and 90% for
  Revideo. It also has the smallest bundle and the fastest config updates. The gap to HyperFrames is real,
  but both have plenty of headroom on this machine.
- **Recommendation:** for an embedded, config-driven player, take **HyperFrames** if license cost and
  React-free runtime matter. If performance headroom is what decides it and the Remotion Company License
  is acceptable, take **Remotion**. Don't use Revideo for this. Next step: run the harness on the real device.

## Test setup

| Item | Value |
|---|---|
| Machine | Cloud container, Intel Xeon @ 2.10 GHz, 4 vCPU, 15 GiB RAM, **no GPU** (Chromium uses software rendering), Linux 6.18 |
| Browser | Chromium 141.0.7390.37 (Playwright build), headless, driven by `playwright-core` 1.56.1 |
| Flags | `--autoplay-policy=no-user-gesture-required --enable-precise-memory-info --disable-background-timer-throttling --disable-renderer-backgrounding` |
| Viewport | 1280x720, device pixel ratio 1, player at native 1280x720 |
| Builds | Production builds (Vite 8), served from localhost by a no-dependency Node static server (no gzip on the wire) |
| Config | Identical `config/config.json` for all three (78 %, 5 bars, accent #3D8BFF, speed 1, loop on) |
| Composition | 1280x720, 30 fps, 8 s loop |
| Throttling | None, 4x and 6x via CDP `Emulation.setCPUThrottlingRate`, set before navigation |
| Runs | 3 runs per tool per throttle level (27 total), fresh browser per run, tool order rotated per run; **medians reported**, ranges in summary.md |
| Window | 5 s warm-up, then 30 s measurement; memory sampled 60 s after load; then 10 config-latency samples |
| Date | 2026-10-17, 20:34 to 21:13 UTC |
| Audio | None. No audio elements, assets or dependencies were added. Remotion's player was told to create 0 shared audio tags. |

## Comparison table (medians of 3 runs)

| Metric | Remotion | HyperFrames | Revideo |
|---|---:|---:|---:|
| **Avg FPS, no throttle** | 60.0 | 60.0 | 60.0 |
| **Avg FPS, 4x** | 59.9 | 60.0 | 58.8 |
| **Avg FPS, 6x** | 59.9 | 60.0 | **45.5** |
| **5th-percentile FPS, no throttle / 4x / 6x** | 59.9 / 59.5 / 59.5 | 59.9 / 59.9 / 59.9 | 59.9 / 59.5 / **20.0** |
| Frames > 50 ms per 30 s, 6x | 0 | 0 | 27 |
| **Playback rate at 6x** (animation s per wall s, ideal 1.00) | 1.00 | 1.00 | **0.91** |
| Animation updates per second | 30 | 120 (seeks twice per display frame) | 30 (27 at 6x) |
| **Main-thread busy, no throttle / 4x / 6x** | **4 / 18 / 27 %** | 7 / 25 / 43 % | 15 / 63 / 90 % |
| CPU, all Chromium processes, no throttle (% of one core) | **13 %** | 22 % | 24 % |
| of which renderer / GPU process, no throttle | 10 / 3 % | 17 / 4 % | 19 / 5 % |
| JS heap after GC @ 60 s | 4.2 MB | 4.1 MB | 7.1 MB |
| Renderer memory (PSS) @ 60 s | 93 MB | 97 MB | 109 MB |
| Total memory, all Chromium processes (PSS) @ 60 s | 319 MB | 323 MB | 319 MB |
| **Time to first frame, no throttle / 4x / 6x** | 184 / 540 / 843 ms | 181 / 538 / 864 ms | 252 / 868 / 1325 ms |
| **Config update latency, no throttle / 4x / 6x** | **18 / 26 / 27 ms** | 23 / 30 / 40 ms | 76 / 231 / 348 ms |
| **Production bundle, gzipped** (all files the page loads) | **165 KB** | 225 KB | 336 KB |
| of which | app + React + Remotion: 1 JS file | player 32 KB + GSAP 28 KB + HyperFrames runtime 167 KB | app + React + Revideo 340 KB JS, 18 KB WASM, 3 KB CSS |
| Runtime dependencies (browser) | `remotion`, `@remotion/player`, `react`, `react-dom` | `@hyperframes/player` (pulls `@hyperframes/core`), `gsap` | `@revideo/core`, `@revideo/2d`, `@revideo/player-react`, `react`, `react-dom` |
| Needs React? | Yes | **No** | Yes (for the player wrapper) |
| Packages installed for production (`npm ls --omit=dev`) | 4 for the runtime (256 with the scaffold's `@remotion/cli` Studio dependency) | 63: `@hyperframes/core` drags in studio-server, `sharp`, `esbuild` | 39, incl. MathJax, hls.js, Rive, CodeMirror |
| External network requests while playing | None | None (after vendoring the runtime, see below) | None |
| Live config without rebuild | Yes, first try | Yes, first try (after finding the API) | Yes, after 3 workarounds |
| Playhead kept on config change | Yes | Yes | Only with a workaround (otherwise restarts at 0) |

### How each number was measured

- **FPS**: `requestAnimationFrame` timestamps over 30 s from a script injected into every page. Average = frames / time.
  5th-percentile FPS = 1000 / 95th-percentile frame time. These show how smoothly the page runs, not how often the
  tool draws the animation (that is "animation updates per second", counted by a one-line hook in each demo).
- **Playback rate**: composition time advanced (reported by each demo's hook) divided by wall time. Below 1.00 the
  animation runs in slow motion.
- **CPU**: (a) main-thread busy = CDP `Performance.getMetrics` `TaskDuration` delta / wall time; (b) CPU time of
  every Chromium process from `/proc/<pid>/stat`. **Under 4x/6x throttling, (b) is not meaningful**: DevTools throttling
  works by keeping the throttled thread busy, so it inflates process CPU to about 100 % for every tool. Use main-thread
  busy % for the throttled runs.
- **Memory**: `performance.memory.usedJSHeapSize`, JS heap after a forced GC (CDP), and PSS from
  `/proc/<pid>/smaps_rollup` summed over all Chromium processes, all at 60 s after load. Roughly 220 MB of the
  ~320 MB total is Chromium itself (browser, GPU, utility processes), the same for all three.
- **Time to first frame**: from navigation start to the first `requestAnimationFrame` after the tool rendered its first
  animation frame (per-frame hook). Served from localhost, so there's no network time in it.
- **Bundle size**: `gzip -9` of every file the page actually requested during a run (from Playwright's network log).
- **Config update latency**: the harness changes `accentColor` through the same editor code the user uses, during the
  hold phase, and watches a CDP screencast for the first frame where a pixel inside bar 3 shows the new colour. Median of
  10 samples per run, 0 samples missed. Resolution is one display frame (about 16 ms), so Remotion's 18 ms and
  HyperFrames' 23 ms are both "next frame or the one after".

### What the numbers say

- With no throttle, all three are smooth and the differences are only in cost: Remotion uses about half the CPU of the
  other two. Memory differences (93 / 97 / 109 MB renderer) are small next to Chromium's own ~220 MB.
- **Remotion vs HyperFrames**: both hold 60 FPS and real time at 6x. HyperFrames keeps the main thread about 1.6x
  busier (43 % vs 27 % at 6x). Part of that is a measured quirk: its player posts a `tick` each frame **and** its
  runtime runs its own clock, so the GSAP timeline is seeked twice per display frame (120 seeks/s). Time to first frame
  is the same within noise.
- **Revideo** is the heaviest on the main thread at every level, and the only one that degrades. At 6x the main thread
  is saturated (90 %) and, because Revideo's player advances one frame per tick rather than following the clock, the
  8-second loop took about 8.8 s. Its config latency is 4-13x the others because every variables change recalculates
  and replays the scene from frame 0 up to the current frame.

## Developer experience notes

| | Remotion | HyperFrames | Revideo |
|---|---|---|---|
| Scaffold | `npx create-video@latest --yes --blank` worked first time | `npx hyperframes init --example blank --non-interactive` worked (set `HYPERFRAMES_SKIP_SKILLS=1` to stop it fetching AI skills from GitHub) | `npm init @revideo@latest` is interactive-only; piped input failed, had to drive it through a pseudo-terminal |
| Starter template contents | Blank, no audio | Blank, no audio; GSAP from a CDN; CLAUDE.md/AGENTS.md telling agents to install HeyGen skills | Remote `<Video>` and **`<Audio>` (music) from S3**, a render script; removed |
| Setup problems | Remotion bundles a Studio, not an embeddable page, so I added Vite; 2 failed installs from peer-dependency conflicts (Vite 7 vs plugin-react 6, babel tree under `@remotion/cli`), solved by using Vite 8 alone; 2 TypeScript fixes | Runtime falls back to jsDelivr unless vendored; GSAP also from a CDN by default | Template depends on renderer + CLI (Puppeteer Chrome download, FFmpeg binaries); dropped them for player-only use, which also drops the Revideo editor |
| How config reaches the animation | `inputProps` on `<Player>` (documented) | `player.setRuntimeData("config", …)` (in the player README) + `window.__hyperframes.registerRuntimeDataHandler` in the composition (**not in the docs**; found by reading the runtime bundle) | `variables` prop, documented, but broken in practice with React 19 (see below); ended up driving the core `Player` directly |
| Fix iterations on the animation | 0 | 0 | 7 (no autoplay, React 19 prop bug, player re-pausing after ready, reactive text crashing outside scene context, fragments not rendering, playhead resetting on variables change, my own play-once loop) |
| Setup / docs iterations | 4 | ~6 (finding the runtime-data receiver) | 2 (scaffold) + source reading for every fix above |
| Lines of code (non-blank): animation | 179 (TSX) | 145 (one HTML file with GSAP) | 174 (TSX generator scene) |
| Lines of code: player integration | 75 | 78 | 103 |
| Shared demo editor (copied into each, same code) | 136 | 136 | 136 |
| Docs quality | Good and current; Player API fully documented | Good for authoring and rendering; thin on embedding live data; has an `llms.txt` index | Moved to midrender.com; quickstart still shows the audio/video example; nothing on the React 19 issue or the context errors |
| `loop:false` (stop on full card at 6.6 s) | `outFrame` + `moveToBeginningWhenEnded={false}` | `rangeEnd` attribute | No in/out range; paused from `onTimeUpdate` (can overshoot one frame) |
| How well Claude Code handled it | Smooth; problems were generic npm/TypeScript ones | Smooth once the API was found; needed to read minified runtime code | Hard; every problem needed reading library source and browser probes |

Revideo problems worth knowing about, all verified in the browser:
1. `@revideo/player-react` 0.11.0 requires React 19, but under React 19 its `playing` / `looping` / `variables`
   props stop reaching `<revideo-player>` once the element upgrades. React sets them as properties; the element
   only listens to attributes. Measured: attribute `"false"`, property `"true"`, nothing playing.
2. The element pauses the player right after firing `playerready`, undoing a play() call made in `onPlayerReady`.
3. A reactive `Txt text={() => …}` crashes during drawing ("The scene is not available in the current context").
4. A variables change restarts the loop at frame 0 (recalculation leaves playback at the end and the loop logic
   rewinds).
5. The update loop keeps running while paused (a TODO in core), and the player logs the project object to the console.

## Licensing and telemetry (facts from each project's current docs, 2026-10-17)

**Remotion** (source-available, not open source)
- Free License for: individuals, for-profit organisations with up to 3 employees, non-profits, and anyone "evaluating
  whether Remotion is a good fit, and are not yet using it in a commercial way" (LICENSE.md).
- Companies of 4+ people need a Company License. The license page puts "embedding the Remotion Player" under
  **Remotion for Automators: $0.01 per render, $100/month minimum**. The license FAQ says "Previews in the Remotion
  Studio or Remotion Player do not count as Renders", but organisations "using the Remotion Player will fall under
  Remotion for Automators". So a commercial device product from a 4+ person company should expect at least the
  $100/month minimum. Confirm with Remotion for your case.
- LICENSE.md says the license will "slightly change" in Remotion 5.0.
- Telemetry: no network requests were made by the player page during any run. I did not audit the CLI/renderer.

**HyperFrames** (HeyGen)
- Apache License 2.0 (repository LICENSE, and the LICENSE file shipped in `@hyperframes/player`). The player
  README's "License" section says MIT and its package.json has no license field, so the README looks out of date.
- The CLI collects telemetry (command names, render performance, coarse system info, the name of a detected coding
  agent); opt out with `HYPERFRAMES_NO_TELEMETRY=1` or `npx hyperframes telemetry disable`. The player and runtime
  bundles contain no telemetry endpoint, and the demo made no external requests once the runtime was vendored.
- Depends on **GSAP**, which uses GreenSock's "Standard 'no charge' license", not an OSI license. Read it before
  shipping in a product.
- Offline note: the player loads the runtime from `cdn.jsdelivr.net` unless the composition includes it. For a device,
  vendor `hyperframe.runtime.iife.js` and GSAP (done here in `hyperframes/scripts/vendor.mjs`).

**Revideo** (Midrender)
- MIT (repository LICENSE, inherited from Motion Canvas).
- README: "Revideo anonymously counts how many videos are rendered, via PostHog"; disable with `DISABLE_TELEMETRY=true`.
  `@revideo/create` also sends a PostHog event when scaffolding (disabled here). The player page made no external requests.
- Maintenance: last npm release 0.11.0 on 2026-07-10; docs moved from docs.re.video to midrender.com.

## Recommendation for "configurable animations on an embedded device"

**HyperFrames** if license cost and a small, framework-free runtime matter. **Remotion** if the most CPU headroom is
the priority and the Company License is acceptable.

- **HyperFrames**: plain HTML/CSS + GSAP, no React, Apache 2.0. It held 60 FPS and real time at 6x with the same
  first-frame time as Remotion, and config updates in one or two frames. Authoring in HTML/CSS fits a device team that
  doesn't use React, and the config maps naturally to CSS variables.
  *Main risks*: it's young (0.8.x, releases almost daily) and the live-data API is under-documented. It uses about 1.6x
  Remotion's main-thread time, partly because the timeline is seeked twice per frame. It needs the runtime vendored
  for offline use, and GSAP's license is not OSI.
- **Remotion**: the lowest CPU, smallest bundle and fastest config updates measured, with the most mature docs and API.
  *Main risks*: licensing (Player embedding counts as Automators for companies of 4+, from $100/month) and the
  React dependency on the device.
- **Revideo**: not recommended for this use. It's the heaviest, the only one that slowed down under 6x (its
  frame-stepping playback runs slow rather than dropping frames, so timing drifts on a slow device), and its
  config path replays the scene (231-348 ms under throttle). The React player wrapper doesn't work with its own
  required React version without workarounds.
  *Main risk*: everything above, plus a slower release cadence.

**Recommended next step:** run `harness/run.mjs` on the actual device, or a similar single-board computer such as a
Raspberry Pi 4/5 with the same browser, and compare Remotion and HyperFrames there. The real GPU and compositor,
which these runs don't model, may change the gap between them.

## Caveats: what was NOT tested

- **No real device.** These are cloud-VM numbers with software rendering and no GPU. CPU throttling slows the page's
  main thread only. It doesn't model a slow GPU or compositor, slow storage, low RAM or thermal throttling.
- **Long-run stability and memory leaks**: each run lasted about 90 s. Memory was flat between 4x and 6x runs
  (JS heap after GC unchanged), but hours-long runs were not done.
- **Headless only.** No real display, so vsync and presentation timing come from headless Chromium.
- **One animation.** Text-heavy, image, video or many-element scenes may rank differently (DOM vs canvas trade-offs).
- **Only `accentColor` changes were timed.** Changing the title or bars has the same code path in Remotion and
  HyperFrames. In Revideo every change triggers the same scene recalculation, so expect similar latencies.
- **Time to first frame excludes network**: files were served from localhost. On a device loading from local
  storage this is close to reality; over a network, bundle size (165 / 225 / 336 KB gzipped) adds to it.
- **No plain HTML/CSS/WAAPI baseline** without any framework was measured; it would show how much each tool's
  runtime costs over the minimum.
- **Revideo was used without its editor and renderer** (dropped to avoid Chrome and FFmpeg downloads), so its
  authoring experience in the Revideo editor was not evaluated. Remotion's Studio and HyperFrames' Studio were also not
  used beyond scaffolding.
