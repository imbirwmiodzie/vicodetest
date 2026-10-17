import { Player, PlayerRef } from "@remotion/player";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useCurrentFrame } from "remotion";
import {
  DURATION_FRAMES,
  FPS,
  HOLD_END_FRAME,
  StatusCard,
} from "../src/StatusCard";
import { Cfg, loadConfig, mountEditor } from "./editor";

// Optional hooks injected by benchmark/harness/bench-inject.js; no-ops otherwise.
const bench = (window as any).__bench as { frame?: () => void } | undefined;

// Counts every frame the composition actually renders.
const Card: React.FC<Cfg> = (props) => {
  const frame = useCurrentFrame();
  useEffect(() => bench?.frame?.(), [frame, props]);
  return <StatusCard {...props} />;
};

let setConfig: (cfg: Cfg) => void = () => {};

const App: React.FC<{ initial: Cfg }> = ({ initial }) => {
  const [cfg, setCfg] = useState(initial);
  const player = useRef<PlayerRef>(null);
  setConfig = setCfg;

  // Turning loop back on after a play-once run has stopped should restart playback.
  useEffect(() => {
    if (cfg.loop && player.current && !player.current.isPlaying()) player.current.play();
  }, [cfg.loop]);

  return (
    <Player
      ref={player}
      component={Card}
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

loadConfig().then((initial) => {
  createRoot(document.getElementById("player")!).render(<App initial={initial} />);
  const editor = mountEditor(document.getElementById("editor")!, initial, (c) => setConfig(c));
  (window as any).__benchApply = (c: Cfg) => editor.set(c);
});
