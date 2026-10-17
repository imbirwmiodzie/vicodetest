/** @jsxImportSource react */
import type {Player as CorePlayer} from '@revideo/core';
import {Player} from '@revideo/player-react';
import {useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import project from '../src/project';
import {Cfg, loadConfig, mountEditor} from './editor';

const FPS = 30;
const HOLD_END_FRAME = Math.round(6.6 * FPS); // where loop:false stops

// Optional hooks injected by benchmark/harness/bench-inject.js; no-ops otherwise.
const bench = (window as any).__bench as {frame?: (t: number) => void} | undefined;

// With React 19, <Player>'s playing/looping/variables props stop reaching
// <revideo-player> once it has upgraded (React assigns them as properties,
// the element only reacts to attributes), so the demo drives the core Player
// from onPlayerReady instead.
let core: CorePlayer | null = null;
let current: Cfg;
let stoppedOnce = false;
let resumeFrame = -1;

function applyToPlayer(cfg: Cfg) {
  current = cfg;
  if (!core) return;
  const {title, value, unit, accentColor, bars} = cfg;
  // Same sequence <revideo-player> runs on a 'variables' change: the scene is
  // reloaded and replayed up to the current frame inside the scene context.
  // The recalculation that follows leaves playback on the last frame, and with
  // looping on the player then rewinds to 0, so seek back once it is done.
  resumeFrame = core.playback.frame;
  core.setVariables({title, value, unit, accentColor, bars});
  core.setSpeed(cfg.speed);
  core.toggleLoop(cfg.loop);
  core.requestSeek(resumeFrame);
  core.playback.reload();
  if (cfg.loop) {
    stoppedOnce = false;
    core.togglePlayback(true);
  }
}

function App() {
  const ready = useRef(false);
  useEffect(() => () => void (core = null), []);
  return (
    <Player
      project={project}
      controls={false}
      fps={FPS}
      onPlayerReady={(p) => {
        core = p;
        p.onRecalculated.subscribe(() => {
          if (resumeFrame >= 0) p.requestSeek(resumeFrame);
          resumeFrame = -1;
        });
        // The element pauses the player right after 'playerready' ("restore previous
        // state"), so start playback on the next microtask.
        queueMicrotask(() => {
          applyToPlayer(current);
          if (!ready.current) {
            ready.current = true;
            p.togglePlayback(true);
          }
        });
      }}
      onTimeUpdate={(t) => {
        bench?.frame?.(t);
        // The player has no in/out range, so play-once stops itself at the end of the hold.
        if (!current.loop && !stoppedOnce && core && t * FPS >= HOLD_END_FRAME) {
          stoppedOnce = true;
          core.togglePlayback(false);
          core.requestSeek(HOLD_END_FRAME);
        }
      }}
    />
  );
}

loadConfig().then((initial) => {
  current = initial;
  createRoot(document.getElementById('player')!).render(<App />);
  const editor = mountEditor(document.getElementById('editor')!, initial, applyToPlayer);
  (window as any).__benchApply = (c: Cfg) => editor.set(c);
});
