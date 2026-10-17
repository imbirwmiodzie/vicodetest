// Centro Business 3.0 setup animation, described independently of any framework.
//
// frameState(t, cfg) returns everything visible at time t (seconds): a camera, a list
// of flat quads in world space (router, plugs, USB stick, cables, wall and window,
// panel highlights) and a few 2D overlays (hand, cable label, title, captions).
// Remotion and HyperFrames draw the quads with CSS 3D, Revideo projects them onto
// its canvas, so all three play exactly the same scene.
//
// World units are pixels of the 1360x260 back-panel photo: +x right, +y down,
// +z out of the back panel. The back panel is z = 0, the front panel z = -1000.
//
// The steps are configurable (ethernet / direct / extension), so the length of the
// animation depends on the config: see timeline(cfg).

export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 720;

export const MEDIA = {
  router: { src: "/media/cb3-back.png", w: 1360, h: 260 },
  routerFront: { src: "/media/cb3-front.png", w: 1790, h: 1042 },
  stickFront: { src: "/media/tcl-ik41-front.jpeg", w: 540, h: 946 },
  stickEdge: { src: "/media/tcl-ik41-edge.jpeg", w: 444, h: 936 },
};

export const DEFAULTS = {
  title: "Centro Business 3.0",
  ethernet: true,
  port: 1,
  direct: true,
  extension: true,
  usbPort: "front",
  stepEthernet: "Connect the Ethernet cable to port {port}",
  stepDirect: "Plug the TCL LinkKey IK41 into the {usb}",
  stepExtension: "Plug the IK41 into the USB extension cable",
  stepExtensionRouter: "Connect the extension cable to the {usb}",
  stepWindow: "Place the stick near a window for better reception",
  cableLabel: "USB extension cable: up to 10 m",
  done: "Ready: mobile backup connected",
  cableColor: "#E4E7EB",
  usbCableColor: "#2B2D33",
  ledColor: "#38E07B",
  accentColor: "#0F6FDE",
  speed: 1,
  loop: true,
};

const COLOR_KEYS = ["cableColor", "usbCableColor", "ledColor", "accentColor"];
const TEXT_KEYS = ["title", "stepEthernet", "stepDirect", "stepExtension", "stepExtensionRouter", "stepWindow", "cableLabel", "done"];
const BOOL_KEYS = ["ethernet", "direct", "extension", "loop"];

// Validates a raw config object; invalid or missing fields fall back to DEFAULTS.
export function normalize(raw, isColor = (c) => typeof CSS === "undefined" || CSS.supports("color", c)) {
  const r = raw && typeof raw === "object" ? raw : {};
  const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const out = { ...DEFAULTS };
  for (const k of TEXT_KEYS) if (typeof r[k] === "string") out[k] = r[k];
  for (const k of COLOR_KEYS) if (typeof r[k] === "string" && isColor(r[k])) out[k] = r[k];
  for (const k of BOOL_KEYS) if (typeof r[k] === "boolean") out[k] = r[k];
  out.usbPort = r.usbPort === "back" ? "back" : "front";
  out.port = Math.min(5, Math.max(1, Math.round(num(r.port, 1))));
  out.speed = Math.min(4, Math.max(0.1, num(r.speed, 1)));
  return out;
}

// ---- timeline ---------------------------------------------------------------------

const ACT = { intro: 1.1, ethernet: 3.4, direct: 4.2, extPlug: 3.8, extRouter: 3.4, window: 4.6, done: 2.8, outro: 1.4 };
// Longest possible animation (every step on), e.g. for a fixed-length composition.
export const MAX_DURATION_S = Object.values(ACT).reduce((a, b) => a + b, 0);

// Start time of each enabled step, total duration and where loop:false stops.
export function timeline(cfg) {
  const at = {};
  let t = 0;
  const add = (name, on) => {
    if (!on) return;
    at[name] = t;
    t += ACT[name];
  };
  add("intro", true);
  add("ethernet", cfg.ethernet);
  add("direct", cfg.direct);
  add("extPlug", cfg.extension);
  add("extRouter", cfg.extension);
  add("window", cfg.extension);
  add("done", true);
  const holdEnd = t;
  add("outro", true);
  return { at, duration: t, holdEnd };
}

// ---- vectors and camera -------------------------------------------------------------

const RAD = Math.PI / 180;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const norm3 = (a) => mul3(a, 1 / (len3(a) || 1));

// Equivalent CSS: a 1280x720 container with `perspective: 1600px` (origin at its
// centre) holding a zero-size element at (640, 380) with transform cssWorld(cam).
export const VIEW = { perspective: 1600, top: 380 };

export function cssWorld(cam) {
  return `translateZ(${cam.zoom}px) rotateX(${cam.rotX}deg) rotateY(${cam.rotY}deg) translate3d(${-cam.fx}px, ${-cam.fy}px, ${-cam.fz}px)`;
}

// World point -> view space [x, y, z] (z towards the viewer, before perspective).
export function toView(cam, p) {
  const cy = Math.cos(cam.rotY * RAD), sy = Math.sin(cam.rotY * RAD);
  const cx = Math.cos(cam.rotX * RAD), sx = Math.sin(cam.rotX * RAD);
  const x = p[0] - cam.fx, y = p[1] - cam.fy, z = p[2] - cam.fz;
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
  return [x1, y * cx - z1 * sx + (VIEW.top - HEIGHT / 2), y * sx + z1 * cx + cam.zoom];
}

// View space -> screen [x, y, scale]; scale <= 0 means behind the camera.
export function viewToScreen(v) {
  const s = VIEW.perspective / (VIEW.perspective - v[2]);
  return [WIDTH / 2 + v[0] * s, HEIGHT / 2 + v[1] * s, s];
}

export const project = (cam, p) => viewToScreen(toView(cam, p));

// Camera position in world space (toView inverted for the eye point).
export function eye(cam) {
  const v = [0, -(VIEW.top - HEIGHT / 2), VIEW.perspective - cam.zoom];
  const cx = Math.cos(cam.rotX * RAD), sx = Math.sin(cam.rotX * RAD);
  const y1 = v[1] * cx + v[2] * sx, z1 = -v[1] * sx + v[2] * cx;
  const cy = Math.cos(cam.rotY * RAD), sy = Math.sin(cam.rotY * RAD);
  return [v[0] * cy - z1 * sy + cam.fx, y1 + cam.fy, v[0] * sy + z1 * cy + cam.fz];
}

// Object pose: rotateX(rx), then rotateY(ry) (degrees), then translate.
function poseApply(pose, q) {
  const ax = (pose.rx || 0) * RAD, ay = (pose.ry || 0) * RAD;
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
  const y1 = q[1] * cx - q[2] * sx, z1 = q[1] * sx + q[2] * cx;
  return [pose.x + q[0] * cy + z1 * sy, pose.y + y1, pose.z - q[0] * sy + z1 * cy];
}
const poseDir = (pose, d) => poseApply({ ...pose, x: 0, y: 0, z: 0 }, d);

// ---- quads ------------------------------------------------------------------------

// A quad is a w x h rectangle at o spanned by unit vectors u (its x) and v (its y);
// its front side faces u x v. Face spec (all optional):
//   fill, stroke, strokeW, radius (number, [tl,tr,br,bl] or "50%"), glow,
//   gradient: [[stop, colour], ...] along v, shadow (soft contact shadow),
//   img: { media, sx, sy, sw, sh, rot } (source rect turned by rot, stretched to fill),
//   dots: [{ x, y, w, h, fill, glow?, glowSize?, stripes? }] (in face pixels).
// ground: drawn before everything else (shadows); layer "back": the wall, drawn behind
// everything; cull: hide the back side.
function quad(key, o, u, v, w, h, face, opacity = 1, extra = {}) {
  return { key, o, u, v, w, h, face, opacity, cull: true, ...extra };
}

// Faces of a box in its local frame: [width, height, top-left, u, v].
function faceFrame(name, w, h, d) {
  const W = w / 2, H = h / 2, D = d / 2;
  switch (name) {
    case "front": return [w, h, [-W, -H, D], [1, 0, 0], [0, 1, 0]];
    case "back": return [w, h, [W, -H, -D], [-1, 0, 0], [0, 1, 0]];
    case "right": return [d, h, [W, -H, D], [0, 0, -1], [0, 1, 0]];
    case "left": return [d, h, [-W, -H, -D], [0, 0, 1], [0, 1, 0]];
    case "top": return [w, d, [-W, -H, -D], [1, 0, 0], [0, 0, 1]];
    case "bottom": return [w, d, [-W, H, D], [1, 0, 0], [0, 0, -1]];
  }
}

// Box centred at (cx, cy) spanning z0..z1 in its pose's frame.
function box(key, pose, cx, cy, z0, z1, w, h, faces, opacity = 1) {
  const d = z1 - z0;
  if (d < 0.5) return [];
  const c = [cx, cy, (z0 + z1) / 2];
  const out = [];
  for (const [name, face] of Object.entries(faces)) {
    if (!face) continue;
    const [fw, fh, tl, u, v] = faceFrame(name, w, h, d);
    out.push(quad(`${key}-${name}`, poseApply(pose, add3(c, tl)), poseDir(pose, u), poseDir(pose, v), fw, fh, face, opacity, face.ground ? { ground: true } : {}));
  }
  return out;
}

// Light from above and slightly behind the viewer, for the plain faces of rounded parts.
const LIGHT = norm3([0.25, -1, 0.55]);
function shadeRGB(hex, k) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c) => Math.round(Math.min(255, Math.max(0, k >= 0 ? c * (1 - k) : c + (255 - c) * -k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
const lit = (hex, normal) => shadeRGB(hex, 0.3 - 0.45 * Math.max(0, dot3(normal, LIGHT)));

// Rounded prism: a w x h rounded-rectangle cross-section (corner radius r, n facets per
// corner) extruded from z0 to z1 in its pose's frame. Walls run along the length with
// u = -z (u = 0 at the far end z1) and v around the perimeter; the four flat walls can
// carry photos (faces.right / left / top / bottom); faces.far / near style the end caps.
function roundedPrism(key, pose, z0, z1, w, h, r, n, color, faces = {}, opacity = 1) {
  const L = z1 - z0;
  if (L < 0.5) return [];
  const out = [];
  const W = w / 2, H = h / 2;
  const wall = (name, p0, p1, normal, face) => {
    const t = sub3(p1, p0), len = len3(t);
    if (len < 0.01) return;
    out.push(
      quad(`${key}-${name}`, poseApply(pose, [p0[0], p0[1], z1]), poseDir(pose, [0, 0, -1]), poseDir(pose, norm3(t)), L, len,
        face ?? { fill: lit(color, poseDir(pose, normal)) }, opacity),
    );
  };
  // Clockwise on screen (y down): right wall, bottom-right corner, bottom wall, ...
  const corners = [[W - r, H - r, 0], [-W + r, H - r, 90], [-W + r, -H + r, 180], [W - r, -H + r, 270]];
  const flats = [
    ["right", [W, -H + r, 0], [W, H - r, 0], [1, 0, 0]],
    ["bottom", [W - r, H, 0], [-W + r, H, 0], [0, 1, 0]],
    ["left", [-W, H - r, 0], [-W, -H + r, 0], [-1, 0, 0]],
    ["top", [-W + r, -H, 0], [W - r, -H, 0], [0, -1, 0]],
  ];
  flats.forEach(([name, p0, p1, nrm], i) => {
    wall(name, p0, p1, nrm, faces[name]);
    const [cx, cy, a0] = corners[i];
    for (let k = 0; k < n; k++) {
      const t0 = (a0 + (90 * k) / n) * RAD, t1 = (a0 + (90 * (k + 1)) / n) * RAD, tm = (t0 + t1) / 2;
      wall(`${name}-c${k}`, [cx + r * Math.cos(t0), cy + r * Math.sin(t0), 0], [cx + r * Math.cos(t1), cy + r * Math.sin(t1), 0], [Math.cos(tm), Math.sin(tm), 0]);
    }
  });
  const cap = (name, o, u, normal, face) =>
    out.push(quad(`${key}-${name}`, poseApply(pose, o), poseDir(pose, u), poseDir(pose, [0, 1, 0]), w, h,
      { fill: lit(color, poseDir(pose, normal)), radius: r, ...face }, opacity));
  cap("far", [-W, -H, z1], [1, 0, 0], [0, 0, 1], faces.far);
  cap("near", [W, -H, z0], [-1, 0, 0], [0, 0, -1], faces.near);
  return out;
}

// Cable: one camera-facing strip per segment, shaded across its width so it reads as
// a round tube from any angle. Segments overlap a little to close the joints.
function cable(key, pts, r, color, cam, opacity = 1) {
  const e = eye(cam);
  const dark = shadeRGB(color, 0.45), light = shadeRGB(color, -0.45);
  const face = { gradient: [[0, dark], [0.25, color], [0.42, light], [0.6, color], [1, dark]] };
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const d = sub3(b, a), len = len3(d);
    if (len < 0.01) continue;
    const u = mul3(d, 1 / len);
    const side = norm3(cross3(u, sub3(e, a)));
    // v = -side makes u x v point at the camera.
    const o = add3(sub3(a, mul3(u, r * 0.5)), mul3(side, r));
    out.push(quad(`${key}-${i}`, o, u, mul3(side, -1), len + r, 2 * r, face, opacity));
  }
  return out;
}

function cubic(out, p0, p1, p2, p3, n) {
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    out.push([0, 1, 2].map((j) => a * p0[j] + b * p1[j] + c * p2[j] + d * p3[j]));
  }
}

function line(out, p, n) {
  const p0 = out[out.length - 1];
  for (let i = 1; i <= n; i++) out.push(p0.map((v, j) => v + ((p[j] - v) * i) / n));
}

// ---- geometry measured on the photos ------------------------------------------------

export const BODY = { x0: 49, x1: 1305, y0: 10, y1: 232, depth: 1000 };
export const DESK = 250; // desk surface (bottom of the router's feet)
const PORTS = [
  { x: 345.5, led: [366, 98, 14, 9] },
  { x: 422, led: [443, 98, 13, 9] },
  { x: 498.5, led: [519, 98, 14, 9] },
  { x: 574.5, led: [596, 98, 13, 9] },
  { x: 668, led: [690, 97, 11, 9] },
];
const PORT_Y = 121;
const FW = BODY.x1 - BODY.x0, FH = BODY.y1 - BODY.y0;

// Front panel: the standing router's front strip in the ports/LED photo, turned 90
// degrees clockwise onto the lying router's front face.
const FRONT_IMG = { sx: 472, sy: 30, sw: 133, sh: 900 };
// Photo rect -> front face rect [u, v, w, h] (u runs from x = BODY.x1 towards BODY.x0).
function frontRect(x0, y0, x1, y1) {
  const ku = FW / FRONT_IMG.sh, kv = FH / FRONT_IMG.sw;
  const u0 = (FRONT_IMG.sh - (y1 - FRONT_IMG.sy)) * ku, u1 = (FRONT_IMG.sh - (y0 - FRONT_IMG.sy)) * ku;
  return [u0, (x0 - FRONT_IMG.sx) * kv, u1 - u0, (x1 - x0) * kv];
}
const FRONT_LEDS = { mobile: frontRect(479, 434, 497, 445), power: frontRect(479, 539, 497, 550) };
const usbFront = frontRect(510, 811, 557, 835);

export const USB = {
  back: { x: 1027.5, y: 120, name: "USB 2.0 port on the back" },
  front: { x: BODY.x1 - (usbFront[0] + usbFront[2] / 2), y: BODY.y0 + usbFront[1] + usbFront[3] / 2, name: "front USB 3.0 port" },
};

// IK41: body 27.6 x 11 x 69 mm at 5.45 px/mm; collar and USB-A plug in front of it.
const STICK = { w: 59, h: 150, len: 378, r: 18, collarW: 54, collarH: 139, collar: 30 };
const USB_PLUG = { w: 24, h: 64, len: 64 };
const MALE = { w: 60, h: 96, len: 120 };
const DOCK = { w: 90, h: 150, d: 90 };
const WALL = { x: 3000, y0: -1150, z0: -2700, z1: 1500 };

// ---- easing and timing ------------------------------------------------------------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const lerp = (a, b, p) => a + (b - a) * p;
const pulse = (t, a, b, hz = 1.2) => (t >= a && t < b ? 0.5 + 0.5 * Math.sin((t - a) * 2 * Math.PI * hz) : 0);
// Distance still to travel: eases from `far` to `near` over [a, b], then snaps in ("click").
const travel = (t, a, b, far, near = 12, snap = 0.2) =>
  t < b ? lerp(far, near, easeOutCubic(prog(t, a, b))) : near * (1 - easeInCubic(prog(t, b, b + snap)));
const lerpAngle = (a, b, p) => a + (((((b - a) % 360) + 540) % 360) - 180) * p;
const lerpPose = (a, b, p, lift = 0) => ({
  x: lerp(a.x, b.x, p),
  y: lerp(a.y, b.y, p) - lift * Math.sin(Math.PI * p),
  z: lerp(a.z, b.z, p),
  ry: lerpAngle(a.ry || 0, b.ry || 0, p),
  rx: lerp(a.rx || 0, b.rx || 0, p),
});

// ---- cameras ----------------------------------------------------------------------

const BACK_Y = -32, FRONT_Y = 148, RX = -14;
const FRONT_Z = -BODY.depth;
function cams(side, cfg) {
  const back = side === "back";
  const usb = USB[side];
  const overview = { fx: 800, fy: 160, fz: 160, zoom: -560, rotY: BACK_Y, rotX: RX };
  const c = {
    start: { ...overview, zoom: -760 },
    overview,
    usb: back
      ? { fx: usb.x - 40, fy: usb.y + 30, fz: 260, zoom: 420, rotY: BACK_Y, rotX: RX }
      : { fx: usb.x + 40, fy: usb.y + 30, fz: FRONT_Z - 260, zoom: 420, rotY: FRONT_Y, rotX: RX },
    dock: back
      ? { fx: 1400, fy: 20, fz: 220, zoom: -380, rotY: BACK_Y, rotX: RX }
      : { fx: 1330, fy: 20, fz: FRONT_Z - 260, zoom: -380, rotY: FRONT_Y, rotX: RX },
    plug: back
      ? { fx: 1250, fy: 80, fz: 220, zoom: -120, rotY: BACK_Y, rotX: RX }
      : { fx: 1300, fy: 80, fz: FRONT_Z - 220, zoom: -120, rotY: FRONT_Y, rotX: RX },
    window: back
      ? { fx: 2150, fy: -230, fz: 300, zoom: -1350, rotY: 66, rotX: -12 }
      : { fx: 2150, fy: -230, fz: FRONT_Z - 350, zoom: -1350, rotY: 114, rotX: -12 },
  };
  c.final = cfg.extension
    ? { ...c.window, zoom: c.window.zoom - 150 }
    : cfg.direct && !back
      ? { fx: 800, fy: 160, fz: FRONT_Z - 160, zoom: -560, rotY: FRONT_Y, rotX: RX }
      : overview;
  return c;
}
const portCam = (x) => ({ fx: x + 40, fy: PORT_Y + 10, fz: 110, zoom: 900, rotY: BACK_Y, rotX: RX });

// ---- static scene -----------------------------------------------------------------

function routerQuads() {
  const origin = { x: 0, y: 0, z: 0 };
  const quads = [
    ...box("router-shadow", origin, BODY.x0 + FW / 2, DESK, FRONT_Z - 200, 200, FW + 280, 0, {
      top: { shadow: true, ground: true },
    }),
    ...box("router", origin, BODY.x0 + FW / 2, BODY.y0 + FH / 2, FRONT_Z, 0, FW, FH, {
      front: { fill: "#363944", radius: 10, img: { media: "router", sx: BODY.x0, sy: BODY.y0, sw: FW, sh: FH, rot: 0 } },
      back: { fill: "#2C3034", radius: 10, img: { media: "routerFront", ...FRONT_IMG, rot: 90 } },
      top: { fill: "#3D404B", radius: 10 },
      right: { fill: "#30333B" },
      left: { fill: "#30333B" },
    }),
  ];
  // The canvas renderer orders everything else around this convex box.
  for (const q of quads) if (q.key.startsWith("router-") && q.key !== "router-shadow-top") q.solid = "router";
  return quads;
}

// Wall with a window to the right of the router. It faces -x, so it is only seen in
// the front and window shots; skipped entirely when it faces away from the camera.
function wallQuads(cam, zc, opacity) {
  if (eye(cam)[0] > WALL.x) return [];
  const u = [0, 0, 1], v = [0, 1, 0];
  const out = [quad("wall", [WALL.x, WALL.y0, WALL.z0], u, v, WALL.z1 - WALL.z0, DESK - WALL.y0, { gradient: [[0, "#E4E7EC"], [1, "#D9DDE3"]] })];
  // Window: glass with the frame and the middle bar drawn on it.
  const w = 900, top = -820, bottom = DESK - 40, h = bottom - top;
  out.push(quad("window", [WALL.x - 4, top, zc - w / 2], u, v, w, h, {
    gradient: [[0, "#9CC9F0"], [0.55, "#D6ECFB"], [1, "#F4FAFE"]],
    stroke: "#FFFFFF",
    strokeW: 28,
    dots: [{ x: w / 2 - 9, y: 0, w: 18, h, fill: "#FFFFFF" }, { x: 0, y: h * 0.38, w, h: 14, fill: "#FFFFFF" }],
  }));
  // Always the farthest thing in view: renderers draw this layer first (CSS gets a
  // separate layer, which also keeps Chrome's depth sorting away from the huge plane).
  for (const q of out) Object.assign(q, { opacity, layer: "back" });
  return out;
}

// Things drawn on a panel surface (back: z = +1, front: z = -depth - 1), in panel x/y.
function panelQuad(key, side, x, y, w, h, face, opacity = 1) {
  return side === "back"
    ? quad(key, [x, y, 1], [1, 0, 0], [0, 1, 0], w, h, face, opacity)
    : quad(key, [x + w, y, FRONT_Z - 1], [-1, 0, 0], [0, 1, 0], w, h, face, opacity);
}

// ---- moving parts -----------------------------------------------------------------

function ethernetPlug(x, gap, color) {
  const pose = { x: 0, y: 0, z: 0 };
  const y = PORT_Y + 2;
  const plastic = { fill: "rgba(232,236,240,0.82)", stroke: "rgba(150,160,170,0.9)" };
  const contacts = { ...plastic, dots: [{ x: 4, y: 4, w: 22, h: 8, fill: "#C9A23A", stripes: true }] };
  const boot = (k) => ({ fill: shadeRGB(color, k) });
  return [
    ...box("eth-body", pose, x, y, Math.max(0, gap - 100), gap + 20, 58, 44, {
      front: plastic, top: plastic, right: contacts, left: plastic, bottom: plastic,
    }),
    ...box("eth-latch", pose, x, y - 27, Math.max(0, gap - 55), gap + 15, 22, 10, {
      front: plastic, top: plastic, right: plastic, left: plastic,
    }),
    ...box("eth-boot", pose, x, y, gap + 20, gap + 110, 52, 40, {
      front: boot(0.05), top: boot(0), right: boot(0.12), left: boot(0.12), bottom: boot(0.25),
    }),
  ];
}

function ethernetCablePts(x, gap) {
  const y0 = PORT_Y + 2, z0 = gap + 110, yd = DESK - 15;
  const pts = [[x, y0, z0]];
  cubic(pts, [x, y0, z0 + 40], [x, y0, z0 + 200], [x, yd, z0 + 150], [x, yd, z0 + 300], 16);
  line(pts, [x, yd, Math.max(1150, z0 + 420)], 6);
  return pts;
}

// USB-A plug pointing to -z with its base at z = 0; `inserted` hides the part in a socket.
function usbPlug(key, pose, inserted) {
  const metal = { fill: "#D5D9DE" };
  return box(key, pose, 0, 0, -(USB_PLUG.len - inserted), 0, USB_PLUG.w, USB_PLUG.h, {
    right: metal, left: metal, top: { fill: "#EDEFF2" }, bottom: { fill: "#A9AEB6" }, front: metal,
  });
}

// Stick in its own frame: plug points to -z, collar at z = 0..30, body behind it.
function stick(pose, inserted, led) {
  const s = STICK;
  const dark = "#2A2C31";
  // Photos cropped by the corner radius on both sides, so the rounded edges aren't doubled.
  const kf = 268 / s.h, ke = 106 / s.w;
  const front = {
    fill: dark,
    img: { media: "stickFront", sx: 136 + s.r * kf, sy: 240, sw: 268 - 2 * s.r * kf, sh: 655, rot: 90 },
    // The photo's LED slit (270, 749), in face pixels of the turned photo.
    dots: led > 0 ? [{ x: 86, y: 75 - s.r - 6, w: 4, h: 12, fill: "#5EC8FF", glow: `rgba(94,200,255,${led})`, glowSize: 6 + 6 * led }] : [],
  };
  // Edge photo with the LTE1/LTE2 antenna caps.
  const edge = { fill: dark, img: { media: "stickEdge", sx: 167 + s.r * ke, sy: 215, sw: 106 - 2 * s.r * ke, sh: 677, rot: 90 } };
  return [
    ...usbPlug("stick-plug", pose, inserted),
    ...roundedPrism("stick-collar", pose, 0, s.collar, s.collarW, s.collarH, 14, 2, "#2E3035"),
    ...roundedPrism("stick-body", pose, s.collar, s.collar + s.len, s.w, s.h, s.r, 4, dark, { right: front, top: edge }),
  ];
}

function extensionMale(pose, inserted, color) {
  return [
    ...usbPlug("ext-plug", pose, inserted),
    ...roundedPrism("ext-male", pose, 0, MALE.len, MALE.w, MALE.h, 12, 2, color),
  ];
}

// Female end of the extension cable, standing on the desk (pose at its foot).
function dock(pose, color) {
  // rx = 90 turns the prism's axis upright: foot at z = 0, socket face at z = DOCK.h.
  const upright = { ...pose, rx: 90 };
  return [
    ...box("dock-shadow", { ...pose, y: DESK }, 0, 0, -DOCK.d, DOCK.d, DOCK.w * 2.2, 0, { top: { shadow: true, ground: true } }),
    ...roundedPrism("dock", upright, 0, DOCK.h, DOCK.w, DOCK.d, 14, 2, color, {
      far: { dots: [{ x: DOCK.w / 2 - 14, y: DOCK.d / 2 - 34, w: 28, h: 68, fill: "#0B0C0E" }] },
    }),
  ];
}

// ---- 2D overlays -------------------------------------------------------------------

// Cartoon hand gripping the stick, in world-sized units around the grip point:
// sleeve, back of the hand, thumb, four fingers across the front of the stick.
export const HAND = [
  { d: "M28 -46 L72 -40 L190 -360 L110 -390 Z", fill: "#3C5A80" },
  { d: "M18 -78 C70 -96 120 -60 112 4 C106 52 70 84 26 80 Z", fill: "#D9A07A" },
  { d: "M60 -86 C92 -120 112 -150 96 -166 C80 -176 60 -150 44 -112 Z", fill: "#EDB98E", stroke: "#C2865C" },
  ...[-64, -30, 4, 38].map((y, i) => ({
    d: `M${44 - i * 2} ${y} L${-58 + i * 4} ${y} A15 15 0 0 0 ${-58 + i * 4} ${y + 30} L${44 - i * 2} ${y + 30} Z`,
    fill: "#F0C29A",
    stroke: "#C2865C",
  })),
];

// ---- the frame ---------------------------------------------------------------------

const ROUTER = routerQuads();

export function frameState(t, cfg) {
  const tl = timeline(cfg);
  // Local time in a step, or null if the step is off or hasn't started yet.
  const L = (name) => (tl.at[name] === undefined || t < tl.at[name] ? null : t - tl.at[name]);
  const side = cfg.usbPort;
  const usb = USB[side];
  const C = cams(side, cfg);
  const portN = clamp(Math.round(cfg.port) || 1, 1, 5);
  const port = PORTS[portN - 1];
  const accent = cfg.accentColor;
  const fadeOut = 1 - easeInCubic(prog(t, tl.holdEnd, tl.holdEnd + 0.8));
  const portPose = (gap) => (side === "back" ? { x: usb.x, y: usb.y, z: gap } : { x: usb.x, y: usb.y, z: FRONT_Z - gap, ry: 180 });

  // Camera: each step eases from wherever the camera is to its own shot.
  let cam = C.start;
  // Orbits between the back and the front pull the camera back on the way, so it
  // swings around the router instead of through it.
  const move = (local, a, b, to, ease = easeInOutCubic) => {
    if (local === null || local < a) return;
    const p = ease(prog(local, a, b));
    const turn = Math.abs(lerpAngle(cam.rotY, to.rotY, 1) - cam.rotY);
    const next = Object.fromEntries(Object.keys(cam).map((k) => [k, k === "rotY" ? lerpAngle(cam[k], to[k], p) : lerp(cam[k], to[k], p)]));
    next.zoom -= 1400 * Math.min(1, turn / 120) * Math.sin(Math.PI * p);
    cam = next;
  };
  move(L("intro"), 0.3, 1.1, C.overview, easeOutCubic);
  move(L("ethernet"), 0, 1.0, portCam(port.x));
  move(L("direct"), 0, 1.2, C.usb);
  move(L("extPlug"), 0, 1.2, C.dock);
  move(L("extRouter"), 0, 1.0, C.plug);
  move(L("window"), 0, 1.4, C.window);
  move(L("done"), 0, 1.0, C.final);

  const quads = [...ROUTER];
  const cables = [];
  const overlays = [];

  // Ethernet.
  const le = L("ethernet");
  if (le !== null) {
    if (le >= 1.0) {
      const gap = travel(le, 1.0, 2.5, 520, 14);
      quads.push(...ethernetPlug(port.x, gap, cfg.cableColor));
      cables.push(["eth-cable", ethernetCablePts(port.x, gap), 15, cfg.cableColor, 1]);
    }
    const hl = pulse(le, 0.5, 2.7);
    if (hl > 0) quads.push(panelQuad("hl-port", "back", port.x - 40, 88, 80, 72, outline(accent), 0.35 + 0.65 * hl));
    ripple(quads, "rp-port", "back", port.x, PORT_Y, prog(le, 2.7, 3.2), accent);
    if (le >= 2.9 && Math.floor((le - 2.9) * 8) % 6 !== 3) {
      const [x, y, w, h] = port.led;
      quads.push(panelQuad("led", "back", x, y, w, h, { fill: cfg.ledColor, radius: 2, glow: cfg.ledColor }));
    }
  }

  // USB stick: straight into the router, then onto the extension cable, then to the window.
  const ld = L("direct"), lx = L("extPlug"), lr = L("extRouter"), lw = L("window");
  const deskPose = side === "back" ? { x: 1720, y: DESK, z: 170, ry: -50 } : { x: 1560, y: DESK, z: FRONT_Z - 330, ry: 125 };
  const winZ = side === "back" ? 350 : FRONT_Z - 450;
  // At the window the logo side faces the window shot's camera.
  const winPose = { x: WALL.x - 150, y: DESK - 40, z: winZ, ry: side === "back" ? -156 : 156 };
  const docked = (dp, gap) => ({ x: dp.x, y: dp.y - DOCK.h - gap, z: dp.z, ry: dp.ry, rx: 90 });
  const hover = docked(deskPose, 140);

  let stickPose = null, stickIns = 0, stickLed = 0, mobileLed = false;
  let dockPose = null, male = null;

  if (ld !== null && ld >= 1.2 && (lx === null || lx < 0.7)) {
    let gap = travel(ld, 1.2, 2.7, 420, 12);
    if (lx !== null) gap = lerp(0, 260, easeInOutCubic(prog(lx, 0, 0.7)));
    stickPose = portPose(gap);
    stickIns = clamp(USB_PLUG.len - gap, 0, USB_PLUG.len);
    if (ld >= 3.1 && (lx === null || lx < 0.05)) {
      stickLed = blink(ld - 3.1);
      mobileLed = side === "front";
    }
  }
  if (ld !== null) {
    const hl = pulse(ld, 0.6, 2.9);
    if (hl > 0) quads.push(panelQuad("hl-usb", side, usb.x - 24, usb.y - 42, 48, 84, outline(accent), 0.35 + 0.65 * hl));
    ripple(quads, "rp-usb1", side, usb.x, usb.y, prog(ld, 2.9, 3.4), accent);
  }

  if (lx !== null && lx >= 0.8) {
    // The extension cable drops onto the desk next to the router.
    const drop = (1 - easeOutCubic(prog(lx, 0.8, 1.3))) * 450;
    dockPose = { ...deskPose, y: deskPose.y - drop };
    const rest = restMale(side, usb);
    male = { pose: { ...rest, y: rest.y - drop }, ins: 0 };
  }
  if (lx !== null) {
    if (lx >= 0.4 && (lx >= 0.7 || ld === null)) {
      const from = ld !== null ? portPose(260) : { ...hover, y: hover.y - 700 };
      const gap = travel(lx, 2.3, 3.1, 140, 10);
      if (lx < 1.9) stickPose = lerpPose(from, hover, easeInOutCubic(prog(lx, ld !== null ? 0.7 : 0.4, 1.9)), ld !== null ? 80 : 0);
      else stickPose = docked(deskPose, gap);
      stickIns = lx < 1.9 ? 0 : clamp(USB_PLUG.len - gap, 0, USB_PLUG.len);
    }
  }
  if (lr !== null) {
    // Extension male end: from its rest spot on the desk to in front of the port, then in.
    const ready = portPose(300);
    const gap = travel(lr, 0.9, 2.0, 300, 12);
    const pose = lr < 0.9 ? lerpPose(restMale(side, usb), ready, easeInOutCubic(prog(lr, 0.3, 0.9)), 60) : portPose(gap);
    male = { pose, ins: lr < 0.9 ? 0 : clamp(USB_PLUG.len - gap, 0, USB_PLUG.len) };
    const hl = pulse(lr, 0.4, 2.2);
    if (hl > 0) quads.push(panelQuad("hl-usb2", side, usb.x - 24, usb.y - 42, 48, 84, outline(accent), 0.35 + 0.65 * hl));
    ripple(quads, "rp-usb2", side, usb.x, usb.y, prog(lr, 2.2, 2.7), accent);
    if (lr >= 2.5) {
      stickLed = blink(lr - 2.5);
      mobileLed = side === "front";
    }
  }
  if (lw !== null) {
    // A hand lifts the stick (with the cable's end) and carries it to the window sill.
    dockPose = lw <= 3.2 ? lerpPose(deskPose, winPose, easeInOutCubic(prog(lw, 0.8, 3.2)), 220) : winPose;
    stickLed = blink(lw);
    mobileLed = side === "front";
  }
  if (dockPose && (lr !== null || (lx !== null && lx >= 3.3))) {
    stickPose = docked(dockPose, 0);
    stickIns = USB_PLUG.len;
  }

  if (stickPose) quads.push(...stick(stickPose, stickIns, stickLed));
  if (dockPose) quads.push(...dock(dockPose, cfg.usbCableColor));
  if (male) {
    quads.push(...extensionMale(male.pose, male.ins, cfg.usbCableColor));
    cables.push(["ext-cable", extensionCablePts(male.pose, dockPose), 10, cfg.usbCableColor, 1]);
  }
  if (mobileLed) {
    const [u, v, w, h] = FRONT_LEDS.mobile;
    quads.push(panelQuad("led-mobile", "front", BODY.x1 - u - w, BODY.y0 + v, w, h, { fill: cfg.ledColor, radius: 3, glow: cfg.ledColor }));
  }
  {
    const [u, v, w, h] = FRONT_LEDS.power;
    quads.push(panelQuad("led-power", "front", BODY.x1 - u - w, BODY.y0 + v, w, h, { fill: "#F4F6F8", radius: 3, glow: "#FFFFFF" }));
  }

  if (lw !== null || (cfg.extension && L("done") !== null)) quads.push(...wallQuads(cam, winZ, lw === null ? 1 : easeOutCubic(prog(lw, 0, 0.8))));
  for (const [key, pts, r, color, opacity] of cables) quads.push(...cable(key, pts, r, color, cam, opacity));

  if (lw !== null && stickPose) {
    // Hand: comes in, holds the stick while carrying it, then leaves.
    const inP = easeOutCubic(prog(lw, 0, 0.7)), outP = easeInCubic(prog(lw, 3.7, 4.3));
    const s = project(cam, poseApply(stickPose, [0, 0, STICK.collar + STICK.len * 0.55]));
    const off = (1 - inP + outP) * 420 * s[2];
    overlays.push({ type: "hand", x: s[0] + off * 0.6, y: s[1] - off, s: s[2], opacity: 1 - outP });
  }
  if (male && dockPose && (lw !== null || L("done") !== null)) {
    const a = lw !== null ? easeOutCubic(prog(lw, 1.6, 2.1)) : 1;
    const pts = extensionCablePts(male.pose, dockPose);
    const s = project(cam, pts[Math.floor(pts.length * 0.62)]);
    overlays.push({ type: "label", x: clamp(s[0], 260, WIDTH - 260), y: clamp(s[1] - 30, 150, 560), text: cfg.cableLabel, opacity: a * fadeOut });
  }

  // Captions, numbered in the order of the enabled steps.
  const steps = [
    ["ethernet", cfg.stepEthernet.split("{port}").join(String(portN)), 0.3, ACT.ethernet],
    ["direct", cfg.stepDirect.split("{usb}").join(usb.name), 0.3, ACT.direct],
    ["extPlug", cfg.stepExtension, 0.3, ACT.extPlug],
    ["extRouter", cfg.stepExtensionRouter.split("{usb}").join(usb.name), 0.2, ACT.extRouter],
    ["window", cfg.stepWindow, 0.2, ACT.window],
  ].filter(([name]) => tl.at[name] !== undefined);
  const captions = steps.map(([name, text, a, dur], i) => {
    const l = L(name) ?? -1;
    return { n: String(i + 1), text, color: accent, opacity: prog(l, a, a + 0.4) * (1 - prog(l, dur, dur + 0.3)) * fadeOut };
  });
  captions.push({ n: "✓", text: cfg.done, color: cfg.ledColor, opacity: prog(L("done") ?? -1, 0.3, 0.7) * fadeOut });

  return {
    cam,
    opacity: easeOutCubic(prog(t, 0.3, 1.0)) * fadeOut,
    quads,
    overlays,
    title: { text: cfg.title, opacity: prog(t, 0.4, 1.0) * fadeOut },
    captions: captions.filter((c) => c.opacity > 0),
  };
}

const blink = (t) => 0.55 + 0.45 * Math.sin(t * 2 * Math.PI * 0.8);
const outline = (accent) => ({ radius: 8, stroke: accent, strokeW: 4, glow: accent });

function ripple(quads, key, side, x, y, p, accent) {
  if (p <= 0 || p >= 1) return;
  const r = 30 + 70 * p;
  quads.push(panelQuad(key, side, x - r, y - r, 2 * r, 2 * r, { radius: "50%", stroke: accent, strokeW: 6 * (1 - p) + 1 }, 1 - p));
}

// Where the extension cable's male end waits on the desk, next to the port.
function restMale(side, usb) {
  return side === "back"
    ? { x: usb.x + 180, y: DESK - MALE.h / 2, z: 420 }
    : { x: usb.x - 180, y: DESK - MALE.h / 2, z: FRONT_Z - 420, ry: 180 };
}

// From the male end out along its axis, down to the desk, then to the dock's foot.
function extensionCablePts(malePose, dockPose) {
  const r = 10;
  const s = poseApply(malePose, [0, 0, MALE.len]);
  const dir = poseDir(malePose, [0, 0, 1]);
  const e = poseApply(dockPose, [0, -r - 2, DOCK.d / 2]);
  const ed = poseDir(dockPose, [0, 0, 1]);
  const pts = [s];
  line(pts, add3(s, mul3(dir, 50)), 2);
  const b = [s[0] + dir[0] * 240, DESK - r, s[2] + dir[2] * 240];
  cubic(pts, pts[pts.length - 1], add3(s, mul3(dir, 170)), [s[0] + dir[0] * 130, DESK - r, s[2] + dir[2] * 130], b, 12);
  const span = len3(sub3(e, b));
  cubic(pts, b, add3(b, mul3(dir, 160)), add3(e, mul3(ed, Math.min(300, span * 0.4))), e, Math.max(12, Math.round(span / 60)));
  return pts;
}
