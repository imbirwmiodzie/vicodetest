// Centro Business 3.0 setup animation, described independently of any framework.
//
// frameState(t, cfg) returns everything visible at time t (seconds): the camera,
// textured boxes (router, plugs, USB stick, extension cable ends), cables as 3D
// polylines, things drawn on the back panel (LEDs, highlights, click ripples),
// the title and the captions. Remotion and HyperFrames draw it with CSS 3D,
// Revideo projects it onto its canvas, so all three play exactly the same scene.
//
// World units are pixels of the 1360x260 back-panel photo: +x right, +y down,
// +z out of the panel towards the viewer. The panel surface is z = 0.

export const FPS = 30;
export const DURATION_S = 17.5;
export const HOLD_END_S = 16.0; // where loop:false stops
export const WIDTH = 1280;
export const HEIGHT = 720;

export const MEDIA = {
  router: { src: "/media/cb3-back.png", w: 1360, h: 260 },
  stickFront: { src: "/media/tcl-ik41-front.jpeg", w: 540, h: 946 },
  stickEdge: { src: "/media/tcl-ik41-edge.jpeg", w: 444, h: 936 },
};

export const DEFAULTS = {
  title: "Centro Business 3.0",
  step1: "Connect the Ethernet cable to port {port}",
  step2: "Plug the TCL LinkKey IK41 into the USB 2.0 port",
  step3: "Better reception: move the stick onto the USB extension cable",
  done: "Ethernet and USB modem connected",
  port: 1,
  cableColor: "#E4E7EB",
  usbCableColor: "#2B2D33",
  ledColor: "#38E07B",
  accentColor: "#0F6FDE",
  speed: 1,
  loop: true,
};

const COLOR_KEYS = ["cableColor", "usbCableColor", "ledColor", "accentColor"];
const TEXT_KEYS = ["title", "step1", "step2", "step3", "done"];

// Validates a raw config object; invalid or missing fields fall back to DEFAULTS.
export function normalize(raw, isColor = (c) => typeof CSS === "undefined" || CSS.supports("color", c)) {
  const r = raw && typeof raw === "object" ? raw : {};
  const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const out = { ...DEFAULTS };
  for (const k of TEXT_KEYS) if (typeof r[k] === "string") out[k] = r[k];
  for (const k of COLOR_KEYS) if (typeof r[k] === "string" && isColor(r[k])) out[k] = r[k];
  out.port = Math.min(5, Math.max(1, Math.round(num(r.port, 1))));
  out.speed = Math.min(4, Math.max(0.1, num(r.speed, 1)));
  out.loop = r.loop !== false;
  return out;
}

// ---- camera ---------------------------------------------------------------------

// Fixed viewing angle; the camera only moves its focus point and zoom.
// Equivalent CSS: a 1280x720 container with `perspective: 1600px` (origin at its
// centre) holding a zero-size element at (640, 380) with transform cssWorld(cam).
export const VIEW = { perspective: 1600, rotX: -14, rotY: -32, top: 380 };

export function cssWorld(cam) {
  return `translateZ(${cam.zoom}px) rotateX(${VIEW.rotX}deg) rotateY(${VIEW.rotY}deg) translate3d(${-cam.fx}px, ${-cam.fy}px, ${-cam.fz}px)`;
}

const RAD = Math.PI / 180;
const CX = Math.cos(VIEW.rotX * RAD), SX = Math.sin(VIEW.rotX * RAD);
const CY = Math.cos(VIEW.rotY * RAD), SY = Math.sin(VIEW.rotY * RAD);

// World point -> view space [x, y, z] (z towards the viewer, before perspective).
export function toView(cam, p) {
  const x = p[0] - cam.fx, y = p[1] - cam.fy, z = p[2] - cam.fz;
  const x1 = x * CY + z * SY, z1 = -x * SY + z * CY;
  return [x1, y * CX - z1 * SX + (VIEW.top - HEIGHT / 2), y * SX + z1 * CX + cam.zoom];
}

// View space -> screen [x, y, scale]; scale <= 0 means behind the camera.
export function viewToScreen(v) {
  const s = VIEW.perspective / (VIEW.perspective - v[2]);
  return [WIDTH / 2 + v[0] * s, HEIGHT / 2 + v[1] * s, s];
}

export const project = (cam, p) => viewToScreen(toView(cam, p));

// Object pose: translate3d(x, y, z) rotateY(ry) rotateX(rx), angles in degrees.
export function cssPose(pose) {
  return `translate3d(${pose.x}px, ${pose.y}px, ${pose.z}px) rotateY(${pose.ry || 0}deg) rotateX(${pose.rx || 0}deg)`;
}

export function poseApply(pose, q) {
  const ax = (pose.rx || 0) * RAD, ay = (pose.ry || 0) * RAD;
  const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
  const y1 = q[1] * cx - q[2] * sx, z1 = q[1] * sx + q[2] * cx;
  return [pose.x + q[0] * cy + z1 * sy, pose.y + y1, pose.z - q[0] * sy + z1 * cy];
}

// ---- boxes ----------------------------------------------------------------------

// Face frames in box-local coordinates, matching the CSS transforms in faceCss():
// [width, height, top-left corner, u axis (face x), v axis (face y)].
export function faceFrame(name, w, h, d) {
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

export function faceCss(name, w, h, d) {
  switch (name) {
    case "front": return `translateZ(${d / 2}px)`;
    case "back": return `rotateY(180deg) translateZ(${d / 2}px)`;
    case "right": return `rotateY(90deg) translateZ(${w / 2}px)`;
    case "left": return `rotateY(-90deg) translateZ(${w / 2}px)`;
    case "top": return `rotateX(90deg) translateZ(${h / 2}px)`;
    case "bottom": return `rotateX(-90deg) translateZ(${h / 2}px)`;
  }
}

// A box spans z0..z1 in its pose's local frame (so plugs can be cut at the panel).
// Face spec: { fill, radius?, img?: { media, sx, sy, sw, sh, rot }, dots?: [...], shadow? }
function box(key, pose, cx, cy, z0, z1, w, h, faces, opacity = 1) {
  if (z1 - z0 < 0.5) return null;
  return { key, pose, c: [cx, cy, (z0 + z1) / 2], size: [w, h, z1 - z0], faces, opacity };
}

// ---- geometry measured on the photos ---------------------------------------------

export const BODY = { x0: 49, x1: 1305, y0: 10, y1: 232, depth: 1000 };
export const DESK = 250; // desk surface (bottom of the router's feet)
export const PORTS = [
  { x: 345.5, led: [366, 98, 14, 9] },
  { x: 422, led: [443, 98, 13, 9] },
  { x: 498.5, led: [519, 98, 14, 9] },
  { x: 574.5, led: [596, 98, 13, 9] },
  { x: 668, led: [690, 97, 11, 9] },
];
export const PORT_Y = 121;
export const USB = { x: 1027.5, y: 120 };

// IK41: body 27.6 x 11 x 69 mm at 5.45 px/mm; collar and USB-A plug in front of it.
const STICK = { w: 59, h: 150, len: 378, collarW: 54, collarH: 139, collar: 30 };
const USB_PLUG = { w: 24, h: 64, len: 64 };
// Extension cable: male end (overmold) and a standing female dock on the desk.
const DOCK = { x: 1720, z: 170, ry: -50, w: 90, h: 150, d: 90 };
const MALE = { w: 60, h: 96, len: 120 };

// ---- easing and timing helpers ----------------------------------------------------

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

// ---- camera path -----------------------------------------------------------------

const OVERVIEW = { fx: 800, fy: 160, fz: 160, zoom: -560 };
const START = { ...OVERVIEW, zoom: -760 };
const portCam = (x) => ({ fx: x + 40, fy: PORT_Y + 10, fz: 110, zoom: 900 });
const USB_CAM = { fx: USB.x - 40, fy: USB.y + 30, fz: 260, zoom: 420 };
const EXT_CAM = { fx: 1470, fy: -30, fz: 200, zoom: -600 };
const FINAL = { fx: 1200, fy: 30, fz: 160, zoom: -900 };

function camera(t, port) {
  const P = portCam(port.x);
  const segs = [
    [0.3, 1.1, START, OVERVIEW, easeOutCubic],
    [1.1, 2.1, OVERVIEW, P, easeInOutCubic],
    [4.6, 5.6, P, USB_CAM, easeInOutCubic],
    [8.6, 9.8, USB_CAM, EXT_CAM, easeInOutCubic],
    [12.6, 13.8, EXT_CAM, FINAL, easeInOutCubic],
  ];
  let cam = START;
  for (const [a, b, from, to, ease] of segs) {
    if (t < a) break;
    const p = ease(prog(t, a, b));
    cam = {
      fx: lerp(from.fx, to.fx, p),
      fy: lerp(from.fy, to.fy, p),
      fz: lerp(from.fz, to.fz, p),
      zoom: lerp(from.zoom, to.zoom, p),
    };
  }
  return cam;
}

// ---- static router ---------------------------------------------------------------

function routerBoxes() {
  const w = BODY.x1 - BODY.x0, h = BODY.y1 - BODY.y0;
  const origin = { x: 0, y: 0, z: 0 };
  return [
    box("router-shadow", origin, BODY.x0 + w / 2, DESK, -BODY.depth - 200, 200, w + 280, 0, {
      top: { shadow: true, cells: 4 },
    }),
    box("router", origin, BODY.x0 + w / 2, BODY.y0 + h / 2, -BODY.depth, 0, w, h, {
      front: { fill: "#363944", radius: 10, img: { media: "router", sx: BODY.x0, sy: BODY.y0, sw: w, sh: h, rot: 0 } },
      top: { fill: "#3D404B", radius: 10 },
      right: { fill: "#30333B" },
      left: { fill: "#30333B" },
    }),
  ];
}
const ROUTER = routerBoxes();

// ---- moving parts ----------------------------------------------------------------

const shade = (hex, k) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (c) => Math.round(clamp(c * (1 - k), 0, 255));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
};

function ethernetPlug(x, gap, color) {
  const pose = { x: 0, y: 0, z: 0 };
  const y = PORT_Y + 2;
  const plastic = { fill: "rgba(232,236,240,0.82)", stroke: "rgba(150,160,170,0.9)" };
  const contacts = { ...plastic, dots: [{ x: 4, y: 4, w: 22, h: 8, fill: "#C9A23A", stripes: true }] };
  const boot = (k) => ({ fill: shade(color, k) });
  return [
    box("eth-body", pose, x, y, Math.max(0, gap - 100), gap + 20, 58, 44, {
      front: plastic, top: plastic, right: contacts, left: plastic, bottom: plastic,
    }),
    box("eth-latch", pose, x, y - 27, Math.max(0, gap - 55), gap + 15, 22, 10, {
      front: plastic, top: plastic, right: plastic, left: plastic,
    }),
    box("eth-boot", pose, x, y, gap + 20, gap + 110, 52, 40, {
      front: boot(0.05), top: boot(0), right: boot(0.12), left: boot(0.12), bottom: boot(0.25),
    }),
  ];
}

function ethernetCable(x, gap, color) {
  const y0 = PORT_Y + 2, z0 = gap + 110, yd = DESK - 15;
  const pts = [[x, y0, z0]];
  cubic(pts, [x, y0, z0 + 40], [x, y0, z0 + 200], [x, yd, z0 + 150], [x, yd, z0 + 300], 18);
  line(pts, [x, yd, Math.max(1150, z0 + 420)], 8);
  return { key: "eth-cable", pts, r: 15, color, opacity: 1 };
}

// USB-A plug in a frame where the plug points to -z and its base is at z = 0;
// `inserted` (0..len) hides the part that is inside a socket.
function usbPlug(key, pose, inserted) {
  const metal = { fill: "#D5D9DE" };
  return box(key, pose, 0, 0, -(USB_PLUG.len - inserted), 0, USB_PLUG.w, USB_PLUG.h, {
    right: metal, left: metal, top: { fill: "#EDEFF2" }, bottom: { fill: "#A9AEB6" }, front: metal,
  });
}

function stick(pose, inserted, led) {
  const s = STICK;
  const dark = "#26282D";
  // The photo's LED slit (270, 749) in the turned and scaled face (x 0.56).
  const ledDot = led > 0
    ? [{ x: 86.5, y: 69, w: 4, h: 12, fill: "#5EC8FF", glow: `rgba(94,200,255,${led})`, glowSize: 6 + 6 * led }]
    : [];
  return [
    usbPlug("stick-plug", pose, inserted),
    box("stick-collar", pose, 0, 0, 0, s.collar, s.collarW, s.collarH, {
      right: { fill: "#2E3035" }, left: { fill: "#2E3035" }, top: { fill: "#34363C" }, bottom: { fill: dark }, back: { fill: dark },
    }),
    box("stick-body", pose, 0, 0, s.collar, s.collar + s.len, s.w, s.h, {
      // Front photo turned 90 deg clockwise so the plug end points to -z.
      right: { fill: dark, radius: [16, 6, 6, 16], img: { media: "stickFront", sx: 136, sy: 232, sw: 268, sh: 675, rot: 90 }, dots: ledDot },
      // Edge photo with the LTE1/LTE2 antenna caps, plug end at the top.
      top: { fill: dark, radius: [6, 6, 16, 16], img: { media: "stickEdge", sx: 167, sy: 215, sw: 106, sh: 677, rot: 0 } },
      left: { fill: dark, radius: [6, 16, 16, 6] },
      bottom: { fill: "#202226", radius: [16, 16, 6, 6] },
      front: { fill: "#2B2D32", radius: 14 },
      back: { fill: dark },
    }),
  ];
}

function extensionMale(gap, color, opacity) {
  const pose = { x: USB.x, y: USB.y, z: gap };
  const ins = clamp(USB_PLUG.len - gap, 0, USB_PLUG.len);
  const f = (k) => ({ fill: shade(color, k), radius: 8 });
  return [
    usbPlug("ext-plug", pose, ins),
    box("ext-male", pose, 0, 0, 0, MALE.len, MALE.w, MALE.h, {
      front: f(0.1), top: f(-0.25), right: f(0), left: f(0), bottom: f(0.3), back: f(0.1),
    }, opacity),
  ];
}

const dockPose = () => ({ x: DOCK.x, y: DESK, z: DOCK.z, ry: DOCK.ry });

function dock(color, opacity) {
  const f = (k) => ({ fill: shade(color, k), radius: 6 });
  const slot = { dots: [{ x: DOCK.w / 2 - 14, y: DOCK.d / 2 - 34, w: 28, h: 68, fill: "#0B0C0E" }] };
  return [
    box("dock-shadow", dockPose(), 0, 0, -DOCK.d, DOCK.d, DOCK.w * 2.2, 0, { top: { shadow: true, cells: 2 } }, opacity),
    box("dock", dockPose(), 0, -DOCK.h / 2, -DOCK.d / 2, DOCK.d / 2, DOCK.w, DOCK.h, {
      top: { ...f(-0.25), ...slot }, front: f(0), right: f(0.1), left: f(0.1), back: f(0.2),
    }, opacity),
  ];
}

function extensionCable(gap, color, opacity) {
  const r = 10;
  const s = [USB.x, USB.y, gap + MALE.len];
  const e = poseApply(dockPose(), [0, -r - 2, DOCK.d / 2]);
  const dir = poseApply({ x: 0, y: 0, z: 0, ry: DOCK.ry }, [0, 0, 1]);
  const pts = [s];
  line(pts, [s[0], s[1], s[2] + 50], 2);
  const b = [s[0], DESK - r, s[2] + 240];
  cubic(pts, pts[pts.length - 1], [s[0], s[1], s[2] + 170], [s[0], DESK - r, s[2] + 130], b, 14);
  cubic(pts, b, [b[0], b[1], b[2] + 160], [e[0] + dir[0] * 260, e[1], e[2] + dir[2] * 260], e, 24);
  return { key: "ext-cable", pts, r, color, opacity };
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
  for (let i = 1; i <= n; i++) out.push(p0.map((v, j) => lerp(v, p[j], i / n)));
}

// ---- the frame -------------------------------------------------------------------

export function frameState(t, cfg) {
  const portN = clamp(Math.round(cfg.port) || 1, 1, 5);
  const port = PORTS[portN - 1];
  const fadeOut = 1 - easeInCubic(prog(t, 16.0, 16.8));

  // Ethernet: 2.1-3.6 travel, click at 3.8, link LED from 4.0.
  const ethGap = travel(t, 2.1, 3.6, 520, 14);
  // Stick into the router: 5.6-7.1 travel, click at 7.3. Unplugged again at 8.6.
  const stickGap = t < 8.6 ? travel(t, 5.6, 7.1, 420, 12) : lerp(0, 260, easeInOutCubic(prog(t, 8.6, 9.3)));
  // Extension cable: male end into USB 9.6-10.8, click at 11.0.
  const extGap = travel(t, 9.6, 10.8, 360, 12);
  const extIn = easeOutCubic(prog(t, 9.4, 9.9));
  // Stick: flies to above the dock 9.3-10.5, goes down into it 11.4-12.2, click at 12.4.
  const dockGap = travel(t, 11.4, 12.2, 140, 10);

  let stickPose, stickIns;
  if (t < 9.3) {
    stickPose = { x: USB.x, y: USB.y, z: stickGap };
    stickIns = clamp(USB_PLUG.len - stickGap, 0, USB_PLUG.len);
  } else {
    const p = easeInOutCubic(prog(t, 9.3, 10.5));
    const top = DESK - DOCK.h - dockGap;
    stickPose = {
      x: lerp(USB.x, DOCK.x, p),
      y: lerp(USB.y, top, p) - 60 * Math.sin(Math.PI * p),
      z: lerp(260, DOCK.z, p),
      ry: lerp(0, DOCK.ry, p),
      rx: lerp(0, 90, p),
    };
    stickIns = p < 1 ? 0 : clamp(USB_PLUG.len - dockGap, 0, USB_PLUG.len);
  }
  const stickLed =
    (t >= 7.6 && t < 8.6) || t >= 12.6 ? 0.55 + 0.45 * Math.sin((t - 7.6) * 2 * Math.PI * 0.8) : 0;

  const objects = [];
  if (t >= 2.1) objects.push(...ethernetPlug(port.x, ethGap, cfg.cableColor));
  if (t >= 5.6) objects.push(...stick(stickPose, stickIns, stickLed));
  const cables = [];
  if (t >= 2.1) cables.push(ethernetCable(port.x, ethGap, cfg.cableColor));
  if (t >= 9.4) {
    objects.push(...dock(cfg.usbCableColor, extIn), ...extensionMale(extGap, cfg.usbCableColor, extIn));
    cables.push(extensionCable(extGap, cfg.usbCableColor, extIn));
  }

  // On the panel surface.
  const accent = cfg.accentColor;
  const panel = [];
  const outline = (key, x, y, w, h, a) =>
    a > 0 && panel.push({ key, type: "rect", x, y, w, h, radius: 8, stroke: accent, strokeW: 4, glow: accent, opacity: 0.35 + 0.65 * a });
  const ripple = (key, x, y, p) =>
    p > 0 && p < 1 && panel.push({ key, type: "ring", x, y, r: 30 + 70 * p, strokeW: 6 * (1 - p) + 1, stroke: accent, opacity: 1 - p });
  outline("hl-port", port.x - 40, 88, 80, 72, pulse(t, 1.6, 3.8));
  outline("hl-usb", USB.x - 24, USB.y - 42, 48, 84, Math.max(pulse(t, 5.2, 7.3), pulse(t, 9.6, 11.0)));
  ripple("rp-port", port.x, PORT_Y, prog(t, 3.8, 4.3));
  ripple("rp-usb1", USB.x, USB.y, prog(t, 7.3, 7.8));
  ripple("rp-usb2", USB.x, USB.y, prog(t, 11.0, 11.5));
  if (t >= 4.0 && Math.floor((t - 4.0) * 8) % 6 !== 3) {
    const [x, y, w, h] = port.led;
    panel.push({ key: "led", type: "rect", x, y, w, h, radius: 2, fill: cfg.ledColor, glow: cfg.ledColor });
  }

  const cap = (n, text, a, b, c, d, color) => ({ n, text, color, opacity: prog(t, a, b) * (1 - prog(t, c, d)) * fadeOut });
  return {
    cam: camera(t, port),
    opacity: easeOutCubic(prog(t, 0.3, 1.0)) * fadeOut,
    router: ROUTER,
    panel,
    cables,
    objects: objects.filter(Boolean),
    title: { text: cfg.title, opacity: prog(t, 0.4, 1.0) * fadeOut },
    captions: [
      cap("1", cfg.step1.split("{port}").join(String(portN)), 1.4, 1.8, 4.6, 4.9, accent),
      cap("2", cfg.step2, 4.9, 5.3, 8.3, 8.6, accent),
      cap("3", cfg.step3, 8.6, 9.0, 13.4, 13.7, accent),
      cap("✓", cfg.done, 13.7, 14.1, 99, 100, cfg.ledColor),
    ].filter((c) => c.opacity > 0),
  };
}

// ---- helpers for renderers -------------------------------------------------------

// Clips each cable segment to the space in front of the camera and projects it.
// Returns screen segments [x0, y0, x1, y1, width].
export function cableSegments(cam, cable) {
  const out = [];
  const near = VIEW.perspective - 20;
  let prev = toView(cam, cable.pts[0]);
  for (let i = 1; i < cable.pts.length; i++) {
    let a = prev, b = toView(cam, cable.pts[i]);
    prev = b;
    if (a[2] > near && b[2] > near) continue;
    if (a[2] > near || b[2] > near) {
      const k = (near - a[2]) / (b[2] - a[2]);
      const m = a.map((v, j) => v + (b[j] - v) * k);
      if (a[2] > near) a = m; else b = m;
    }
    const p = viewToScreen(a), q = viewToScreen(b);
    out.push([p[0], p[1], q[0], q[1], cable.r * (p[2] + q[2])]);
  }
  return out;
}
