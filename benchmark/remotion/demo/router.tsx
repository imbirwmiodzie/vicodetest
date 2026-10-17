import { Player, PlayerRef } from "@remotion/player";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useCurrentFrame } from "remotion";
import { DURATION_FRAMES, FPS, HOLD_END_FRAME, RouterSetup, type RouterConfig as RouterCfg } from "../src/RouterSetup";
import { MEDIA } from "../../shared/router-scene.js";
import { loadConfig, mountEditor, preload } from "../../shared/editor.js";

// Optional hooks injected by benchmark/harness/bench-inject.js; no-ops otherwise.
const bench = (window as any).__bench as { frame?: (t: number) => void } | undefined;

const Scene: React.FC<RouterCfg> = (props) => {
  const frame = useCurrentFrame();
  useEffect(() => bench?.frame?.(frame / FPS), [frame, props]);
  return <RouterSetup {...props} />;
};

let setConfig: (cfg: RouterCfg) => void = () => {};

const App: React.FC<{ initial: RouterCfg }> = ({ initial }) => {
  const [cfg, setCfg] = useState(initial);
  const player = useRef<PlayerRef>(null);
  setConfig = setCfg;

  // Frame-exact screenshots: window.__seek(frame) pauses and jumps to a frame.
  useEffect(() => {
    (window as any).__seek = (f: number) => {
      player.current?.pause();
      player.current?.seekTo(f);
    };
  }, []);

  useEffect(() => {
    if (cfg.loop && player.current && !player.current.isPlaying()) player.current.play();
  }, [cfg.loop]);

  return (
    <Player
      ref={player}
      component={Scene}
      inputProps={cfg}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      compositionWidth={1280}
      compositionHeight={720}
      style={{ width: 1280, height: 720 }}
      loop={cfg.loop}
      outFrame={cfg.loop ? undefined : HOLD_END_FRAME}
      moveToBeginningWhenEnded={false}
      playbackRate={cfg.speed}
      autoPlay
      numberOfSharedAudioTags={0}
      acknowledgeRemotionLicense
    />
  );
};

// Decode the photos before the first frame so the opening frames are complete.
Promise.all([loadConfig(), preload(Object.values(MEDIA).map((m) => m.src))]).then(([initial]) => {
  createRoot(document.getElementById("player")!).render(<App initial={initial} />);
  const editor = mountEditor(document.getElementById("editor")!, initial, (c) => setConfig(c));
  (window as any).__benchApply = (c: Partial<RouterCfg>) => editor.set(c);
});
