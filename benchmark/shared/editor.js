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
    <label><input data-k="ethernet" type="checkbox"> Ethernet step</label>
    <label>Port <select data-k="port">${[1, 2, 3, 4, 5]
      .map((p) => `<option value="${p}">${p}${p === 4 ? " (WAN)" : p === 5 ? " (10G)" : ""}</option>`)
      .join("")}</select></label>
    <label>Modem <select data-k="modem"><option value="stick">USB stick (TCL IK41)</option><option value="receiver">5G Receiver (window)</option></select></label>
    <label>Panels <select data-k="panelStyle"><option value="vector">vector drawing</option><option value="photo">photos</option></select></label>
    <label>USB port <select data-k="usbPort"><option value="front">front (USB 3.0)</option><option value="back">back (USB 2.0)</option></select></label>
    <label><input data-k="direct" type="checkbox"> Stick straight into router</label>
    <label><input data-k="extension" type="checkbox"> Extension cable + window</label>
    <label>Ethernet cable <input data-k="cableColor" type="color"></label>
    <label>USB cable <input data-k="usbCableColor" type="color"></label>
    <label>Link LED <input data-k="ledColor" type="color"></label>
    <label>Accent <input data-k="accentColor" type="color"></label>
    <label>Speed <input data-k="speed" type="range" min="0.1" max="4" step="0.1"><output data-o="speed"></output></label>
    <label><input data-k="loop" type="checkbox"> Loop</label>
    <textarea spellcheck="false" rows="20"></textarea>
    <div class="row"><button data-act="reload">Reload router.json</button><span class="status"></span></div>`;

  const q = (s) => root.querySelector(s);
  const json = q("textarea");
  const status = q(".status");
  const field = (k) => q(`[data-k="${k}"]`);
  const COLORS = ["cableColor", "usbCableColor", "ledColor", "accentColor"];
  const BOOLS = ["ethernet", "direct", "extension", "loop"];

  const render = () => {
    field("port").value = String(cfg.port);
    field("usbPort").value = cfg.usbPort;
    field("panelStyle").value = cfg.panelStyle;
    field("modem").value = cfg.modem;
    for (const k of BOOLS) field(k).checked = cfg[k];
    // <input type=color> only accepts #rrggbb; leave it alone for other CSS colours.
    for (const k of COLORS) if (/^#[0-9a-f]{6}$/i.test(cfg[k])) field(k).value = cfg[k];
    field("speed").value = String(cfg.speed);
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
    if (BOOLS.includes(k)) commit({ ...cfg, [k]: el.checked });
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

// Decodes the images before the first frame; warns if media/ hasn't been fetched yet.
// svgScale > 1 returns SVGs pre-rendered to a canvas that many times larger, which a
// 2D canvas needs to draw them sharply when zoomed in (drawImage rasterises an SVG
// image at its own size).
export function preload(srcs, { svgScale = 1 } = {}) {
  return Promise.all(
    srcs.map((src) => {
      const img = new Image();
      img.src = src;
      return img.decode().then(
        () => {
          if (svgScale === 1 || !src.endsWith(".svg")) return [src, img];
          const c = document.createElement("canvas");
          c.width = img.naturalWidth * svgScale;
          c.height = img.naturalHeight * svgScale;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          return [src, c];
        },
        () => (console.warn(`${src} missing: run media/fetch.sh (or media\\fetch.cmd)`), [src, null]),
      );
    }),
  ).then((pairs) => Object.fromEntries(pairs.filter(([, img]) => img)));
}
