import "@hyperframes/player";
import { HOLD_END_S, type RouterConfig } from "../../shared/router-scene.js";
import { loadConfig, mountEditor } from "../../shared/editor.js";

const player = document.createElement("hyperframes-player") as HTMLElement & {
  setRuntimeData(channel: string, payload: unknown): void;
  play(): void;
  pause(): void;
  seek(t: number): void;
  paused: boolean;
  loop: boolean;
  playbackRate: number;
  rangeEnd: number | null;
};
player.setAttribute("src", "./composition/router.html");
player.setAttribute("width", "1280");
player.setAttribute("height", "720");
player.setAttribute("autoplay", "");
player.setAttribute("audio-locked", "");
player.setAttribute("disable-click-to-play", "");
player.style.cssText = "display:block;width:1280px;height:720px";

function apply(cfg: RouterConfig) {
  const { speed, loop, ...scene } = cfg;
  // Delivered over postMessage to the composition's registerRuntimeDataHandler("config").
  player.setRuntimeData("config", scene);
  player.playbackRate = speed;
  player.loop = loop;
  player.rangeEnd = loop ? null : HOLD_END_S;
  if (loop && player.paused) player.play();
}

loadConfig().then((initial) => {
  document.getElementById("player")!.appendChild(player);
  apply(initial);
  const editor = mountEditor(document.getElementById("editor")!, initial, apply);
  (window as any).__benchApply = (c: Partial<RouterConfig>) => editor.set(c);
  // Frame-exact screenshots: window.__seek(frame) pauses and jumps to a frame (30 fps).
  (window as any).__seek = (f: number) => {
    player.pause();
    player.seek(f / 30);
  };
});
