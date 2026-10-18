// CSS helpers for drawing a router-scene frame with DOM elements and CSS 3D, plus a
// plain-DOM renderer (used by HyperFrames; Remotion maps the same helpers to JSX).
// Every quad is one element with a matrix3d transform inside a preserve-3d world, so
// the browser sorts them in depth (the router hides what is behind it). The wall sits
// in its own world behind the main one, and things outside the window behind that.
import { HAND, MEDIA, VIEW, WIDTH, HEIGHT, cross3, cssWorld } from "./router-scene.js";

const SHADOW = "radial-gradient(closest-side, rgba(0,0,0,0.28), rgba(0,0,0,0.12) 60%, rgba(0,0,0,0))";
const radius = (r) => (r === "50%" ? "50%" : Array.isArray(r) ? r.map((v) => `${v}px`).join(" ") : r ? `${r}px` : undefined);

export const layerStyles = {
  root: { position: "relative", width: WIDTH, height: HEIGHT, overflow: "hidden", background: "#FFFFFF", fontFamily: "sans-serif" },
  stage: { position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, perspective: `${VIEW.perspective}px`, perspectiveOrigin: "50% 50%" },
  world: { position: "absolute", left: WIDTH / 2, top: VIEW.top, transformStyle: "preserve-3d" },
  svg: { position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" },
};

export const worldTransform = (cam) => cssWorld(cam);

const f = (v) => +v.toFixed(5);
// A face with `res` is laid out `res` times larger and scaled back down by its matrix,
// so the browser rasterises it (e.g. a vector panel) sharply in close-ups.
const scale = (r, k) => (typeof r === "number" ? r * k : Array.isArray(r) ? r.map((v) => v * k) : r);
export function quadStyle(q) {
  const face = q.face;
  const R = face.res ?? 1;
  const n = cross3(q.u, q.v);
  const u = q.u.map((c) => c / R), v = q.v.map((c) => c / R);
  const background = face.shadow
    ? SHADOW
    : face.gradient
      ? `linear-gradient(180deg, ${face.gradient.map(([s, c]) => `${c} ${s * 100}%`).join(", ")})`
      : face.fill;
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: q.w * R,
    height: q.h * R,
    transformOrigin: "0 0",
    transform: `matrix3d(${[...u, 0, ...v, 0, ...n, 0, ...q.o, 1].map(f).join(",")})`,
    backfaceVisibility: q.cull ? "hidden" : "visible",
    boxSizing: "border-box",
    background,
    border: face.stroke ? `${(face.strokeW ?? 1) * R}px solid ${face.stroke}` : undefined,
    borderRadius: radius(scale(face.radius, R)),
    boxShadow: face.glow ? `0 0 ${face.fill ? 14 : 18}px ${face.fill ? 6 : 0}px ${face.glow}` : undefined,
    overflow: face.img ? "hidden" : undefined,
    opacity: q.opacity < 1 ? q.opacity : undefined,
  };
}

// Photo inside a face: the source rectangle, turned by `rot`, stretched to fill the face.
export function faceImage(q) {
  const img = q.face.img;
  if (!img) return null;
  const { media, sx, sy, sw, sh, rot } = img;
  const m = MEDIA[media];
  const R = q.face.res ?? 1;
  const w = q.w * R, h = q.h * R;
  const turned = rot % 180 !== 0;
  const kx = (turned ? h : w) / sw, ky = (turned ? w : h) / sh;
  return {
    src: m.src,
    wrap: {
      position: "absolute",
      left: (w - sw * kx) / 2,
      top: (h - sh * ky) / 2,
      width: sw * kx,
      height: sh * ky,
      overflow: "hidden",
      transform: rot ? `rotate(${rot}deg)` : undefined,
    },
    img: { position: "absolute", left: -sx * kx, top: -sy * ky, width: m.w * kx, height: m.h * ky, maxWidth: "none" },
  };
}

// R: the face's `res` (its children are laid out that many times larger).
export const dotStyle = (d, R = 1) => ({
  position: "absolute",
  left: d.x * R,
  top: d.y * R,
  width: d.w * R,
  height: d.h * R,
  borderRadius: (Math.min(d.w, d.h) / 2) * R,
  background: d.stripes ? `repeating-linear-gradient(90deg, ${d.fill} 0 ${2 * R}px, transparent ${2 * R}px ${4 * R}px)` : d.fill,
  boxShadow: d.glow ? `0 0 ${(d.glowSize ?? 10) * R}px ${((d.glowSize ?? 10) / 2) * R}px ${d.glow}` : undefined,
});

export const handTransform = (o) => `translate(${f(o.x)} ${f(o.y)}) scale(${f(o.s)})`;
export const HAND_SHAPES = HAND;

export const labelStyle = (o) => ({
  position: "absolute",
  left: o.x,
  top: o.y,
  transform: "translate(-50%, -100%)",
  padding: "6px 16px",
  borderRadius: 18,
  background: "rgba(255,255,255,0.95)",
  border: "1px solid #D5DAE0",
  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
  fontSize: 22,
  fontWeight: 600,
  lineHeight: "26px",
  color: "#1B1D22",
  whiteSpace: "nowrap",
  opacity: o.opacity,
});

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
// Object.assign(style) needs units on lengths; React adds them, plain DOM doesn't.
const UNITLESS = new Set(["opacity", "fontWeight", "flex", "zIndex"]);
function px(style) {
  const out = {};
  for (const [k, v] of Object.entries(style)) out[k] = typeof v === "number" && !UNITLESS.has(k) ? `${v}px` : v ?? "";
  return out;
}
const el = (tag, style, parent) => {
  const e = document.createElement(tag);
  if (style) Object.assign(e.style, px(style));
  parent?.appendChild(e);
  return e;
};

// Keeps one element per key and only touches the DOM when something changed.
export function createDomRenderer(root) {
  Object.assign(root.style, px(layerStyles.root));
  const stage = el("div", layerStyles.stage, root);
  const outsideWorld = el("div", layerStyles.world, stage);
  const backWorld = el("div", layerStyles.world, stage);
  const world = el("div", layerStyles.world, stage);
  const layerOf = { outside: outsideWorld, back: backWorld };
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("width", String(WIDTH));
  svg.setAttribute("height", String(HEIGHT));
  Object.assign(svg.style, px(layerStyles.svg));
  root.appendChild(svg);
  const hand = document.createElementNS(SVGNS, "g");
  for (const s of HAND_SHAPES) {
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", s.d);
    p.setAttribute("fill", s.fill);
    if (s.stroke) {
      p.setAttribute("stroke", s.stroke);
      p.setAttribute("stroke-width", "2");
    }
    hand.appendChild(p);
  }
  svg.appendChild(hand);
  const label = el("div", null, root);
  const title = el("div", null, root);
  const captions = el("div", null, root);

  const quads = new Map();
  const applied = new WeakMap();
  const set = (e, style) => {
    const key = JSON.stringify(style);
    if (applied.get(e) === key) return;
    applied.set(e, key);
    e.removeAttribute("style");
    Object.assign(e.style, px(style));
  };
  const hide = (e) => {
    e.style.display = "none";
    applied.delete(e);
  };

  return function render(st) {
    stage.style.opacity = String(st.opacity);
    world.style.transform = backWorld.style.transform = outsideWorld.style.transform = worldTransform(st.cam);

    const seen = new Set();
    for (const q of st.quads) {
      seen.add(q.key);
      let rec = quads.get(q.key);
      if (!rec) quads.set(q.key, (rec = { e: el("div", null, layerOf[q.layer] ?? world), sig: "" }));
      set(rec.e, quadStyle(q));
      const sig = JSON.stringify([q.face.img, q.face.dots, q.w, q.h]);
      if (sig !== rec.sig) {
        rec.sig = sig;
        rec.e.replaceChildren();
        const im = faceImage(q);
        if (im) {
          const wrap = el("div", im.wrap, rec.e);
          const img = el("img", im.img, wrap);
          img.src = im.src;
          img.alt = "";
        }
        for (const d of q.face.dots ?? []) el("div", dotStyle(d, q.face.res), rec.e);
      }
    }
    for (const [k, rec] of quads) if (!seen.has(k)) hide(rec.e);

    const h = st.overlays.find((o) => o.type === "hand");
    hand.style.display = h ? "" : "none";
    if (h) {
      hand.setAttribute("transform", handTransform(h));
      hand.setAttribute("opacity", String(h.opacity));
    }
    const l = st.overlays.find((o) => o.type === "label");
    if (l) {
      set(label, labelStyle(l));
      if (label.textContent !== l.text) label.textContent = l.text;
    } else hide(label);

    set(title, titleStyle(st.title.opacity));
    if (title.textContent !== st.title.text) title.textContent = st.title.text;

    while (captions.children.length < st.captions.length) {
      const pill = el("div", null, captions);
      el("span", null, pill);
      el("span", null, pill);
    }
    [...captions.children].forEach((pill, i) => {
      const c = st.captions[i];
      if (!c) return hide(pill);
      const s = captionStyles(c);
      set(pill, s.pill);
      set(pill.children[0], s.badge);
      set(pill.children[1], s.text);
      if (pill.children[0].textContent !== c.n) pill.children[0].textContent = c.n;
      if (pill.children[1].textContent !== c.text) pill.children[1].textContent = c.text;
    });
  };
}
