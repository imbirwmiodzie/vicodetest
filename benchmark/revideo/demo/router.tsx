/** @jsxImportSource react */
import type {Player as CorePlayer} from '@revideo/core';
import {Player} from '@revideo/player-react';
import {useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {loadConfig, mountEditor, preload} from '../../shared/editor.js';
import {FPS, HOLD_END_S, MEDIA, type RouterConfig} from '../../shared/router-scene.js';
import project, {images} from '../src/router-project';

const HOLD_END_FRAME = Math.round(HOLD_END_S * FPS); // where loop:false stops

// Optional hooks injected by benchmark/harness/bench-inject.js; no-ops otherwise.
const bench = (window as any).__bench as {frame?: (t: number) => void} | undefined;

// Same player workarounds as the status card (see demo/main.tsx): with React 19 the
// wrapper's props stop reaching <revideo-player>, so the core Player is driven directly.
let core: CorePlayer | null = null;
let current: RouterConfig;
let stoppedOnce = false;
let resumeFrame = -1;

function applyToPlayer(cfg: RouterConfig) {
  current = cfg;
  if (!core) return;
  const {speed, loop, ...scene} = cfg;
  resumeFrame = core.playback.frame;
  core.setVariables({config: scene});
  core.setSpeed(speed);
  core.toggleLoop(loop);
  core.requestSeek(resumeFrame);
  core.playback.reload();
  if (loop) {
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
      onPlayerReady={p => {
        core = p;
        p.onRecalculated.subscribe(() => {
          if (resumeFrame >= 0) p.requestSeek(resumeFrame);
          resumeFrame = -1;
        });
        queueMicrotask(() => {
          applyToPlayer(current);
          if (!ready.current) {
            ready.current = true;
            p.togglePlayback(true);
          }
        });
      }}
      onTimeUpdate={t => {
        bench?.frame?.(t);
        if (!current.loop && !stoppedOnce && core && t * FPS >= HOLD_END_FRAME) {
          stoppedOnce = true;
          core.togglePlayback(false);
          core.requestSeek(HOLD_END_FRAME);
        }
      }}
    />
  );
}

Promise.all([loadConfig(), preload(Object.values(MEDIA).map(m => m.src))]).then(([initial, loaded]) => {
  Object.assign(images, loaded);
  current = initial;
  createRoot(document.getElementById('player')!).render(<App />);
  const editor = mountEditor(document.getElementById('editor')!, initial, applyToPlayer);
  (window as any).__benchApply = (c: Partial<RouterConfig>) => editor.set(c);
  // Frame-exact screenshots: window.__seek(frame) pauses and jumps to a frame.
  (window as any).__seek = (f: number) => {
    core?.togglePlayback(false);
    core?.requestSeek(f);
  };
});
