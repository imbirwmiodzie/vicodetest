// Router connection-table (conntrack / NAT) exhaustion, as a 2D network diagram.
//
// LAN hosts on the left (Alice, Bob, Mallory), the router opened up in the middle (LAN
// ports, the conntrack check, the NAT table with addresses, ports, state and timeout),
// the internet (the site, attackers) on the right. Cases, each optional: normal use, a
// flood from the LAN filling the table, a flood from the internet doing the same, and
// the router protected by per-device limits and short timeouts.
//
// buildScene(cfg) simulates every packet of the enabled cases once (which ones get a
// table entry, which are dropped); render(t) then draws any moment of it, so the
// animation can be seeked freely. Used by the HyperFrames composition conntrack.html.
// Addresses are from the documentation ranges (192.0.2.0/24, 198.51.100.0/24,
// 203.0.113.0/24, 198.18.0.0/15); timeouts are the Linux defaults.

export const WIDTH = 1280;
export const HEIGHT = 720;

export const DEFAULTS = {
  title: "When the router's connection table is full",
  site: "example.com",
  tableSize: 32,
  perHostLimit: 8,
  normal: true,
  outbound: true,
  inbound: true,
  mitigation: true,
  speed: 1,
  loop: true,
};

export function normalize(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const out = { ...DEFAULTS };
  for (const k of ["title", "site"]) if (typeof r[k] === "string" && r[k]) out[k] = r[k];
  for (const k of ["normal", "outbound", "inbound", "mitigation", "loop"]) if (typeof r[k] === "boolean") out[k] = r[k];
  out.tableSize = Math.round(Math.min(48, Math.max(16, num(r.tableSize, 32))) / 8) * 8;
  out.perHostLimit = Math.round(Math.min(16, Math.max(2, num(r.perHostLimit, 8))));
  out.speed = Math.min(4, Math.max(0.1, num(r.speed, 1)));
  return out;
}

// ---- timeline ---------------------------------------------------------------------

const ACT = { intro: 2.0, normal: 8.0, outbound: 13.0, inbound: 13.0, mitigation: 11.5, outro: 2.0 };
export const MAX_DURATION_S = Object.values(ACT).reduce((a, b) => a + b, 0);

export function timeline(cfg) {
  const at = {};
  let t = 0;
  for (const name of ["intro", "normal", "outbound", "inbound", "mitigation"]) {
    if (name !== "intro" && !cfg[name]) continue;
    at[name] = t;
    t += ACT[name];
  }
  const holdEnd = t;
  at.outro = t;
  return { at, duration: t + ACT.outro, holdEnd };
}

// ---- layout -----------------------------------------------------------------------

const C = {
  alice: "#2F7BEA",
  bob: "#14A39A",
  mallory: "#E5484D",
  botnet: "#F2711C",
  link: "#B8C0CC",
  ink: "#1B1F27",
  muted: "#5E6673",
  shell: "#2A2F38",
  ok: "#2FB463",
};
const IP = { alice: "192.168.1.10", bob: "192.168.1.11", mallory: "192.168.1.66", nas: "192.168.1.20", wan: "198.51.100.7", site: "192.0.2.80" };
const HOSTS = {
  alice: { x: 78, y: 262, name: "Alice", role: "laptop", port: 0 },
  bob: { x: 78, y: 392, name: "Bob", role: "phone · video call", port: 1 },
  mallory: { x: 78, y: 522, name: "Mallory", role: "infected PC", port: 2 },
};
// The router, opened up: shell, inner panel, the packet lane with the conntrack check,
// and the table below it.
const R = { x: 290, y: 170, w: 590, h: 450, laneY: 250, gateX: 585 };
const T = { x: 312, w: 546, headY: 286, y: 306, rowH: 19, rows: 11, head: 3, tail: 7 };
const COL = { proto: 8, lan: 40, wan: 178, remote: 314, state: 448, timeout: 542 };
const SITE = { x: 1050, y: 238 };
const CALL = [1000, 330];
const BOTNET = { x: 1115, y: 372 };
const CLOUD_IN = [950, 262];
const hostOut = (h) => [256, HOSTS[h].y - 4];
const lanIn = (h) => [R.x, R.laneY - 12 + HOSTS[h].port * 12];
const LANE_IN = [R.x + 40, R.laneY];
const GATE = [R.gateX, R.laneY];
const WAN_OUT = [R.x + R.w, R.laneY];
const SITE_IN = [SITE.x - 34, SITE.y + 18];

// Small deterministic random numbers, so every render of a moment looks the same.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const pathLen = (path) => path.slice(1).reduce((l, p, i) => l + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);
const SPEED = 640; // px per second

// ---- simulation -------------------------------------------------------------------

// Linux defaults: TCP SYN_SENT 120 s, ESTABLISHED 5 days, SYN_RECV 60 s, UDP stream 120 s.
const TIMEOUT = { SYN_SENT: 120, ESTABLISHED: 432000, SYN_RECV: 60, ASSURED: 120 };

// Simulates one case: new connections reach the conntrack check in time order and
// either get a table entry or are dropped (table full, or per-device limit when protected).
function simulateCase(kind, start, cfg) {
  const N = cfg.tableSize, L = cfg.perHostLimit;
  const protectedCase = kind === "mitigation";
  const synTimeout = protectedCase ? 30 : TIMEOUT.SYN_SENT;
  const packets = [], entries = [], drops = [], effects = [], status = [], browser = [];
  const requests = [];
  const rand = rng(kind.length * 977 + N);
  const pkt = (t0, path, color, r, drop = null) => packets.push({ t0, path, dur: pathLen(path) / SPEED, color, r, drop });

  // Already in the table when the case starts: Bob's video call, his messages, Alice's mail.
  const est = (t) => [{ t, s: "ESTABLISHED", to: TIMEOUT.ESTABLISHED }];
  entries.push(
    { t: start - 1, host: "bob", proto: "UDP", lan: `${IP.bob}:50112`, wan: `${IP.wan}:50112`, remote: "192.0.2.50:3478", st: [{ t: start - 1, s: "ASSURED", to: TIMEOUT.ASSURED }], refresh: true },
    { t: start - 1, host: "bob", proto: "TCP", lan: `${IP.bob}:49870`, wan: `${IP.wan}:49870`, remote: "192.0.2.60:443", st: est(start - 1) },
    { t: start - 1, host: "alice", proto: "TCP", lan: `${IP.alice}:51022`, wan: `${IP.wan}:51022`, remote: "192.0.2.25:993", st: est(start - 1) },
  );

  // Bob's call: packets all through the case on the existing entry (no new one).
  const lossy = kind === "inbound";
  for (let t = start + 0.4; t < start + ACT[kind] - 0.8; t += 0.55) {
    const flooded = lossy && t > start + 2.2 && Math.floor(t * 7) % 2 === 0;
    if (flooded) pkt(t, [CALL, CLOUD_IN, WAN_OUT], C.bob, 4.5, 1);
    else pkt(t, [CALL, CLOUD_IN, WAN_OUT, GATE, LANE_IN, lanIn("bob"), hostOut("bob")], C.bob, 4.5);
  }

  let alicePort = 51234;
  const aliceRequest = (t) => requests.push({ host: "alice", t, port: (alicePort += 2 + Math.floor(rand() * 4)) });
  const flood = (host, n, dt) => {
    for (let i = 0; i < n; i++) requests.push({ host, t: start + 1.0 + i * dt, flood: true });
  };
  if (kind === "normal") {
    aliceRequest(start + 1.4);
    status.push({ t0: start + 0.6, t1: start + ACT.normal - 0.4, text: "1 connection = 1 entry in the table", tone: "info" });
  } else if (kind === "outbound" || kind === "mitigation") {
    flood("mallory", 110, 0.06);
    if (kind === "outbound") [5.6, 6.8, 8.0].forEach((dt) => aliceRequest(start + dt));
    else aliceRequest(start + 4.8);
  } else if (kind === "inbound") {
    flood("botnet", 120, 0.055);
    [5.6, 6.8, 8.0].forEach((dt) => aliceRequest(start + dt));
  }

  // Each request's way to the conntrack check, and on from there.
  for (const r of requests) {
    if (r.host === "botnet") {
      r.from = [BOTNET.x - 34 + rand() * 68, BOTNET.y - 20 + rand() * 30];
      r.toGate = [r.from, CLOUD_IN, WAN_OUT, GATE];
      r.onward = [GATE];
      const port = 1024 + Math.floor(rand() * 64000);
      Object.assign(r, { proto: "TCP", lan: `${IP.nas}:443`, wan: `${IP.wan}:443`, remote: `203.0.113.${2 + Math.floor(rand() * 250)}:${port}` });
    } else if (r.host === "mallory") {
      r.toGate = [hostOut("mallory"), lanIn("mallory"), LANE_IN, GATE];
      r.onward = [GATE, WAN_OUT, CLOUD_IN, [985 + rand() * 230, 190 + rand() * 220]];
      const port = 32768 + Math.floor(rand() * 28000);
      const dst = `198.18.${Math.floor(rand() * 256)}.${1 + Math.floor(rand() * 253)}:${[80, 443, 25, 22][Math.floor(rand() * 4)]}`;
      Object.assign(r, { proto: "TCP", lan: `${IP.mallory}:${port}`, wan: `${IP.wan}:${port}`, remote: dst });
    } else {
      r.toGate = [hostOut("alice"), lanIn("alice"), LANE_IN, GATE];
      r.onward = [GATE, WAN_OUT, CLOUD_IN, SITE_IN];
      Object.assign(r, { proto: "TCP", lan: `${IP.alice}:${r.port}`, wan: `${IP.wan}:${r.port}`, remote: `${IP.site}:443` });
    }
    r.ta = r.t + pathLen(r.toGate) / SPEED;
  }

  const perHost = { alice: 1, bob: 2, mallory: 0, botnet: 0 };
  let count = entries.length, fullAt = null, aliceOk = false;
  for (const r of [...requests].sort((a, b) => a.ta - b.ta)) {
    const limited = protectedCase && perHost[r.host] >= L;
    const ok = count < N && !limited;
    const color = C[r.host];
    const big = r.host === "alice" ? 6 : 4;
    if (!ok) {
      pkt(r.t, r.toGate, color, big, 1);
      const what = r.host === "botnet" ? `${r.proto} ${r.remote} → ${r.wan}` : `${r.proto} ${r.lan} → ${r.remote}`;
      drops.push({ t: r.ta, host: r.host, text: `${what}  (${limited ? `limit ${L} per device` : "table full"})` });
      if (r.host === "alice") browser.push({ t: r.t, state: "loading" });
      continue;
    }
    count++;
    perHost[r.host]++;
    if (count === N && fullAt === null) fullAt = r.ta;
    const full = [...r.toGate, ...r.onward.slice(1)];
    pkt(r.t, full, color, big);
    const e = { t: r.ta, host: r.host, proto: r.proto, lan: r.lan, wan: r.wan, remote: r.remote };
    if (r.host === "botnet") e.st = [{ t: r.ta, s: "SYN_RECV", to: TIMEOUT.SYN_RECV }];
    else e.st = [{ t: r.ta, s: "SYN_SENT", to: synTimeout }];
    if (r.host === "alice") {
      // The site answers; the entry turns ESTABLISHED when the reply passes the router.
      aliceOk = true;
      const back = [...full].reverse();
      const t1 = r.t + pathLen(full) / SPEED + 0.25;
      pkt(t1, back, color, 6);
      e.st.push({ t: t1 + pathLen([SITE_IN, CLOUD_IN, WAN_OUT, GATE]) / SPEED, s: "ESTABLISHED", to: TIMEOUT.ESTABLISHED });
      browser.push({ t: r.t, state: "loading" }, { t: t1 + pathLen(back) / SPEED, state: "ok" });
    }
    entries.push(e);
  }
  browser.sort((a, b) => a.t - b.t);
  if (!aliceOk && kind !== "normal") browser.push({ t: start + 9.2, state: "error" });

  // Router status, side effects, captions.
  const cap = (text) => ({ t0: start + 0.3, t1: start + ACT[kind] - 0.3, text });
  const list = (items, tone) => items.forEach(([text, dt]) => effects.push({ t: start + dt, text, tone }));
  let caption;
  if (kind === "normal") {
    caption = cap("Normal: each connection is one entry: LAN IP:port ⇄ router's public IP:port ⇄ remote IP:port");
    list([["An entry is freed when the connection ends or times out", 4.6], ["Open TCP connections may stay 5 days (Linux default)", 5.6]], "ok");
  } else if (kind === "outbound") {
    caption = cap("Flood from the LAN: Mallory's infected PC opens thousands of connections and fills the table");
    if (fullAt) status.push({ t0: fullAt, t1: start + ACT[kind] - 0.4, text: "Table full · new connections dropped", tone: "bad" });
    list([["New connections fail on every device", 6.3], ["Open connections keep working (Bob's call)", 7.5],
      ["Router under load: slow, may even reboot", 8.7], ["The ISP sees a flood coming from your line", 9.9]], "bad");
  } else if (kind === "inbound") {
    caption = cap("The opposite direction: attackers on the internet flood a port forward (NAS) and fill the table");
    if (fullAt) status.push({ t0: fullAt, t1: start + ACT[kind] - 0.4, text: "Table full · internet line saturated", tone: "bad" });
    list([["New connections fail for everyone", 6.3], ["Line saturated: calls and video stutter", 7.5],
      ["Port forwards (NAS, camera) unreachable", 8.7], ["Only the ISP can filter it before your line", 9.9]], "bad");
  } else {
    caption = cap(`Protected: max. ${L} connections per device, unanswered ones time out after 30 s`);
    status.push({ t0: start + 0.6, t1: start + ACT[kind] - 0.4, text: `Limit: ${L} connections per device`, tone: "ok" });
    list([[`Mallory capped at ${L} entries, the rest dropped`, 3.6], ["The table keeps room for everyone else", 5.0],
      ["Alice's page opens normally", 8.2], ["Unanswered connections expire in 30 s", 9.4]], "ok");
  }
  return { kind, start, end: start + ACT[kind], packets, entries, drops, effects, status, browser, caption, perHost };
}

export function buildScene(cfg) {
  const tl = timeline(cfg);
  const cases = ["normal", "outbound", "inbound", "mitigation"].filter((k) => tl.at[k] !== undefined).map((k) => simulateCase(k, tl.at[k], cfg));
  cases.forEach((c, i) => (c.n = String(i + 1)));
  return { cfg, tl, cases };
}

// ---- drawing ----------------------------------------------------------------------

const SVGNS = "http://www.w3.org/2000/svg";
const SANS = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}
const text = (parent, x, y, s, attrs = {}) => {
  const e = el("text", { x, y, "font-family": SANS, fill: C.ink, ...attrs }, parent);
  e.textContent = s;
  return e;
};

// Point at fraction p along a polyline.
function along(path, p) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    segs.push(l);
    total += l;
  }
  let d = p * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? clamp(d / segs[i], 0, 1) : 0;
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k];
    }
    d -= segs[i];
  }
  return path[path.length - 1];
}

function laptop(g, color) {
  el("rect", { x: -38, y: -34, width: 76, height: 50, rx: 5, fill: "#2A2F38" }, g);
  el("rect", { x: -33, y: -29, width: 66, height: 40, rx: 2, fill: color, opacity: 0.85 }, g);
  el("path", { d: "M-50 18 H50 L44 26 H-44 Z", fill: "#3A404B" }, g);
}
function phone(g, color) {
  el("rect", { x: -20, y: -38, width: 40, height: 72, rx: 8, fill: "#2A2F38" }, g);
  el("rect", { x: -16, y: -31, width: 32, height: 56, rx: 3, fill: color, opacity: 0.85 }, g);
  el("circle", { cx: 0, cy: 29, r: 2.5, fill: "#5A616C" }, g);
}
function desktop(g, color) {
  el("rect", { x: -44, y: -36, width: 72, height: 50, rx: 5, fill: "#2A2F38" }, g);
  el("rect", { x: -39, y: -31, width: 62, height: 40, rx: 2, fill: color, opacity: 0.85 }, g);
  el("rect", { x: -14, y: 14, width: 12, height: 10, fill: "#3A404B" }, g);
  el("rect", { x: -26, y: 24, width: 36, height: 5, rx: 2, fill: "#3A404B" }, g);
  el("rect", { x: 34, y: -36, width: 22, height: 64, rx: 4, fill: "#2A2F38" }, g);
  el("circle", { cx: 45, cy: -24, r: 3, fill: color }, g);
}
function server(g) {
  for (let i = 0; i < 3; i++) {
    el("rect", { x: -30, y: -30 + i * 20, width: 60, height: 16, rx: 3, fill: "#2A2F38" }, g);
    el("circle", { cx: 20, cy: -22 + i * 20, r: 2.5, fill: "#46F08A" }, g);
  }
}
function attacker(g, color) {
  el("rect", { x: -18, y: -16, width: 36, height: 26, rx: 3, fill: "#2A2F38" }, g);
  el("rect", { x: -15, y: -13, width: 30, height: 19, rx: 2, fill: color, opacity: 0.85 }, g);
  el("rect", { x: -10, y: 10, width: 20, height: 4, rx: 2, fill: "#3A404B" }, g);
}

const fmtTimeout = (s) => (s >= 86400 ? `${Math.round(s / 86400)}d` : `${Math.max(0, Math.ceil(s))}s`);
const STATE_COLOR = { SYN_SENT: "#B26A00", SYN_RECV: "#C2410C", ESTABLISHED: "#1F8F4E", ASSURED: "#1F8F4E" };

// Builds the static diagram once; returns render(t) for the moving parts. routerImage
// is the router's front (shown zooming in at the start, and small in the router's title).
export function createRenderer(svg, scene, routerImage) {
  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
  const { cfg } = scene;
  const N = cfg.tableSize;
  el("rect", { width: WIDTH, height: HEIGHT, fill: "#F6F7F9" }, svg);
  const titleEl = text(svg, 30, 56, cfg.title, { "font-size": 30, "font-weight": 700 });

  // Areas.
  el("rect", { x: 20, y: 165, width: 240, height: 455, rx: 18, fill: "#FFFFFF", stroke: "#E1E5EA" }, svg);
  text(svg, 38, 193, "Home / office network (LAN)", { "font-size": 14, fill: C.muted, "font-weight": 600 });
  el("path", {
    d: "M900 330 C860 330 850 270 900 262 C895 200 970 180 1000 215 C1025 160 1120 160 1135 220 C1200 215 1225 280 1185 310 C1225 360 1180 430 1120 420 C1090 460 1010 460 985 425 C935 450 880 410 900 330 Z",
    fill: "#EAF2FC", stroke: "#C9DAF0", "stroke-width": 2, transform: "translate(905 168) scale(0.97 0.88) translate(-855 -160)",
  }, svg);
  text(svg, 1085, 158, "Internet", { "font-size": 15, fill: C.muted, "font-weight": 600, "text-anchor": "middle" });

  // Links.
  const lanLinks = Object.keys(HOSTS).map((h) =>
    el("path", { d: `M${hostOut(h)[0]} ${hostOut(h)[1]} L${lanIn(h)[0]} ${lanIn(h)[1]}`, stroke: C.link, "stroke-width": 4, fill: "none", "stroke-linecap": "round" }, svg));
  const wanLink = el("path", { d: `M${WAN_OUT[0]} ${WAN_OUT[1]} L${CLOUD_IN[0]} ${CLOUD_IN[1]}`, stroke: C.link, "stroke-width": 6, fill: "none", "stroke-linecap": "round" }, svg);

  // Hosts.
  const hostEls = {};
  for (const [id, h] of Object.entries(HOSTS)) {
    const g = el("g", { transform: `translate(${h.x} ${h.y})` }, svg);
    const halo = el("circle", { r: 60, fill: C[id], opacity: 0 }, g);
    (id === "alice" ? laptop : id === "bob" ? phone : desktop)(g, C[id]);
    // Labels to the right of the icon; the link to the router starts at the box edge.
    text(g, 62, -14, h.name, { "font-size": 17, "font-weight": 700 });
    text(g, 62, 3, h.role, { "font-size": 12, fill: C.muted });
    text(g, 62, 20, IP[id], { "font-size": 12, fill: C[id], "font-family": MONO, "font-weight": 600 });
    hostEls[id] = { halo };
  }

  // Internet side: the site and the attackers.
  const siteG = el("g", { transform: `translate(${SITE.x} ${SITE.y})` }, svg);
  server(siteG);
  text(siteG, 0, 46, cfg.site, { "font-size": 15, "font-weight": 600, "text-anchor": "middle" });
  text(siteG, 0, 63, `${IP.site}:443`, { "font-size": 12, fill: C.muted, "font-family": MONO, "text-anchor": "middle" });
  const botG = el("g", { transform: `translate(${BOTNET.x} ${BOTNET.y})`, opacity: 0 }, svg);
  [[-46, 0], [0, -10], [46, 4]].forEach(([dx, dy]) => attacker(el("g", { transform: `translate(${dx} ${dy})` }, botG), C.botnet));
  text(botG, 0, 36, "attackers 203.0.113.0/24", { "font-size": 12, fill: C.botnet, "font-weight": 600, "text-anchor": "middle" });

  // The router, opened up.
  const routerG = el("g", {}, svg);
  el("rect", { x: R.x, y: R.y, width: R.w, height: R.h, rx: 22, fill: C.shell }, routerG);
  el("rect", { x: R.x + 12, y: R.y + 44, width: R.w - 24, height: R.h - 56, rx: 12, fill: "#FFFFFF" }, routerG);
  el("image", { href: routerImage, x: R.x + 16, y: R.y + 9, width: 147, height: 26 }, routerG);
  text(routerG, R.x + 178, R.y + 22, "Inside the router", { "font-size": 16, "font-weight": 700, fill: "#FFFFFF" });
  text(routerG, R.x + 178, R.y + 37, "NAT connection table (conntrack)", { "font-size": 12, fill: "#AEB4BE" });
  for (const h of Object.keys(HOSTS)) {
    const [x, y] = lanIn(h);
    el("rect", { x: x - 6, y: y - 5, width: 14, height: 10, rx: 2, fill: "#E8C547", stroke: "#8A7420" }, routerG);
  }
  el("rect", { x: WAN_OUT[0] - 8, y: WAN_OUT[1] - 5, width: 14, height: 10, rx: 2, fill: "#5AA6E8", stroke: "#2A5E8A" }, routerG);
  el("rect", { x: R.x + 12, y: R.laneY - 11, width: R.w - 24, height: 22, fill: "#F1F3F6" }, routerG);
  text(routerG, R.x + 20, R.laneY - 17, "LAN ports", { "font-size": 11, fill: C.muted });
  text(routerG, R.x + R.w - 20, R.laneY - 17, `WAN · ${IP.wan}`, { "font-size": 11, fill: C.muted, "font-family": MONO, "text-anchor": "end" });
  el("path", { d: `M${R.gateX} ${R.laneY + 15} V${T.headY - 2}`, stroke: "#9AA3AF", "stroke-width": 1.5, "stroke-dasharray": "3 3" }, routerG);

  // The table: header, row pool, last drop, fill gauge.
  el("rect", { x: T.x, y: T.headY, width: T.w, height: T.y - T.headY - 2, rx: 4, fill: "#E9ECF0" }, routerG);
  const cell = (g, k, y, s, attrs = {}) => text(g, T.x + COL[k], y, s, { "font-size": 11, "font-family": MONO, ...(k === "timeout" ? { "text-anchor": "end" } : {}), ...attrs });
  for (const [k, s] of Object.entries({ proto: "proto", lan: "LAN side", wan: "router WAN", remote: "remote", state: "state", timeout: "timeout" }))
    cell(routerG, k, T.headY + 13, s, { fill: C.muted, "font-weight": 700, "font-family": SANS });
  const rows = Array.from({ length: T.rows }, (_, i) => {
    const y = T.y + i * T.rowH;
    const g = el("g", {}, routerG);
    const bg = el("rect", { x: T.x, y, width: T.w, height: T.rowH - 2, rx: 3 }, g);
    const bar = el("rect", { x: T.x, y, width: 4, height: T.rowH - 2, rx: 1 }, g);
    const cells = Object.fromEntries(Object.keys(COL).map((k) => [k, cell(g, k, y + 13, "")]));
    const note = text(g, T.x + T.w / 2, y + 13, "", { "font-size": 11, fill: C.muted, "text-anchor": "middle" });
    return { g, bg, bar, cells, note };
  });
  const dropG = el("g", { opacity: 0 }, routerG);
  const dropLabel = text(dropG, T.x, 538, "✗ dropped", { "font-size": 12, "font-weight": 700, fill: C.mallory });
  const dropText = text(dropG, T.x + 76, 538, "", { "font-size": 11, "font-family": MONO, fill: C.mallory });
  const counter = text(routerG, T.x + T.w, 566, "", { "font-size": 13, "font-weight": 700, "text-anchor": "end" });
  text(routerG, T.x, 566, "Table", { "font-size": 13, "font-weight": 600 });
  el("rect", { x: T.x, y: 574, width: T.w, height: 10, rx: 5, fill: "#E6E9ED" }, routerG);
  const gauge = el("rect", { x: T.x, y: 574, width: 0, height: 10, rx: 5, fill: "#46C27A" }, routerG);
  const limitText = text(routerG, T.x, 600, "", { "font-size": 11, fill: C.muted });

  // Intro: the router's front zooms in and opens up.
  const introG = el("g", {}, svg);
  el("image", { href: routerImage, x: -200, y: -35, width: 400, height: 71 }, introG);
  const introText = text(svg, R.x + R.w / 2, R.y + R.h / 2 + 90, "Let's look inside the router", { "font-size": 20, "font-weight": 600, fill: C.muted, "text-anchor": "middle" });

  // Router status bubble.
  const statusG = el("g", { opacity: 0 }, svg);
  const statusBox = el("rect", { x: R.gateX - 190, y: 122, width: 380, height: 36, rx: 18 }, statusG);
  const statusText = text(statusG, R.gateX, 146, "", { "font-size": 15, "font-weight": 700, fill: "#FFFFFF", "text-anchor": "middle" });

  // Alice's browser.
  const browserG = el("g", { transform: "translate(20 82)", opacity: 0 }, svg);
  el("rect", { width: 260, height: 74, rx: 10, fill: "#FFFFFF", stroke: "#D5DAE0" }, browserG);
  el("rect", { width: 260, height: 22, rx: 10, fill: "#EEF1F4" }, browserG);
  [0, 1, 2].forEach((i) => el("circle", { cx: 14 + i * 12, cy: 11, r: 4, fill: ["#F25F58", "#FBBE2E", "#38C746"][i] }, browserG));
  text(browserG, 58, 15, `Alice's browser · ${cfg.site}`, { "font-size": 11, fill: C.muted });
  const spinner = el("path", { d: "M14 0 A14 14 0 1 1 0 -14", stroke: C.alice, "stroke-width": 4, fill: "none", "stroke-linecap": "round", transform: "translate(30 48)" }, browserG);
  const okMark = el("path", { d: "M18 48 l8 8 l16 -16", stroke: C.ok, "stroke-width": 5, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, browserG);
  const errMark = el("path", { d: "M20 38 l20 20 M40 38 l-20 20", stroke: C.mallory, "stroke-width": 5, "stroke-linecap": "round" }, browserG);
  const browserLine1 = text(browserG, 58, 46, "", { "font-size": 14, "font-weight": 700 });
  const browserLine2 = text(browserG, 58, 64, "", { "font-size": 11, fill: C.muted });

  // Side effects card.
  const fxG = el("g", { opacity: 0 }, svg);
  el("rect", { x: 905, y: 445, width: 360, height: 175, rx: 14, fill: "#FFFFFF", stroke: "#E1E5EA" }, fxG);
  const fxTitle = text(fxG, 923, 472, "Side effects", { "font-size": 15, "font-weight": 700 });
  const fxLines = [0, 1, 2, 3].map((i) => {
    const g = el("g", { opacity: 0 }, fxG);
    const dot = el("circle", { cx: 928, cy: 497 + i * 27, r: 5 }, g);
    const tx = text(g, 941, 502 + i * 27, "", { "font-size": 13 });
    return { g, dot, tx };
  });

  // Caption.
  const capG = el("g", { opacity: 0 }, svg);
  el("rect", { x: 20, y: 640, width: 1245, height: 56, rx: 28, fill: "#FFFFFF", stroke: "#E1E5EA" }, capG);
  const capBadge = el("circle", { cx: 50, cy: 668, r: 18, fill: "#0F6FDE" }, capG);
  const capN = text(capG, 50, 674, "", { "font-size": 17, "font-weight": 700, fill: "#FFFFFF", "text-anchor": "middle" });
  const capText = text(capG, 80, 675, "", { "font-size": 18, "font-weight": 600 });

  // Packets and drop marks (pooled).
  // The conntrack check sits above the packets (they pass through it), the crosses above both.
  const packetLayer = el("g", {}, svg);
  const gateG = el("g", {}, svg);
  const gate = el("rect", { x: R.gateX - 46, y: R.laneY - 15, width: 92, height: 30, rx: 8, fill: C.shell }, gateG);
  text(gateG, R.gateX, R.laneY + 4, "conntrack", { "font-size": 12, "font-weight": 700, fill: "#FFFFFF", "text-anchor": "middle", "font-family": MONO });
  const markLayer = el("g", {}, svg);
  const pool = [], marks = [];
  const getPacket = (i) => pool[i] ?? (pool[i] = el("circle", { r: 4 }, packetLayer));
  const getMark = (i) => marks[i] ?? (marks[i] = el("path", { d: "M-7 -7 L7 7 M7 -7 L-7 7", "stroke-width": 3.5, "stroke-linecap": "round", fill: "none" }, markLayer));

  const set = (e, attrs) => { for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); };

  const fillRow = (row, e, t) => {
    set(row.g, { opacity: 1 });
    row.note.textContent = "";
    const st = e.st.filter((s) => s.t <= t).pop() ?? e.st[0];
    const fresh = 1 - prog(t, e.t, e.t + 0.5);
    set(row.bg, { fill: C[e.host], "fill-opacity": 0.1 + 0.25 * fresh });
    set(row.bar, { fill: C[e.host], opacity: 1 });
    const left = e.refresh ? st.to : st.to - (t - st.t);
    const v = { proto: e.proto, lan: e.lan, wan: e.wan, remote: e.remote, state: st.s, timeout: fmtTimeout(left) };
    for (const [k, c] of Object.entries(row.cells)) {
      c.textContent = v[k];
      set(c, { fill: k === "state" ? STATE_COLOR[st.s] : C.ink, "font-weight": k === "state" ? 700 : 400 });
    }
  };
  const noteRow = (row, s, free) => {
    set(row.g, { opacity: 1 });
    for (const c of Object.values(row.cells)) c.textContent = "";
    set(row.bg, { fill: free ? "#F7F8FA" : "#FFFFFF", "fill-opacity": 1 });
    set(row.bar, { opacity: 0 });
    row.note.textContent = s;
    set(row.note, { fill: free ? "#B3BAC4" : C.muted });
  };

  return function render(t) {
    const tl = scene.tl;
    const fade = 1 - prog(t, tl.holdEnd, tl.holdEnd + 0.8);
    svg.style.opacity = String(Math.min(prog(t, 0, 0.4), fade));
    titleEl.setAttribute("opacity", String(prog(t, 0.2, 0.8)));
    const c = scene.cases.find((k) => t >= k.start && t < k.end) ?? (t >= tl.holdEnd ? scene.cases[scene.cases.length - 1] : null);

    // Intro: the front grows to the router's width, then the opened router replaces it.
    const z = prog(t, 0.5, 1.1);
    const zs = z * z * (3 - 2 * z);
    set(introG, { transform: `translate(${R.x + R.w / 2} ${R.y + R.h / 2}) scale(${1 + (R.w / 400 - 1) * zs})`, opacity: 1 - prog(t, 1.15, 1.35) });
    set(introText, { opacity: prog(t, 0.1, 0.4) * (1 - prog(t, 0.6, 0.9)) });
    const open = prog(t, 1.1, 1.5);
    set(routerG, { opacity: open });
    set(gateG, { opacity: open });

    // Table rows: everything if it fits, else the first rows, "… more", the newest rows.
    const filled = c ? c.entries.filter((e) => e.t <= t) : [];
    const n = filled.length, frac = n / N;
    if (n <= T.rows) {
      rows.forEach((row, i) => (i < n ? fillRow(row, filled[i], t) : i < N ? noteRow(row, "free", true) : set(row.g, { opacity: 0 })));
    } else {
      rows.forEach((row, i) => {
        if (i < T.head) fillRow(row, filled[i], t);
        else if (i === T.head) noteRow(row, `⋮   ${n - T.head - T.tail} more entries   ⋮`, false);
        else fillRow(row, filled[n - (T.rows - i)], t);
      });
    }
    counter.textContent = `${n} / ${N} entries`;
    const tone = frac >= 1 ? C.mallory : frac > 0.75 ? "#C27A00" : C.ink;
    set(counter, { fill: tone });
    set(gauge, { width: T.w * frac, fill: frac >= 1 ? C.mallory : frac > 0.75 ? "#F2A516" : "#46C27A" });
    if (c?.kind === "mitigation") {
      const m = filled.filter((e) => e.host === "mallory").length;
      limitText.textContent = `Limit per device: ${cfg.perHostLimit} · Mallory ${m} / ${cfg.perHostLimit}`;
    } else limitText.textContent = "";

    // Last dropped connection (Alice's stay longer, so they can be read).
    const recent = (c?.drops ?? []).filter((d) => d.t <= t && t - d.t < (d.host === "alice" ? 1.8 : 0.7));
    const drop = recent.filter((d) => d.host === "alice").pop() ?? recent.pop();
    set(dropG, { opacity: drop ? 1 : 0 });
    if (drop) {
      dropText.textContent = drop.text;
      set(dropText, { "font-weight": drop.host === "alice" ? 700 : 400 });
    }
    const justDropped = recent.some((d) => t - d.t < 0.15);
    set(gate, { fill: frac >= 1 ? C.mallory : justDropped ? "#B4553A" : C.shell });

    // Status bubble.
    const st = c?.status.find((s) => t >= s.t0 && t < s.t1);
    if (st) {
      statusText.textContent = st.text;
      set(statusBox, { fill: st.tone === "bad" ? C.mallory : st.tone === "ok" ? C.ok : "#0F6FDE" });
    }
    set(statusG, { opacity: st ? Math.min(1, (t - st.t0) / 0.3, (st.t1 - t) / 0.3) : 0 });

    // Hosts: the attacker glows while flooding.
    const floodingLan = c && (c.kind === "outbound" || c.kind === "mitigation") && t > c.start + 0.8 && t < c.start + 8;
    set(hostEls.mallory.halo, { opacity: floodingLan ? 0.12 + 0.1 * Math.sin(t * 8) : 0 });
    const floodingWan = c && c.kind === "inbound";
    set(botG, { opacity: floodingWan ? Math.min(1, (t - c.start) / 0.5, (c.end - t) / 0.4) : 0 });
    const saturated = floodingWan && t > c.start + 2;
    set(wanLink, { stroke: saturated ? C.botnet : C.link, "stroke-width": saturated ? 9 + 2 * Math.sin(t * 10) : 6 });
    lanLinks[2].setAttribute("stroke", floodingLan ? "#F3A3A5" : C.link);

    // Browser.
    const b = c?.browser.filter((s) => s.t <= t).pop();
    set(browserG, { opacity: b ? 1 : 0 });
    if (b) {
      set(spinner, { opacity: b.state === "loading" ? 1 : 0, transform: `translate(30 48) rotate(${(t * 360) % 360})` });
      set(okMark, { opacity: b.state === "ok" ? 1 : 0 });
      set(errMark, { opacity: b.state === "error" ? 1 : 0 });
      browserLine1.textContent = b.state === "loading" ? `Connecting to ${cfg.site}…` : b.state === "ok" ? `${cfg.site} loaded` : "This site can't be reached";
      set(browserLine1, { fill: b.state === "error" ? C.mallory : C.ink });
      browserLine2.textContent = b.state === "error" ? "ERR_CONNECTION_TIMED_OUT" : b.state === "ok" ? "200 OK" : "waiting for the router…";
    }

    // Side effects.
    const fx = c ? c.effects.filter((e) => e.t <= t + 0.0001) : [];
    set(fxG, { opacity: fx.length ? Math.min(1, (c.end - t) / 0.3) : 0 });
    fxTitle.textContent = c?.kind === "normal" ? "Good to know" : c?.kind === "mitigation" ? "Effect of the limits" : "Side effects";
    fxLines.forEach((l, i) => {
      const e = fx[i];
      set(l.g, { opacity: e ? prog(t, e.t, e.t + 0.4) : 0 });
      if (e) {
        l.tx.textContent = e.text;
        set(l.dot, { fill: e.tone === "bad" ? C.mallory : C.ok });
      }
    });

    // Caption.
    const cp = c?.caption;
    set(capG, { opacity: cp && t >= cp.t0 && t < cp.t1 ? Math.min(1, (t - cp.t0) / 0.4, (cp.t1 - t) / 0.3) : 0 });
    if (cp) {
      capN.textContent = c.n;
      capText.textContent = cp.text;
      set(capBadge, { fill: c.kind === "mitigation" ? C.ok : c.kind === "normal" ? "#0F6FDE" : C.mallory });
    }

    // Packets.
    let np = 0, nm = 0;
    for (const p of c?.packets ?? []) {
      if (t < p.t0) continue;
      const k = (t - p.t0) / p.dur;
      if (k <= 1) {
        const [x, y] = along(p.path, k);
        set(getPacket(np++), { cx: x, cy: y, r: p.r, fill: p.color, opacity: 1 });
      } else if (p.drop && t < p.t0 + p.dur + 0.5) {
        // Dropped: a cross that fades out.
        const [x, y] = p.path[p.path.length - 1];
        set(getMark(nm++), { transform: `translate(${x} ${y})`, stroke: p.color, opacity: 1 - (t - p.t0 - p.dur) / 0.5 });
      }
    }
    for (let i = np; i < pool.length; i++) pool[i].setAttribute("opacity", "0");
    for (let i = nm; i < marks.length; i++) marks[i].setAttribute("opacity", "0");
  };
}
