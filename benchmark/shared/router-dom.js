// CSS helpers for drawing a router-scene frame with DOM elements and CSS 3D, plus a
// plain-DOM renderer (used by HyperFrames; Remotion maps the same helpers to JSX).
import { MEDIA, VIEW, WIDTH, HEIGHT, cssPose, cssWorld, faceFrame, faceCss, cableSegments } from "./router-scene.js";

export const FACES = ["front", "back", "right", "left", "top", "bottom"];
const SHADOW = "radial-gradient(closest-side, rgba(0,0,0,0.28), rgba(0,0,0,0.12) 60%, rgba(0,0,0,0))";

const radius = (r) => (Array.isArray(r) ? r.map((v) => `${v}px`).join(" ") : r ? `${r}px` : undefined);

// Styles of the fixed layers. The two worlds share the camera transform: router first,
// then the cables as a flat SVG, then the moving parts, so parts never sink into the panel.
export const layerStyles = {
  root: { position: "relative", width: WIDTH, height: HEIGHT, overflow: "hidden", background: "#FFFFFF", fontFamily: "sans-serif" },
  stage: { position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, perspective: `${VIEW.perspective}px`, perspectiveOrigin: "50% 50%" },
  world: { position: "absolute", left: WIDTH / 2, top: VIEW.top, transformStyle: "preserve-3d" },
  panel: { position: "absolute", left: 0, top: 0, transform: "translateZ(1px)" },
  svg: { position: "absolute", left: 0, top: 0, overflow: "visible" },
};

export const worldTransform = (cam) => cssWorld(cam);

export const boxStyle = (b) => ({
  position: "absolute",
  transformStyle: "preserve-3d",
  transform: `${cssPose(b.pose)} translate3d(${b.c[0]}px, ${b.c[1]}px, ${b.c[2]}px)`,
});

export function faceStyle(name, b) {
  const face = b.faces[name];
  const [fw, fh] = faceFrame(name, ...b.size);
  return {
    position: "absolute",
    left: -fw / 2,
    top: -fh / 2,
    width: fw,
    height: fh,
    transform: faceCss(name, ...b.size),
    backfaceVisibility: "hidden",
    boxSizing: "border-box",
    background: face.shadow ? SHADOW : face.fill,
    border: face.stroke ? `1px solid ${face.stroke}` : undefined,
    borderRadius: radius(face.radius),
    overflow: face.img ? "hidden" : undefined,
    opacity: b.opacity < 1 ? b.opacity : undefined,
  };
}

// Photo inside a face: the source rectangle, turned by `rot`, fills the face.
export function faceImage(name, b) {
  const face = b.faces[name];
  if (!face.img) return null;
  const [fw, fh] = faceFrame(name, ...b.size);
  const { media, sx, sy, sw, sh, rot } = face.img;
  const m = MEDIA[media];
  const k = rot % 180 ? fw / sh : fw / sw;
  return {
    src: m.src,
    wrap: {
      position: "absolute",
      left: (fw - sw * k) / 2,
      top: (fh - sh * k) / 2,
      width: sw * k,
      height: sh * k,
      overflow: "hidden",
      transform: rot ? `rotate(${rot}deg)` : undefined,
    },
    img: { position: "absolute", left: -sx * k, top: -sy * k, width: m.w * k, height: m.h * k, maxWidth: "none" },
  };
}

export const dotStyle = (d) => ({
  position: "absolute",
  left: d.x,
  top: d.y,
  width: d.w,
  height: d.h,
  borderRadius: Math.min(d.w, d.h) / 2,
  background: d.stripes ? `repeating-linear-gradient(90deg, ${d.fill} 0 2px, transparent 2px 4px)` : d.fill,
  boxShadow: d.glow ? `0 0 ${d.glowSize ?? 10}px ${(d.glowSize ?? 10) / 2}px ${d.glow}` : undefined,
});

export function panelStyle(it) {
  const ring = it.type === "ring";
  return {
    position: "absolute",
    left: ring ? it.x - it.r : it.x,
    top: ring ? it.y - it.r : it.y,
    width: ring ? it.r * 2 : it.w,
    height: ring ? it.r * 2 : it.h,
    boxSizing: "border-box",
    borderRadius: ring ? "50%" : it.radius,
    background: it.fill,
    border: it.stroke ? `${it.strokeW}px solid ${it.stroke}` : undefined,
    boxShadow: it.glow ? `0 0 ${it.fill ? 14 : 18}px ${it.fill ? 6 : 0}px ${it.glow}` : undefined,
    opacity: it.opacity ?? 1,
  };
}

// Cable as three passes of round-capped segments: outline, colour, highlight.
export function cableLines(cam, cable) {
  const segs = cableSegments(cam, cable);
  const passes = [
    { stroke: "rgba(0,0,0,0.25)", width: (w) => w + 3, dy: () => 0 },
    { stroke: cable.color, width: (w) => w, dy: () => 0 },
    { stroke: "rgba(255,255,255,0.55)", width: (w) => Math.max(1, w * 0.17), dy: (w) => -w * 0.23 },
  ];
  const out = [];
  for (const p of passes)
    for (const [x0, y0, x1, y1, w] of segs) out.push({ x0, y0: y0 + p.dy(w), x1, y1: y1 + p.dy(w), w: p.width(w), stroke: p.stroke });
  return out;
}

export const titleStyle = (opacity) => ({
  position: "absolute",
  left: 46,
  top: 52,
  padding: "6px 18px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.9)",
  fontSize: 40,
  fontWeight: 700,
  lineHeight: "48px",
  color: "#1B1D22",
  whiteSpace: "nowrap",
  maxWidth: 1150,
  overflow: "hidden",
  textOverflow: "ellipsis",
  opacity,
});

export const captionStyles = (c) => ({
  pill: {
    position: "absolute",
    left: 64,
    top: 584,
    height: 80,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 18,
    padding: "0 28px 0 16px",
    borderRadius: 40,
    background: "rgba(255,255,255,0.94)",
    boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
    maxWidth: 1150,
    opacity: c.opacity,
    transform: `translateY(${(1 - c.opacity) * 16}px)`,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    background: c.color,
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "none",
  },
  text: { fontSize: 30, fontWeight: 600, color: "#1B1D22", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
});

// ---- plain-DOM renderer ------------------------------------------------------------

const SVGNS = "http://www.w3.org/2000/svg";
const el = (tag, style, parent) => {
  const e = document.createElement(tag);
  if (style) Object.assign(e.style, px(style));
  parent?.appendChild(e);
  return e;
};
// Object.assign(style) needs units on lengths; React adds them, plain DOM doesn't.
const UNITLESS = new Set(["opacity", "fontWeight", "flex", "zIndex"]);
function px(style) {
  const out = {};
  for (const [k, v] of Object.entries(style)) out[k] = typeof v === "number" && !UNITLESS.has(k) ? `${v}px` : v ?? "";
  return out;
}

// Keeps one element per key and only touches the DOM when a style actually changes.
export function createDomRenderer(root) {
  Object.assign(root.style, px(layerStyles.root));
  const stage = el("div", layerStyles.stage, root);
  const routerWorld = el("div", layerStyles.world, stage);
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("width", String(WIDTH));
  svg.setAttribute("height", String(HEIGHT));
  Object.assign(svg.style, px(layerStyles.svg));
  stage.appendChild(svg);
  const objectsWorld = el("div", layerStyles.world, stage);
  const panel = el("div", layerStyles.panel, routerWorld);
  const title = el("div", null, root);
  const captions = el("div", null, root);

  const boxes = new Map();
  const items = new Map();
  const lines = [];
  const applied = new WeakMap();
  const set = (e, style) => {
    const key = JSON.stringify(style);
    if (applied.get(e) === key) return;
    applied.set(e, key);
    e.removeAttribute("style");
    Object.assign(e.style, px(style));
  };

  function renderBoxes(list, parent, seen) {
    for (const b of list) {
      seen.add(b.key);
      let rec = boxes.get(b.key);
      if (!rec) {
        rec = { e: el("div", null, parent), faces: {} };
        boxes.set(b.key, rec);
      }
      rec.e.style.display = "";
      set(rec.e, boxStyle(b));
      for (const name of FACES) {
        const face = b.faces[name];
        let f = rec.faces[name];
        if (!face) {
          if (f) f.e.style.display = "none";
          continue;
        }
        if (!f) f = rec.faces[name] = { e: el("div", null, rec.e), sig: "" };
        f.e.style.display = "";
        set(f.e, faceStyle(name, b));
        const sig = JSON.stringify([face.img, face.dots, b.size]);
        if (sig !== f.sig) {
          f.sig = sig;
          f.e.replaceChildren();
          const im = faceImage(name, b);
          if (im) {
            const wrap = el("div", im.wrap, f.e);
            const img = el("img", im.img, wrap);
            img.src = im.src;
            img.alt = "";
          }
          for (const d of face.dots ?? []) el("div", dotStyle(d), f.e);
        }
      }
    }
  }

  return function render(st) {
    stage.style.opacity = String(st.opacity);
    const world = worldTransform(st.cam);
    routerWorld.style.transform = world;
    objectsWorld.style.transform = world;

    const seen = new Set();
    renderBoxes(st.router, routerWorld, seen);
    renderBoxes(st.objects, objectsWorld, seen);
    for (const [k, rec] of boxes) if (!seen.has(k)) rec.e.style.display = "none";

    const seenItems = new Set();
    for (const it of st.panel) {
      seenItems.add(it.key);
      let e = items.get(it.key);
      if (!e) items.set(it.key, (e = el("div", null, panel)));
      e.style.display = "";
      set(e, panelStyle(it));
    }
    for (const [k, e] of items) if (!seenItems.has(k)) e.style.display = "none";

    let n = 0;
    for (const cable of st.cables) {
      for (const l of cableLines(st.cam, cable)) {
        let e = lines[n];
        if (!e) {
          e = lines[n] = document.createElementNS(SVGNS, "line");
          e.setAttribute("stroke-linecap", "round");
          svg.appendChild(e);
        }
        e.setAttribute("x1", l.x0.toFixed(1));
        e.setAttribute("y1", l.y0.toFixed(1));
        e.setAttribute("x2", l.x1.toFixed(1));
        e.setAttribute("y2", l.y1.toFixed(1));
        e.setAttribute("stroke-width", l.w.toFixed(1));
        e.setAttribute("stroke", l.stroke);
        e.setAttribute("opacity", String(cable.opacity));
        e.style.display = "";
        n++;
      }
    }
    for (let i = n; i < lines.length; i++) lines[i].style.display = "none";

    set(title, titleStyle(st.title.opacity));
    if (title.textContent !== st.title.text) title.textContent = st.title.text;

    while (captions.children.length < st.captions.length) {
      const pill = el("div", null, captions);
      el("span", null, pill);
      el("span", null, pill);
    }
    [...captions.children].forEach((pill, i) => {
      const c = st.captions[i];
      if (!c) {
        pill.style.display = "none";
        applied.delete(pill); // so the pill's own display:flex comes back next time
        return;
      }
      const s = captionStyles(c);
      set(pill, s.pill);
      set(pill.children[0], s.badge);
      set(pill.children[1], s.text);
      if (pill.children[0].textContent !== c.n) pill.children[0].textContent = c.n;
      if (pill.children[1].textContent !== c.text) pill.children[1].textContent = c.text;
    });
  };
}
