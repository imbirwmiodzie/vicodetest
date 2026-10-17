// Live config editor for the router demo: quick controls + raw JSON textarea.

export type RouterCfg = {
  title: string;
  step1: string;
  step2: string;
  done: string;
  port: number;
  cableColor: string;
  ledColor: string;
  accentColor: string;
  speed: number;
  loop: boolean;
};

const DEFAULTS: RouterCfg = {
  title: "Centro Business 3.0",
  step1: "Connect the Ethernet cable to port 1",
  step2: "Plug the TCL LinkKey IK41 into the USB 2.0 port",
  done: "Ethernet and mobile backup connected",
  port: 1,
  cableColor: "#E4E7EB",
  ledColor: "#38E07B",
  accentColor: "#0F6FDE",
  speed: 1,
  loop: true,
};

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
const color = (v: unknown, d: string) => (typeof v === "string" && CSS.supports("color", v) ? v : d);

export function normalize(raw: any): RouterCfg {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    title: str(r.title, DEFAULTS.title),
    step1: str(r.step1, DEFAULTS.step1),
    step2: str(r.step2, DEFAULTS.step2),
    done: str(r.done, DEFAULTS.done),
    port: Math.min(5, Math.max(1, Math.round(num(r.port, 1)))),
    cableColor: color(r.cableColor, DEFAULTS.cableColor),
    ledColor: color(r.ledColor, DEFAULTS.ledColor),
    accentColor: color(r.accentColor, DEFAULTS.accentColor),
    speed: Math.min(4, Math.max(0.1, num(r.speed, 1))),
    loop: r.loop !== false,
  };
}

export async function loadConfig(url = "/config/router.json"): Promise<RouterCfg> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return normalize(await res.json());
}

export function mountEditor(
  root: HTMLElement,
  initial: RouterCfg,
  onChange: (cfg: RouterCfg) => void,
): { set(cfg: RouterCfg): void } {
  let cfg = initial;
  root.innerHTML = `
    <label>Port <select data-k="port">${[1, 2, 3, 4, 5]
      .map((p) => `<option value="${p}">${p}${p === 4 ? " (WAN)" : p === 5 ? " (10G)" : ""}</option>`)
      .join("")}</select></label>
    <label>Cable <input data-k="cableColor" type="color"></label>
    <label>Link LED <input data-k="ledColor" type="color"></label>
    <label>Accent <input data-k="accentColor" type="color"></label>
    <label>Speed <input data-k="speed" type="range" min="0.1" max="4" step="0.1"><output data-o="speed"></output></label>
    <label><input data-k="loop" type="checkbox"> Loop</label>
    <textarea spellcheck="false" rows="13"></textarea>
    <div class="row"><button data-act="reload">Reload router.json</button><span class="status"></span></div>`;

  const q = <T extends Element>(s: string) => root.querySelector(s) as T;
  const json = q<HTMLTextAreaElement>("textarea");
  const status = q<HTMLSpanElement>(".status");
  const field = (k: string) => q<HTMLInputElement>(`[data-k="${k}"]`);

  const render = () => {
    field("port").value = String(cfg.port);
    for (const k of ["cableColor", "ledColor", "accentColor"] as const) {
      // <input type=color> only accepts #rrggbb; leave it alone for other CSS colours.
      if (/^#[0-9a-f]{6}$/i.test(cfg[k])) field(k).value = cfg[k];
    }
    field("speed").value = String(cfg.speed);
    field("loop").checked = cfg.loop;
    q<HTMLOutputElement>('[data-o="speed"]').value = `${cfg.speed}x`;
    if (document.activeElement !== json) json.value = JSON.stringify(cfg, null, 2);
  };

  const commit = (next: RouterCfg) => {
    cfg = next;
    status.textContent = "";
    render();
    onChange(cfg);
  };

  root.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (el === json) {
      try {
        commit(normalize(JSON.parse(json.value)));
      } catch (err) {
        status.textContent = `Invalid JSON: ${(err as Error).message}`;
      }
      return;
    }
    const k = el.dataset.k;
    if (k === "loop") commit({ ...cfg, loop: (el as HTMLInputElement).checked });
    else if (k === "port" || k === "speed") commit(normalize({ ...cfg, [k]: Number(el.value) }));
    else if (k) commit(normalize({ ...cfg, [k]: el.value }));
  });
  json.addEventListener("blur", render);
  q<HTMLButtonElement>('[data-act="reload"]').addEventListener("click", () =>
    loadConfig().then(commit, (err) => (status.textContent = String(err))),
  );

  render();
  return { set: (c) => commit(normalize(c)) };
}
