# Dev log (raw notes, summarised in RESULTS.md)

## Remotion 4.0.536
- Scaffold: `npx create-video@latest --yes --blank --no-tailwind remotion` worked first time. Blank template, no audio assets.
- Player: `npx remotion add @remotion/player` worked.
- Demo bundler: Remotion's own `remotion bundle` builds the Studio, not an embeddable page, so I added Vite.
  - Fail 1: `vite@7` + `@vitejs/plugin-react@6`: peer conflict (plugin needs vite 8).
  - Fail 2: `vite@8` + `@vitejs/plugin-react`: npm ERESOLVE through @remotion/cli's babel/svgr tree.
  - Fix: Vite 8 alone (its built-in oxc transform handles TSX). No React plugin needed.
- TS: `<Composition<StatusConfig, ...>>` generic rejected (expects a Zod schema type) -> dropped generics. Missing `@types/react-dom` -> installed.
- Animation rendered correctly on the first visual check. Live config (inputProps) worked first time, playhead kept. `loop:false` via `outFrame` + `moveToBeginningWhenEnded={false}` worked first time.
- Player creates shared <audio> tags by default (`numberOfSharedAudioTags`, default 5) -> set to 0 to keep it audio-free.
- Fix iterations on the animation itself: 0. Tooling/setup iterations: 4.

## HyperFrames 0.8.169
- Scaffold: `npx hyperframes init hyperframes --example blank --non-interactive` with `HYPERFRAMES_SKIP_SKILLS=1`
  (otherwise init fetches AI "skills" from GitHub). It created index.html, CLAUDE.md/AGENTS.md (agent instructions
  pointing to skills that were not installed), hyperframes.json and meta.json. No audio in the blank example.
- Docs gap: the public docs describe variables only for render time / nested compositions. Live data into a playing
  composition goes through `player.setRuntimeData(channel, payload)`, which is in the player README, but the
  composition-side receiver (`window.__hyperframes.registerRuntimeDataHandler`) is only findable by reading the runtime
  bundle. That took about 6 doc/source lookups.
- Offline: the scaffold loads GSAP from jsDelivr, and the player injects the runtime from jsDelivr when the composition
  doesn't include it. For a device, both were vendored locally (runtime IIFE is 530 KB raw / 167 KB gzip).
- Animation: GSAP timeline + CSS variables (bars) + one tweened proxy for ring/count-up. Config changes never rebuild
  the timeline. Visual match with Remotion on the first try. Live config + `loop:false` (`rangeEnd`) worked first time.
- `hyperframes lint`: 0 errors, 1 warning (wants nested content moved to a sub-composition; Studio convention only).
- Finding: during playback the timeline is seeked **twice per display frame** (player posts a `tick` each parent rAF and
  the runtime also runs its own rAF transport): 120 seeks/s at 60 Hz, measured. So "frames rendered" counts seeks.
- Fix iterations on the animation: 0. Tooling/docs iterations: ~6 (mostly finding the runtime-data receiver).

## Revideo 0.11.0
- Docs moved: docs.re.video now redirects to midrender.com/revideo/docs. Repo is github.com/midrender/revideo.
  Last npm publish 2026-07-10 (3 months before this test).
- Scaffold: `npm init @revideo@latest` is interactive only (name/path prompts). Piped stdin didn't work; driving it
  through a pseudo-terminal did. The default template contains a remote <Video> and an <Audio> (chill-beat.mp3)
  from S3 plus a render script -> all removed. `@revideo/create` sends a PostHog telemetry event on create
  (disabled here with DISABLE_TELEMETRY=true).
- Dependencies: template depends on @revideo/renderer (puppeteer -> Chrome download, @ffmpeg-installer binaries) and
  @revideo/cli. For player-only use they were dropped; the player demo needs core, 2d, player-react, react, react-dom.
  Without @revideo/cli there is no Revideo editor (`npm start`).
- Player fixes (Revideo-specific problems, in order):
  1. Nothing played. `<revideo-player>` ignores `playing="true"` set before its project is ready. (Also had a bug of
     my own: an effect set playing=true on mount.)
  2. With React 19 (player-react's required peer), the wrapper's `playing` / `looping` / `variables` props stop
     reaching the custom element after it upgrades: React assigns them as properties, the element only reacts to
     attributes. Verified in the browser (attribute "false", property "true"). Workaround: drive the core Player
     from `onPlayerReady`.
  3. The element calls `togglePlayback(false)` right after firing `playerready`, undoing play() in the callback ->
     deferred with queueMicrotask.
  4. "The scene is not available in the current context": a reactive `Txt text={() => ...}` spawns new text nodes,
     which fails during drawing. Fix: imperative `num().text()` inside a tween, plain strings for title/unit.
  5. Nested JSX fragments inside `.map()` didn't render (bars missing) -> wrapped in <Node>.
  6. A variables change (same sequence the element itself uses: setVariables + requestSeek + playback.reload)
     restarts the loop at frame 0: recalculation leaves playback at the end and the loop logic rewinds. Fix: seek
     back to the saved frame in `onRecalculated`.
  7. My play-once stop re-seeked every frame -> guard flag.
  Total: 7 fix iterations after the first build (cap was ~8). Each needed reading the library source; none of the
  above is in the docs.
- Behaviour notes from the source: playback advances a fixed number of frames per tick (not wall-clock based), so a
  slow device plays slower instead of dropping frames; the rAF loop keeps running while paused (TODO in core); the
  player logs the project object to the console on load; every frame triggers a React state update in the wrapper.
- No in/out range in the player: play-once is implemented by pausing in onTimeUpdate (can overshoot one frame).
- Long titles are not truncated with an ellipsis (canvas text); the other two truncate.

## Router setup demo (Remotion only so far)
- Request: a more realistic demo. The Centro Business 3.0 back panel (photo from cb-guide.swisscom.ch), an Ethernet
  cable going into port 1, then a TCL LinkKey IK41 USB stick (photo from komsa.pl) going into the USB 2.0 port.
- Photos are not committed (public repo, third-party images): `node media/fetch.mjs` downloads them into `media/`.
  With Node 22 behind a proxy, use `NODE_USE_ENV_PROXY=1`.
- Approach: CSS 3D. The router is a box whose front face is the back-panel photo, seen at rotateX(-14) rotateY(-32).
  The plug, boot and stick are CSS boxes that move along the panel normal into the measured socket positions.
  The cable is an SVG path in the vertical plane through the port. Camera = translateZ zoom + focus point.
- Timeline 13 s (390 frames @30): overview, zoom to port, plug in + click + link LED, pan to USB, stick in + LED,
  zoom out, hold, fade. `loop:false` stops at 11.6 s.
- Config: `config/router.json` (title, step texts, port 1-5, cable/LED/accent colours, speed, loop), live editor
  on `remotion/demo/router.html`; `window.__seek(frame)` gives frame-exact screenshots.
- Remotion lint rejects CSS background-image (it doesn't wait for loading when rendering) -> `<Img>` inside faces.
- Porting note: HyperFrames can reuse the same DOM/CSS 3D. Revideo draws on canvas 2D (no CSS 3D), so it would
  need its own projection of the boxes.
