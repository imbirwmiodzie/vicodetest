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
