import "@hyperframes/player";
import { normalize, timeline, type ConntrackConfig } from "../../shared/conntrack-scene.js";

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
player.setAttribute("src", "./composition/conntrack.html");
player.setAttribute("width", "1280");
player.setAttribute("height", "720");
player.setAttribute("autoplay", "");
player.setAttribute("audio-locked", "");
player.setAttribute("disable-click-to-play", "");
player.style.cssText = "display:block;width:1280px;height:720px";

const CONFIG_URL = "/config/conntrack.json";
const loadConfig = async () => {
  const res = await fetch(CONFIG_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`${CONFIG_URL}: HTTP ${res.status}`);
  return normalize(await res.json());
};

function apply(cfg: ConntrackConfig) {
  const { speed, loop, ...scene } = cfg;
  // Delivered over postMessage to the composition's registerRuntimeDataHandler("config").
  player.setRuntimeData("config", scene);
  player.playbackRate = speed;
  player.loop = loop;
  // The composition is as long as the longest config; play only this config's part.
  const tl = timeline(cfg);
  player.rangeEnd = loop ? tl.duration : tl.holdEnd;
  if (loop && player.paused) player.play();
}

// Quick controls + raw JSON, like the router demo's editor.
const BOOLS = ["normal", "outbound", "inbound", "mitigation", "loop"] as const;
const NUMS = ["tableSize", "perHostLimit", "speed"] as const;
function mountEditor(root: HTMLElement, initial: ConntrackConfig) {
  let cfg = initial;
  root.innerHTML = `
    <label><input data-k="normal" type="checkbox"> 1 · Normal use</label>
    <label><input data-k="outbound" type="checkbox"> 2 · Flood from the LAN</label>
    <label><input data-k="inbound" type="checkbox"> 3 · Flood from the internet</label>
    <label><input data-k="mitigation" type="checkbox"> 4 · Protected (per-device limit)</label>
    <label>Site <input data-k="site" type="text"></label>
    <label>Table slots <input data-k="tableSize" type="range" min="16" max="48" step="8"><output data-o="tableSize"></output></label>
    <label>Per-device limit <input data-k="perHostLimit" type="range" min="2" max="16" step="1"><output data-o="perHostLimit"></output></label>
    <label>Speed <input data-k="speed" type="range" min="0.1" max="4" step="0.1"><output data-o="speed"></output></label>
    <label><input data-k="loop" type="checkbox"> Loop</label>
    <textarea spellcheck="false" rows="14"></textarea>
    <div class="row"><button data-act="reload">Reload conntrack.json</button><span class="status"></span></div>`;
  const q = <T extends Element>(s: string) => root.querySelector(s) as T;
  const json = q<HTMLTextAreaElement>("textarea");
  const status = q<HTMLElement>(".status");
  const field = (k: string) => q<HTMLInputElement>(`[data-k="${k}"]`);

  const render = () => {
    for (const k of BOOLS) field(k).checked = cfg[k];
    for (const k of NUMS) {
      field(k).value = String(cfg[k]);
      q<HTMLOutputElement>(`[data-o="${k}"]`).value = k === "speed" ? `${cfg.speed}x` : String(cfg[k]);
    }
    if (document.activeElement !== field("site")) field("site").value = cfg.site;
    if (document.activeElement !== json) json.value = JSON.stringify(cfg, null, 2);
  };
  const commit = (next: ConntrackConfig) => {
    cfg = next;
    status.textContent = "";
    render();
    apply(cfg);
  };
  root.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    if (el === (json as unknown)) {
      try {
        commit(normalize(JSON.parse(json.value)));
      } catch (err) {
        status.textContent = `Invalid JSON: ${(err as Error).message}`;
      }
      return;
    }
    const k = el.dataset.k;
    if (!k) return;
    if ((BOOLS as readonly string[]).includes(k)) commit({ ...cfg, [k]: el.checked });
    else if ((NUMS as readonly string[]).includes(k)) commit(normalize({ ...cfg, [k]: Number(el.value) }));
    else commit(normalize({ ...cfg, [k]: el.value }));
  });
  json.addEventListener("blur", render);
  q("[data-act=reload]").addEventListener("click", () =>
    loadConfig().then(commit, (err) => (status.textContent = String(err))),
  );
  render();
  return { set: (c: unknown) => commit(normalize(c)) };
}

loadConfig().then((initial) => {
  document.getElementById("player")!.appendChild(player);
  apply(initial);
  const editor = mountEditor(document.getElementById("editor")!, initial);
  (window as any).__benchApply = (c: Partial<ConntrackConfig>) => editor.set(c);
  // Frame-exact screenshots: window.__seek(frame) pauses and jumps to a frame (30 fps).
  (window as any).__seek = (f: number) => {
    player.pause();
    player.seek(f / 30);
  };
});
