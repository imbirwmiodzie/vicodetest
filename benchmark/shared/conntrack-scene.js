// Router connection-table (conntrack / NAT) exhaustion, as a 2D network diagram.
//
// LAN hosts on the left (Alice, Bob, Mallory), the router with its connection table in
// the middle, the internet (example.com, attackers) on the right. Cases, each optional:
// normal use, a flood from the LAN filling the table, a flood from the internet doing
// the same, and the router protected by per-device limits and short timeouts.
//
// buildScene(cfg) simulates every packet of the enabled cases once (which ones get a
// table slot, which are dropped); render(t) then draws any moment of it, so the
// animation can be seeked freely. Used by the HyperFrames composition conntrack.html.

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
};
const HOSTS = {
  alice: { x: 150, y: 245, name: "Alice", role: "laptop" },
  bob: { x: 150, y: 385, name: "Bob", role: "phone · video call" },
  mallory: { x: 150, y: 525, name: "Mallory", role: "infected PC" },
};
const ROUTER = { x: 640, y: 250, w: 330, lanX: 470, wanX: 810 };
const TABLE = { x: 640, y: 336, cols: 8, slot: 34, gap: 5, rowH: 28 };
const SITE = { x: 1040, y: 245 };
const BOTNET = { x: 1080, y: 380 };
const hostOut = (h) => [HOSTS[h].x + 70, HOSTS[h].y];
const lanIn = (h) => [ROUTER.lanX, ROUTER.y + (HOSTS[h].y - 385) * 0.08];
const wanOut = [ROUTER.wanX, ROUTER.y];

// Small deterministic random numbers, so every render of a moment looks the same.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---- simulation -------------------------------------------------------------------

// Simulates one case: requests reach the router in time order and either get a table
// slot or are dropped (table full, or per-device limit when protected).
function simulateCase(kind, start, cfg) {
  const N = cfg.tableSize;
  const packets = [], entries = [], effects = [], status = [], browser = [];
  const requests = [];
  const add = (r) => requests.push(r);
  const rand = rng(kind.length * 977 + N);

  // Baseline: Bob's video call (one long connection) and two other connections from
  // earlier, already in the table when the case starts.
  const baseline = [["bob", "video call"], ["bob", "messages"], ["alice", "mail"]];
  baseline.forEach(([host], i) => entries.push({ t: start - 1 + i * 0.01, host }));

  // Bob's call: packets both ways all through the case (existing connection: no new slot).
  const lossy = kind === "inbound";
  for (let t = start + 0.4; t < start + ACT[kind] - 0.8; t += 0.55) {
    const flooded = lossy && t > start + 2.2;
    packets.push({ t0: t, path: [[SITE.x - 20, SITE.y + 30], wanOut, lanIn("bob"), hostOut("bob")], dur: 1.3, color: C.bob, r: 4.5, drop: flooded && Math.floor(t * 7) % 2 === 0 ? 1 : null });
  }

  const aliceRequest = (t, label, retry = false) => add({ host: "alice", t, label, retry });
  if (kind === "normal") {
    aliceRequest(start + 1.4, cfg.site);
    status.push({ t0: start + 0.6, t1: start + ACT.normal - 0.4, text: "1 connection = 1 slot in the table", tone: "info" });
  } else if (kind === "outbound" || kind === "mitigation") {
    for (let i = 0; i < 110; i++) add({ host: "mallory", t: start + 1.0 + i * 0.06, flood: true });
    if (kind === "outbound") {
      aliceRequest(start + 5.6, cfg.site);
      aliceRequest(start + 6.8, cfg.site, true);
      aliceRequest(start + 8.0, cfg.site, true);
    } else {
      aliceRequest(start + 4.8, cfg.site);
    }
  } else if (kind === "inbound") {
    for (let i = 0; i < 120; i++) add({ host: "botnet", t: start + 1.0 + i * 0.055, flood: true, inbound: true });
    aliceRequest(start + 5.6, cfg.site);
    aliceRequest(start + 6.8, cfg.site, true);
    aliceRequest(start + 8.0, cfg.site, true);
  }

  // Requests reach the router 0.6 s after leaving; decide slot or drop in arrival order.
  const perHost = { alice: 1, bob: 2, mallory: 0, botnet: 0 };
  let count = entries.length, fullAt = null;
  const arrivals = requests.map((r) => ({ ...r, ta: r.t + 0.6 })).sort((a, b) => a.ta - b.ta);
  for (const r of arrivals) {
    const limited = kind === "mitigation" && perHost[r.host] >= cfg.perHostLimit;
    const ok = count < N && !limited;
    if (ok) {
      count++;
      perHost[r.host]++;
      entries.push({ t: r.ta, host: r.host });
      if (count === N && fullAt === null) fullAt = r.ta;
    }
    const color = C[r.host];
    if (r.inbound) {
      const from = [BOTNET.x - 30 + rand() * 60, BOTNET.y - 20 + rand() * 40];
      packets.push({ t0: r.t, path: ok ? [from, wanOut, [ROUTER.x + 40, ROUTER.y]] : [from, wanOut], dur: ok ? 0.9 : 0.6, color, r: 4, drop: ok ? null : 1 });
    } else if (r.host === "mallory") {
      const to = [930 + rand() * 230, 170 + rand() * 230];
      packets.push({ t0: r.t, path: ok ? [hostOut("mallory"), lanIn("mallory"), wanOut, to] : [hostOut("mallory"), lanIn("mallory")], dur: ok ? 1.5 : 0.6, color, r: 4, drop: ok ? null : 1, limited });
    } else {
      // Alice: request out and, if it got a slot, the reply back.
      const path = [hostOut("alice"), lanIn("alice"), wanOut, [SITE.x - 20, SITE.y + 30]];
      packets.push({ t0: r.t, path: ok ? path : path.slice(0, 2), dur: ok ? 1.4 : 0.6, color, r: 6, drop: ok ? null : 1 });
      if (ok) packets.push({ t0: r.t + 1.7, path: [...path].reverse(), dur: 1.4, color, r: 6, drop: null });
      if (!r.retry) browser.push({ t: r.t, state: "loading" });
      if (ok) browser.push({ t: r.t + 3.1, state: "ok" });
    }
  }
  const aliceFails = arrivals.filter((r) => r.host === "alice").every((r) => !entries.some((e) => e.host === "alice" && Math.abs(e.t - r.ta) < 1e-6));
  if (aliceFails && kind !== "normal") browser.push({ t: start + 9.2, state: "error" });

  // Router status, side effects, captions.
  const cap = (text) => ({ t0: start + 0.3, t1: start + ACT[kind] - 0.3, text });
  let caption;
  if (kind === "normal") {
    caption = cap("Normal: every connection through the router takes one slot in its connection table (NAT)");
    effects.push({ t: start + 4.6, text: "Slots are freed when a connection ends or times out", tone: "ok" });
  } else if (kind === "outbound") {
    caption = cap("Flood from the LAN: Mallory's infected PC opens thousands of connections and fills the table");
    if (fullAt) status.push({ t0: fullAt, t1: start + ACT[kind] - 0.4, text: "Table full · new connections dropped", tone: "bad" });
    [["New connections fail on every device", 6.3], ["Open connections keep working (Bob's call)", 7.5],
      ["Router under load: slow, may even reboot", 8.7], ["The ISP sees a flood coming from your line", 9.9]]
      .forEach(([text, dt]) => effects.push({ t: start + dt, text, tone: "bad" }));
  } else if (kind === "inbound") {
    caption = cap("The opposite direction: attackers on the internet flood the router's internet side");
    if (fullAt) status.push({ t0: fullAt, t1: start + ACT[kind] - 0.4, text: "Table full · internet line saturated", tone: "bad" });
    [["New connections fail for everyone", 6.3], ["Line saturated: calls and video stutter", 7.5],
      ["Port forwards (NAS, camera) unreachable", 8.7], ["Only the ISP can filter it before your line", 9.9]]
      .forEach(([text, dt]) => effects.push({ t: start + dt, text, tone: "bad" }));
  } else {
    caption = cap(`Protected: max. ${cfg.perHostLimit} connections per device, short timeouts for unanswered ones`);
    status.push({ t0: start + 0.6, t1: start + ACT[kind] - 0.4, text: `Limit: ${cfg.perHostLimit} connections per device`, tone: "ok" });
    [[`Mallory is capped at ${cfg.perHostLimit} slots, the rest is dropped`, 3.6], ["The table keeps room for everyone else", 5.0],
      [`Alice's page opens normally`, 8.2], ["Unanswered connections expire quickly", 9.4]]
      .forEach(([text, dt]) => effects.push({ t: start + dt, text, tone: "ok" }));
  }
  return { kind, start, end: start + ACT[kind], packets, entries, effects, status, browser, caption, flood: requests.some((r) => r.flood) && requests.find((r) => r.flood) };
}

export function buildScene(cfg) {
  const tl = timeline(cfg);
  const cases = ["normal", "outbound", "inbound", "mitigation"].filter((k) => tl.at[k] !== undefined).map((k) => simulateCase(k, tl.at[k], cfg));
  cases.forEach((c, i) => (c.n = String(i + 1)));
  return { cfg, tl, cases };
}

// ---- drawing ----------------------------------------------------------------------

const SVGNS = "http://www.w3.org/2000/svg";
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}
const text = (parent, x, y, s, attrs = {}) => {
  const e = el("text", { x, y, "font-family": "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", fill: C.ink, ...attrs }, parent);
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

// Builds the static diagram once; returns render(t) for the moving parts.
export function createRenderer(svg, scene, routerImage) {
  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
  const { cfg } = scene;
  el("rect", { width: WIDTH, height: HEIGHT, fill: "#F6F7F9" }, svg);
  const titleEl = text(svg, 40, 56, cfg.title, { "font-size": 30, "font-weight": 700 });

  // Areas.
  el("rect", { x: 30, y: 165, width: 300, height: 455, rx: 18, fill: "#FFFFFF", stroke: "#E1E5EA" }, svg);
  text(svg, 50, 193, "Home / office network (LAN)", { "font-size": 15, fill: C.muted, "font-weight": 600 });
  const cloud = el("path", {
    d: "M900 330 C860 330 850 270 900 262 C895 200 970 180 1000 215 C1025 160 1120 160 1135 220 C1200 215 1225 280 1185 310 C1225 360 1180 430 1120 420 C1090 460 1010 460 985 425 C935 450 880 410 900 330 Z",
    fill: "#EAF2FC", stroke: "#C9DAF0", "stroke-width": 2,
  }, svg);
  text(svg, 1000, 150, "Internet", { "font-size": 15, fill: C.muted, "font-weight": 600 });

  // Links.
  const lanLinks = Object.keys(HOSTS).map((h) =>
    el("path", { d: `M${hostOut(h)[0]} ${hostOut(h)[1]} L${lanIn(h)[0]} ${lanIn(h)[1]}`, stroke: C.link, "stroke-width": 4, fill: "none", "stroke-linecap": "round" }, svg));
  const wanLink = el("path", { d: `M${ROUTER.wanX} ${ROUTER.y} L915 ${ROUTER.y + 20}`, stroke: C.link, "stroke-width": 6, fill: "none", "stroke-linecap": "round" }, svg);

  // Hosts.
  const hostEls = {};
  for (const [id, h] of Object.entries(HOSTS)) {
    const g = el("g", { transform: `translate(${h.x} ${h.y})` }, svg);
    const halo = el("circle", { r: 62, fill: C[id], opacity: 0 }, g);
    (id === "alice" ? laptop : id === "bob" ? phone : desktop)(g, C[id]);
    text(g, 0, 58, h.name, { "font-size": 17, "font-weight": 700, "text-anchor": "middle" });
    text(g, 0, 77, h.role, { "font-size": 13, fill: C.muted, "text-anchor": "middle" });
    hostEls[id] = { halo };
  }

  // Internet side: the site and the attackers.
  const siteG = el("g", { transform: `translate(${SITE.x} ${SITE.y})` }, svg);
  server(siteG);
  text(siteG, 0, 46, cfg.site, { "font-size": 15, "font-weight": 600, "text-anchor": "middle" });
  const botG = el("g", { transform: `translate(${BOTNET.x} ${BOTNET.y})`, opacity: 0 }, svg);
  [[-46, 0], [0, -10], [46, 4]].forEach(([dx, dy]) => attacker(el("g", { transform: `translate(${dx} ${dy})` }, botG), C.botnet));
  text(botG, 0, 38, "attackers on the internet", { "font-size": 13, fill: C.botnet, "font-weight": 600, "text-anchor": "middle" });

  // Router (the CB3 back panel drawing) and its table.
  el("rect", { x: ROUTER.x - ROUTER.w / 2 - 20, y: ROUTER.y - 75, width: ROUTER.w + 40, height: 290 + Math.ceil(cfg.tableSize / 8) * TABLE.rowH - 112, rx: 18, fill: "#FFFFFF", stroke: "#E1E5EA" }, svg);
  text(svg, ROUTER.x, ROUTER.y - 48, "Router (NAT)", { "font-size": 17, "font-weight": 700, "text-anchor": "middle" });
  const imgH = (ROUTER.w * 260) / 1360;
  el("image", { href: routerImage, x: ROUTER.x - ROUTER.w / 2, y: ROUTER.y - imgH / 2, width: ROUTER.w, height: imgH }, svg);
  text(svg, TABLE.x - (TABLE.cols * (TABLE.slot + TABLE.gap)) / 2, TABLE.y - 12, "Connection table", { "font-size": 14, "font-weight": 600 });
  const counter = text(svg, TABLE.x + (TABLE.cols * (TABLE.slot + TABLE.gap)) / 2 - 4, TABLE.y - 12, "", { "font-size": 14, "font-weight": 700, "text-anchor": "end" });
  const slots = [];
  const left = TABLE.x - (TABLE.cols * (TABLE.slot + TABLE.gap) - TABLE.gap) / 2;
  for (let i = 0; i < cfg.tableSize; i++) {
    const x = left + (i % TABLE.cols) * (TABLE.slot + TABLE.gap), y = TABLE.y + Math.floor(i / TABLE.cols) * TABLE.rowH;
    slots.push(el("rect", { x, y, width: TABLE.slot, height: TABLE.rowH - 6, rx: 5, fill: "#EEF1F4", stroke: "#D9DEE4" }, svg));
  }
  const barY = TABLE.y + Math.ceil(cfg.tableSize / TABLE.cols) * TABLE.rowH + 4;
  const barW = TABLE.cols * (TABLE.slot + TABLE.gap) - TABLE.gap;
  el("rect", { x: left, y: barY, width: barW, height: 8, rx: 4, fill: "#E6E9ED" }, svg);
  const bar = el("rect", { x: left, y: barY, width: 0, height: 8, rx: 4, fill: "#46C27A" }, svg);

  // Router status bubble.
  const statusG = el("g", { opacity: 0 }, svg);
  const statusBox = el("rect", { x: ROUTER.x - 190, y: ROUTER.y - 128, width: 380, height: 36, rx: 18 }, statusG);
  const statusText = text(statusG, ROUTER.x, ROUTER.y - 104, "", { "font-size": 15, "font-weight": 700, fill: "#FFFFFF", "text-anchor": "middle" });

  // Alice's browser.
  const browserG = el("g", { transform: "translate(40 82)", opacity: 0 }, svg);
  el("rect", { width: 280, height: 74, rx: 10, fill: "#FFFFFF", stroke: "#D5DAE0" }, browserG);
  el("rect", { width: 280, height: 22, rx: 10, fill: "#EEF1F4" }, browserG);
  [0, 1, 2].forEach((i) => el("circle", { cx: 14 + i * 12, cy: 11, r: 4, fill: ["#F25F58", "#FBBE2E", "#38C746"][i] }, browserG));
  const urlText = text(browserG, 58, 15, `Alice's browser · ${cfg.site}`, { "font-size": 11, fill: C.muted });
  const spinner = el("path", { d: "M14 0 A14 14 0 1 1 0 -14", stroke: C.alice, "stroke-width": 4, fill: "none", "stroke-linecap": "round", transform: "translate(30 48)" }, browserG);
  const okMark = el("path", { d: "M18 48 l8 8 l16 -16", stroke: "#2FB463", "stroke-width": 5, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, browserG);
  const errMark = el("path", { d: "M20 38 l20 20 M40 38 l-20 20", stroke: C.mallory, "stroke-width": 5, "stroke-linecap": "round" }, browserG);
  const browserLine1 = text(browserG, 58, 46, "", { "font-size": 14, "font-weight": 700 });
  const browserLine2 = text(browserG, 58, 64, "", { "font-size": 11, fill: C.muted });

  // Side effects card.
  const fxG = el("g", { opacity: 0 }, svg);
  el("rect", { x: 860, y: 465, width: 390, height: 150, rx: 14, fill: "#FFFFFF", stroke: "#E1E5EA" }, fxG);
  const fxTitle = text(fxG, 880, 492, "Side effects", { "font-size": 15, "font-weight": 700 });
  const fxLines = [0, 1, 2, 3].map((i) => {
    const g = el("g", { opacity: 0 }, fxG);
    const dot = el("circle", { cx: 886, cy: 515 + i * 26, r: 5 }, g);
    const tx = text(g, 900, 520 + i * 26, "", { "font-size": 14 });
    return { g, dot, tx };
  });

  // Caption.
  const capG = el("g", { opacity: 0 }, svg);
  el("rect", { x: 30, y: 640, width: 1220, height: 56, rx: 28, fill: "#FFFFFF", stroke: "#E1E5EA" }, capG);
  const capBadge = el("circle", { cx: 60, cy: 668, r: 18, fill: "#0F6FDE" }, capG);
  const capN = text(capG, 60, 674, "", { "font-size": 17, "font-weight": 700, fill: "#FFFFFF", "text-anchor": "middle" });
  const capText = text(capG, 90, 675, "", { "font-size": 19, "font-weight": 600 });

  // Packets and drop marks (pooled).
  const packetLayer = el("g", {}, svg);
  const pool = [], marks = [];
  const getPacket = (i) => pool[i] ?? (pool[i] = el("circle", { r: 4 }, packetLayer));
  const getMark = (i) => marks[i] ?? (marks[i] = el("path", { d: "M-7 -7 L7 7 M7 -7 L-7 7", "stroke-width": 3.5, "stroke-linecap": "round", fill: "none" }, packetLayer));

  const set = (e, attrs) => { for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); };

  return function render(t) {
    const tl = scene.tl;
    const fade = 1 - prog(t, tl.holdEnd, tl.holdEnd + 0.8);
    svg.style.opacity = String(Math.min(prog(t, 0, 0.6), fade));
    titleEl.setAttribute("opacity", String(prog(t, 0.2, 0.8)));
    const c = scene.cases.find((k) => t >= k.start && t < k.end) ?? (t >= tl.holdEnd ? scene.cases[scene.cases.length - 1] : null);

    // Table.
    const filled = c ? c.entries.filter((e) => e.t <= t) : [];
    slots.forEach((s, i) => {
      const e = filled[i];
      set(s, e ? { fill: C[e.host], stroke: C[e.host] } : { fill: "#EEF1F4", stroke: "#D9DEE4" });
    });
    const n = filled.length, N = cfg.tableSize, frac = n / N;
    counter.textContent = `${n} / ${N}`;
    set(counter, { fill: frac >= 1 ? C.mallory : frac > 0.75 ? "#C27A00" : C.ink });
    set(bar, { width: barW * frac, fill: frac >= 1 ? C.mallory : frac > 0.75 ? "#F2A516" : "#46C27A" });

    // Status bubble.
    const st = c?.status.find((s) => t >= s.t0 && t < s.t1);
    if (st) {
      statusText.textContent = st.text;
      set(statusBox, { fill: st.tone === "bad" ? C.mallory : st.tone === "ok" ? "#2FB463" : "#0F6FDE" });
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
        set(l.dot, { fill: e.tone === "bad" ? C.mallory : "#2FB463" });
      }
    });

    // Caption.
    const cp = c?.caption;
    set(capG, { opacity: cp && t >= cp.t0 && t < cp.t1 ? Math.min(1, (t - cp.t0) / 0.4, (cp.t1 - t) / 0.3) : 0 });
    if (cp) {
      capN.textContent = c.n;
      capText.textContent = cp.text;
      set(capBadge, { fill: c.kind === "mitigation" ? "#2FB463" : c.kind === "normal" ? "#0F6FDE" : C.mallory });
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
        // Dropped at the router: a cross that fades out.
        const [x, y] = p.path[p.path.length - 1];
        set(getMark(nm++), { transform: `translate(${x} ${y})`, stroke: p.color, opacity: 1 - (t - p.t0 - p.dur) / 0.5 });
      }
    }
    for (let i = np; i < pool.length; i++) pool[i].setAttribute("opacity", "0");
    for (let i = nm; i < marks.length; i++) marks[i].setAttribute("opacity", "0");
  };
}
