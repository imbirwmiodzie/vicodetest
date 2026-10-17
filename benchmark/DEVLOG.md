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
