// Live config editor for the demo page: quick controls + raw JSON textarea.
// Plain DOM, no framework, so it stays out of the animation's render path.

export type Cfg = {
  title: string;
  value: number;
  unit: string;
  accentColor: string;
  bars: number[];
  speed: number;
  loop: boolean;
};

const FALLBACK_COLOR = "#3D8BFF";
const num = (v: unknown, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : d;

export function normalize(raw: any): Cfg {
  const r = raw && typeof raw === "object" ? raw : {};
  const color = typeof r.accentColor === "string" ? r.accentColor : "";
  const bars = Array.isArray(r.bars) ? r.bars : [];
  return {
    title: typeof r.title === "string" ? r.title : "",
    value: num(r.value, 0),
    unit: typeof r.unit === "string" ? r.unit : "",
    accentColor: color && CSS.supports("color", color) ? color : FALLBACK_COLOR,
    bars: [0, 1, 2, 3, 4].map((i) => Math.min(100, Math.max(0, num(bars[i], 0)))),
    speed: Math.min(4, Math.max(0.1, num(r.speed, 1))),
    loop: r.loop !== false,
  };
}

export async function loadConfig(url = "/config/config.json"): Promise<Cfg> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return normalize(await res.json());
}

export function mountEditor(
  root: HTMLElement,
  initial: Cfg,
  onChange: (cfg: Cfg) => void,
): { set(cfg: Cfg): void } {
  let cfg = initial;
  root.innerHTML = `
    <label>Title <input data-k="title" type="text"></label>
    <label>Value <input data-k="value" type="range" min="0" max="100" step="1"><output data-o="value"></output></label>
    <label>Unit <input data-k="unit" type="text" size="4"></label>
    <label>Accent <input data-k="accentColor" type="color"></label>
    <fieldset><legend>Bars</legend>${[0, 1, 2, 3, 4]
      .map((i) => `<input data-bar="${i}" type="range" min="0" max="100" step="1">`)
      .join("")}</fieldset>
    <label>Speed <input data-k="speed" type="range" min="0.1" max="4" step="0.1"><output data-o="speed"></output></label>
    <label><input data-k="loop" type="checkbox"> Loop</label>
    <textarea spellcheck="false" rows="12"></textarea>
    <div class="row"><button data-act="reload">Reload config.json</button><span class="status"></span></div>`;

  const q = <T extends Element>(s: string) => root.querySelector(s) as T;
  const json = q<HTMLTextAreaElement>("textarea");
  const status = q<HTMLSpanElement>(".status");

  const render = () => {
    const field = (k: string) => q<HTMLInputElement>(`[data-k="${k}"]`);
    field("title").value = cfg.title;
    field("value").value = String(cfg.value);
    field("unit").value = cfg.unit;
    // <input type=color> only accepts #rrggbb; leave it alone for other CSS colours.
    if (/^#[0-9a-f]{6}$/i.test(cfg.accentColor)) field("accentColor").value = cfg.accentColor;
    field("speed").value = String(cfg.speed);
    field("loop").checked = cfg.loop;
    cfg.bars.forEach((b, i) => (q<HTMLInputElement>(`[data-bar="${i}"]`).value = String(b)));
    q<HTMLOutputElement>('[data-o="value"]').value = String(cfg.value);
    q<HTMLOutputElement>('[data-o="speed"]').value = `${cfg.speed}x`;
    if (document.activeElement !== json) json.value = JSON.stringify(cfg, null, 2);
  };

  const commit = (next: Cfg) => {
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
    const bar = el.dataset.bar;
    if (bar !== undefined) {
      const bars = cfg.bars.slice();
      bars[Number(bar)] = Number(el.value);
      commit({ ...cfg, bars });
    } else if (k === "loop") {
      commit({ ...cfg, loop: (el as HTMLInputElement).checked });
    } else if (k === "value" || k === "speed") {
      commit({ ...cfg, [k]: Number(el.value) });
    } else if (k) {
      commit(normalize({ ...cfg, [k]: el.value }));
    }
  });
  json.addEventListener("blur", render);
  q<HTMLButtonElement>('[data-act="reload"]').addEventListener("click", () =>
    loadConfig().then(commit, (err) => (status.textContent = String(err))),
  );

  render();
  return { set: (c) => commit(normalize(c)) };
}
