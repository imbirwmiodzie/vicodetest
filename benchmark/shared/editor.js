// Live config editor for the router demo pages: quick controls + raw JSON textarea.
// Plain DOM, shared by the Remotion, HyperFrames and Revideo demos.
import { normalize } from "./router-scene.js";

export async function loadConfig(url = "/config/router.json") {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return normalize(await res.json());
}

export function mountEditor(root, initial, onChange) {
  let cfg = initial;
  root.innerHTML = `
    <label>Port <select data-k="port">${[1, 2, 3, 4, 5]
      .map((p) => `<option value="${p}">${p}${p === 4 ? " (WAN)" : p === 5 ? " (10G)" : ""}</option>`)
      .join("")}</select></label>
    <label>Ethernet cable <input data-k="cableColor" type="color"></label>
    <label>USB cable <input data-k="usbCableColor" type="color"></label>
    <label>Link LED <input data-k="ledColor" type="color"></label>
    <label>Accent <input data-k="accentColor" type="color"></label>
    <label>Speed <input data-k="speed" type="range" min="0.1" max="4" step="0.1"><output data-o="speed"></output></label>
    <label><input data-k="loop" type="checkbox"> Loop</label>
    <textarea spellcheck="false" rows="15"></textarea>
    <div class="row"><button data-act="reload">Reload router.json</button><span class="status"></span></div>`;

  const q = (s) => root.querySelector(s);
  const json = q("textarea");
  const status = q(".status");
  const field = (k) => q(`[data-k="${k}"]`);
  const COLORS = ["cableColor", "usbCableColor", "ledColor", "accentColor"];

  const render = () => {
    field("port").value = String(cfg.port);
    // <input type=color> only accepts #rrggbb; leave it alone for other CSS colours.
    for (const k of COLORS) if (/^#[0-9a-f]{6}$/i.test(cfg[k])) field(k).value = cfg[k];
    field("speed").value = String(cfg.speed);
    field("loop").checked = cfg.loop;
    q('[data-o="speed"]').value = `${cfg.speed}x`;
    if (document.activeElement !== json) json.value = JSON.stringify(cfg, null, 2);
  };

  const commit = (next) => {
    cfg = next;
    status.textContent = "";
    render();
    onChange(cfg);
  };

  root.addEventListener("input", (e) => {
    const el = e.target;
    if (el === json) {
      try {
        commit(normalize(JSON.parse(json.value)));
      } catch (err) {
        status.textContent = `Invalid JSON: ${err.message}`;
      }
      return;
    }
    const k = el.dataset.k;
    if (k === "loop") commit({ ...cfg, loop: el.checked });
    else if (k === "port" || k === "speed") commit(normalize({ ...cfg, [k]: Number(el.value) }));
    else if (k) commit(normalize({ ...cfg, [k]: el.value }));
  });
  json.addEventListener("blur", render);
  q('[data-act="reload"]').addEventListener("click", () =>
    loadConfig().then(commit, (err) => (status.textContent = String(err))),
  );

  render();
  return { set: (c) => commit(normalize(c)) };
}

// Decodes the photos before the first frame; warns if media/ hasn't been fetched yet.
export function preload(srcs) {
  return Promise.all(
    srcs.map((src) => {
      const img = new Image();
      img.src = src;
      return img.decode().then(
        () => [src, img],
        () => (console.warn(`${src} missing: run media/fetch.sh (or media\\fetch.cmd)`), [src, null]),
      );
    }),
  ).then((pairs) => Object.fromEntries(pairs.filter(([, img]) => img)));
}
