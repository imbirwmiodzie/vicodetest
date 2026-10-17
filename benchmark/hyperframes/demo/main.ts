import "@hyperframes/player";
import { Cfg, loadConfig, mountEditor } from "./editor";

const HOLD_END_S = 6.6; // where loop:false stops

const player = document.createElement("hyperframes-player") as HTMLElement & {
  setRuntimeData(channel: string, payload: unknown): void;
  play(): void;
  paused: boolean;
  loop: boolean;
  playbackRate: number;
  rangeEnd: number | null;
};
player.setAttribute("src", "./composition/index.html");
player.setAttribute("width", "1280");
player.setAttribute("height", "720");
player.setAttribute("autoplay", "");
player.setAttribute("audio-locked", "");
player.setAttribute("disable-click-to-play", "");
player.style.cssText = "display:block;width:1280px;height:720px";

function apply(cfg: Cfg) {
  const { title, value, unit, accentColor, bars } = cfg;
  // Delivered over postMessage to the composition's registerRuntimeDataHandler("config").
  player.setRuntimeData("config", { title, value, unit, accentColor, bars });
  player.playbackRate = cfg.speed;
  player.loop = cfg.loop;
  player.rangeEnd = cfg.loop ? null : HOLD_END_S;
  if (cfg.loop && player.paused) player.play();
}

loadConfig().then((initial) => {
  document.getElementById("player")!.appendChild(player);
  apply(initial);
  const editor = mountEditor(document.getElementById("editor")!, initial, apply);
  (window as any).__benchApply = (c: Cfg) => editor.set(c);
});
