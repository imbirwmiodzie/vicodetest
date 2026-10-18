// Everyday analogies for the router's connection table filling up (see conntrack-scene.js):
//   kitchen: the order rail at the kitchen pass. Every order is one ticket on the rail until
//            the dish is served; a prankster guest orders dishes nobody eats; prank phone
//            orders come in from outside.
//   cars:    a Park & Ride. Every trip parks one car until the traveller is back; a
//            prankster tows in junk cars that never go anywhere; cars from other towns take
//            the spaces from outside.
// Same layout, cases and simulation as the router demo, so the two can be compared side by
// side: guests / residents on the left, the shared resource opened up in the middle, the
// kitchen / city on the right. Each caption has a second line saying what it means in the
// router. Used by the HyperFrames compositions kitchen.html and cars.html.

export const WIDTH = 1280;
export const HEIGHT = 720;

const COMMON = { normal: true, outbound: true, inbound: true, mitigation: true, speed: 1, loop: true };
const THEME_DEFAULTS = {
  kitchen: { title: "When the kitchen's order rail is full", site: "Pizza", tableSize: 16, perHostLimit: 4, ...COMMON },
  cars: { title: "When the Park & Ride is full", site: "City centre", tableSize: 24, perHostLimit: 4, ...COMMON },
};
export const THEME_NAMES = Object.keys(THEME_DEFAULTS);
export const defaults = (theme) => ({ ...THEME_DEFAULTS[theme] });

export function normalize(theme, raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const out = defaults(theme);
  for (const k of ["title", "site"]) if (typeof r[k] === "string" && r[k]) out[k] = r[k];
  for (const k of ["normal", "outbound", "inbound", "mitigation", "loop"]) if (typeof r[k] === "boolean") out[k] = r[k];
  out.tableSize = Math.round(Math.min(24, Math.max(8, num(r.tableSize, out.tableSize))) / 8) * 8;
  out.perHostLimit = Math.round(Math.min(8, Math.max(2, num(r.perHostLimit, out.perHostLimit))));
  out.speed = Math.min(4, Math.max(0.1, num(r.speed, 1)));
  return out;
}

// ---- timeline ---------------------------------------------------------------------

const ACT = { intro: 3.2, normal: 8.0, outbound: 13.0, inbound: 13.0, mitigation: 11.5, outro: 2.0 };
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

// ---- layout (as in the router demo) -------------------------------------------------

const C = {
  alice: "#2F7BEA",
  bob: "#14A39A",
  mallory: "#E5484D",
  botnet: "#F2711C",
  link: "#B8C0CC",
  ink: "#1B1F27",
  muted: "#5E6673",
  ok: "#2FB463",
};
const HOSTS = {
  alice: { x: 78, y: 262, port: 0 },
  bob: { x: 78, y: 392, port: 1 },
  mallory: { x: 78, y: 522, port: 2 },
};
const R = { x: 290, y: 170, w: 590, h: 450, laneY: 250, gateX: 585 };
const G = { x: 312, y: 294, cols: 8, cw: 62, ch: 66, gx: 6, gy: 8 };
const SITE = { x: 1060, y: 240 };
const CALL = [965, 300];
const BOTNET = { x: 1115, y: 392 };
const CLOUD_IN = [940, 262];
// Outsiders (prank callers, cars from other towns) come in below the kitchen / city box.
const OUTSIDE_IN = [[BOTNET.x - 62, BOTNET.y + 4], [900, 380], [R.x + R.w, R.laneY]];
const hostOut = (h) => [256, HOSTS[h].y - 4];
const lanIn = (h) => [R.x, R.laneY - 12 + HOSTS[h].port * 12];
const LANE_IN = [R.x + 40, R.laneY];
const GATE = [R.gateX, R.laneY];
const WAN_OUT = [R.x + R.w, R.laneY];
const SITE_IN = [SITE.x - 40, SITE.y + 14];

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const pathLen = (path) => path.slice(1).reduce((l, p, i) => l + Math.hypot(p[0] - path[i][0], p[1] - path[i][1]), 0);

// ---- themes -------------------------------------------------------------------------
// Timeouts are in minutes; the clock runs one minute per second of animation.

const DISHES = ["Burger", "Pasta", "Steak", "Salad", "Fries", "Tiramisu", "Risotto", "Lasagne", "Curry", "Soup"];
const CANTONS = ["BE", "AG", "LU", "SO", "SG", "TG", "FR", "VD"];

const THEMES = {
  kitchen: {
    speed: 600,
    names: { alice: "Alice", bob: "Bob", mallory: "Mallory" },
    roles: { alice: "guest", bob: "guest · main course", mallory: "prankster guest" },
    ids: { alice: "table 1", bob: "table 2", mallory: "table 3" },
    lanArea: "Dining room",
    farArea: "Kitchen",
    attackers: "prank callers",
    boxTitle: "Inside the kitchen pass",
    boxSub: "Order rail · ≈ the router's connection table",
    laneLeft: "from the dining room",
    laneRight: "kitchen / phone",
    gate: "waiter",
    unit: ["ticket", "tickets"],
    gaugeLabel: "Order rail",
    shapes: { out: "note", onward: "note", reply: "plate", ongoing: "plate", inbound: "phoneNote" },
    malloryOnward: true,
    reply: true,
    states: { pending: "ORDERED", open: "COOKING", inbound: "CALLED IN" },
    stateColor: { ORDERED: "#B26A00", COOKING: "#1F8F4E", "CALLED IN": "#C2410C" },
    to: { pending: 20, pendingProtected: 5, open: 120, inbound: 15 },
    fmt: (m) => (m >= 60 ? `${Math.round(m / 60)}h` : `${Math.max(0, Math.ceil(m))}m`),
    baseline: [["bob", "Steak"], ["bob", "Wine"], ["alice", "Soup"]],
    fields(host, rand, cfg) {
      if (host === "alice") return { who: "T1·Alice", what: cfg.site };
      if (host === "bob") return { who: "T2·Bob", what: "Steak" };
      if (host === "mallory") return { who: "T3·Mallory", what: pick(rand, DISHES) };
      return { who: "Phone ☎", what: pick(rand, DISHES) };
    },
    dropText: (e, why) => `${e.who} · ${e.what}  (${why})`,
    full: "rail full",
    limitWhy: (L) => `limit ${L} per table`,
    intro: [
      ["Order rail at the pass", "the router's connection table"],
      ["One order ticket", "one connection"],
      ["Guests in the dining room", "devices in your network"],
      ["Prankster guest", "an infected PC"],
      ["Prank phone orders", "attackers on the internet"],
    ],
    browser: {
      title: (s) => `Alice's order · ${s}`,
      loading: (s) => [`Ordering ${s}…`, "waiting for the waiter…"],
      ok: (s) => [`${s} served`, "enjoy your meal"],
      error: () => ["Sorry, we can't take your order", "no free clip on the rail"],
    },
    status: {
      normal: "1 order = 1 ticket on the rail",
      outbound: "Rail full · no new orders",
      inbound: "Rail full · waiters stuck at the phone",
      mitigation: (L) => `Limit: ${L} open orders per table`,
    },
    captions: {
      normal: ["Normal: every order is one ticket clipped on the rail until the dish is served", "In the router: every connection is one entry in the connection table"],
      outbound: ["Mallory, a prankster at table 3, orders dozens of dishes nobody will eat", "In the router: an infected PC opens thousands of connections and fills the table"],
      inbound: ["From outside: prank phone orders fill the rail and keep the waiters at the phone", "In the router: attackers on the internet flood it and fill the table"],
      mitigation: (L) => [`House rule: max. ${L} open orders per table, unconfirmed ones thrown out after 5 min`, "In the router: a limit per device and short timeouts for unanswered connections"],
    },
    effects: {
      normal: ["A clip is freed when the dish is served or cancelled", "Long dinners keep their ticket for hours"],
      outbound: ["Nobody else can place an order", "Orders already on the rail still come (Bob)", "Waiters and cooks overloaded", "Food wasted on orders nobody eats"],
      inbound: ["Guests in the room can't order", "Waiters on the phone: Bob's plates come late", "Real delivery customers can't get through", "Only the phone company can block the callers"],
      mitigation: (L) => [`Mallory capped at ${L} open orders`, "The rail keeps room for other guests", "Alice gets her order", "Unconfirmed orders thrown out after 5 min"],
    },
  },
  cars: {
    speed: 480,
    names: { alice: "Alice", bob: "Bob", mallory: "Mallory" },
    roles: { alice: "resident · driving", bob: "resident · on a trip", mallory: "prankster · tow truck" },
    ids: { alice: "ZH 1010", bob: "ZH 1011", mallory: "ZH 66··" },
    lanArea: "Town",
    farArea: "City & motorway",
    attackers: "cars from other towns",
    boxTitle: "Inside the Park & Ride",
    boxSub: "Parking spaces · ≈ the router's connection table",
    laneLeft: "from town",
    laneRight: "train / motorway",
    gate: "barrier",
    unit: ["space", "spaces"],
    gaugeLabel: "Spaces taken",
    shapes: { out: "car", onward: "train", reply: null, ongoing: "train", inbound: "car" },
    malloryOnward: false,
    reply: false,
    states: { pending: "NO TRIP", open: "ON TRIP", inbound: "STRANGER" },
    stateColor: { "NO TRIP": "#FFB347", "ON TRIP": "#6EE7A0", STRANGER: "#FF8A65" },
    to: { pending: 120, pendingProtected: 30, open: 7200, inbound: 60 },
    fmt: (m) => (m >= 1440 ? `${Math.round(m / 1440)}d` : `${Math.floor(Math.max(0, m) / 60)}:${String(Math.max(0, Math.ceil(m)) % 60).padStart(2, "0")}`),
    baseline: [["bob", "ZH 1011"], ["bob", "ZH 1012"], ["alice", "ZH 1013"]],
    fields(host, rand) {
      if (host === "alice") return { who: "ZH 1010" };
      if (host === "mallory") return { who: `ZH 66${String(Math.floor(rand() * 100)).padStart(2, "0")}` };
      return { who: `${pick(rand, CANTONS)} ${1000 + Math.floor(rand() * 9000)}` };
    },
    dropText: (e, why) => `${e.who}  (${why})`,
    full: "car park full",
    limitWhy: (L) => `limit ${L} per household`,
    intro: [
      ["Park & Ride spaces", "the router's connection table"],
      ["One parked car", "one connection"],
      ["Residents of the town", "devices in your network"],
      ["Prankster's junk cars", "an infected PC"],
      ["Cars from other towns", "attackers on the internet"],
    ],
    browser: {
      title: (s) => `Alice's trip · ${s}`,
      loading: (s) => ["Driving to the Park & Ride…", `then the train to ${s}`],
      ok: (s) => [`Arrived: ${s}`, "car parked, train taken"],
      error: (s) => ["Car park full", `Alice can't get to ${s}`],
    },
    status: {
      normal: "1 trip = 1 parked car",
      outbound: "Car park full · barrier stays closed",
      inbound: "Car park full · access road jammed",
      mitigation: (L) => `Limit: ${L} spaces per household`,
    },
    captions: {
      normal: ["Normal: every resident who takes the train parks one car until they come back", "In the router: every connection is one entry in the connection table"],
      outbound: ["Mallory tows in dozens of junk cars that never go anywhere: the car park is full", "In the router: an infected PC opens thousands of connections and fills the table"],
      inbound: ["From outside: cars from other towns take every space and jam the access road", "In the router: attackers on the internet flood it and fill the table"],
      mitigation: (L) => [`Rule: max. ${L} spaces per household, cars without a train trip towed after 30 min`, "In the router: a limit per device and short timeouts for unanswered connections"],
    },
    effects: {
      normal: ["A space is freed when the car leaves or is towed", "Long trips keep their space for days"],
      outbound: ["New cars can't get in, nobody reaches the train", "Cars already parked are fine (Bob)", "The queue at the barrier backs up into town", "The operator traces the junk cars to your town"],
      inbound: ["Residents can't park any more", "Access road jammed: Bob's trains run late", "Visitors you invited can't get in either", "Only the police can stop them on the motorway"],
      mitigation: (L) => [`Mallory capped at ${L} spaces`, "Spaces stay free for everyone else", "Alice parks and takes the train", "Cars without a train trip towed after 30 min"],
    },
  },
};

// ---- simulation (as in the router demo) -------------------------------------------------

function simulateCase(th, kind, start, cfg) {
  const N = cfg.tableSize, L = cfg.perHostLimit;
  const protectedCase = kind === "mitigation";
  const pendingTo = protectedCase ? th.to.pendingProtected : th.to.pending;
  const packets = [], entries = [], drops = [], effects = [], status = [], browser = [];
  const requests = [];
  const rand = rng(kind.length * 977 + N);
  const pkt = (t0, path, color, shape, drop = null) => packets.push({ t0, path, dur: pathLen(path) / th.speed, color, shape, drop });
  let ticket = 4010 + Math.floor(rand() * 40);

  // Already there when the case starts.
  for (const [host, label] of th.baseline) {
    const f = th.fields(host, rand, cfg);
    entries.push({ t: start - 1, host, ticket: ticket++, ...f, ...(th === THEMES.cars ? { who: label } : { what: label }), st: [{ t: start - 1, s: th.states.open, to: th.to.open }], refresh: host === "bob" });
  }

  // Bob's ongoing activity on his existing entries: plates from the grill / his trains.
  const lossy = kind === "inbound";
  let i = 0;
  for (let t = start + 0.4; t < start + ACT[kind] - 0.8; t += 0.7, i++) {
    const flooded = lossy && t > start + 2.2 && i % 2 === 0;
    if (th.reply) {
      if (flooded) pkt(t, [CALL, CLOUD_IN, WAN_OUT], C.bob, th.shapes.ongoing, 1);
      else pkt(t, [CALL, CLOUD_IN, WAN_OUT, GATE, LANE_IN, lanIn("bob"), hostOut("bob")], C.bob, th.shapes.ongoing);
    } else {
      const there = [WAN_OUT, CLOUD_IN, CALL];
      if (flooded) pkt(t, [CALL, CLOUD_IN], C.bob, th.shapes.ongoing, 1);
      else pkt(t, i % 2 ? there : [...there].reverse(), C.bob, th.shapes.ongoing);
    }
  }

  const flood = (host, n, dt) => {
    for (let k = 0; k < n; k++) requests.push({ host, t: start + 1.0 + k * dt, flood: true });
  };
  if (kind === "normal") requests.push({ host: "alice", t: start + 1.4 });
  else if (kind === "outbound" || kind === "mitigation") {
    flood("mallory", 70, 0.09);
    (kind === "outbound" ? [5.6, 6.8, 8.0] : [4.8]).forEach((dt) => requests.push({ host: "alice", t: start + dt }));
  } else {
    flood("botnet", 80, 0.08);
    [5.6, 6.8, 8.0].forEach((dt) => requests.push({ host: "alice", t: start + dt }));
  }

  for (const r of requests) {
    if (r.host === "botnet") {
      const from = [BOTNET.x - 34 + rand() * 68, BOTNET.y - 18 + rand() * 26];
      r.toGate = [from, ...OUTSIDE_IN, GATE];
      r.onward = null;
    } else {
      r.toGate = [hostOut(r.host), lanIn(r.host), LANE_IN, GATE];
      const dest = r.host === "alice" ? SITE_IN : [960 + rand() * 250, 190 + rand() * 130];
      r.onward = r.host === "mallory" && !th.malloryOnward ? null : [WAN_OUT, CLOUD_IN, dest];
    }
    r.f = th.fields(r.host, rand, cfg);
    r.ta = r.t + pathLen(r.toGate) / th.speed;
  }

  const perHost = { alice: 1, bob: 2, mallory: 0, botnet: 0 };
  let count = entries.length, fullAt = null, aliceOk = false;
  const insideLane = [GATE, WAN_OUT];
  for (const r of [...requests].sort((a, b) => a.ta - b.ta)) {
    const limited = protectedCase && perHost[r.host] >= L;
    const ok = count < N && !limited;
    const color = C[r.host];
    const shapeIn = r.host === "botnet" ? th.shapes.inbound : th.shapes.out;
    if (r.host === "alice") browser.push({ t: r.t, state: "loading" });
    if (!ok) {
      pkt(r.t, r.toGate, color, shapeIn, 1);
      drops.push({ t: r.ta, host: r.host, text: th.dropText(r.f, limited ? th.limitWhy(L) : th.full) });
      continue;
    }
    count++;
    perHost[r.host]++;
    if (count === N && fullAt === null) fullAt = r.ta;
    pkt(r.t, r.toGate, color, shapeIn);
    const e = { t: r.ta, host: r.host, ticket: ticket++, ...r.f };
    e.st = [{ t: r.ta, s: r.host === "botnet" ? th.states.inbound : th.states.pending, to: r.host === "botnet" ? th.to.inbound : pendingTo }];
    if (r.onward) {
      const lane = pathLen(insideLane) / th.speed;
      pkt(r.ta, insideLane, color, th.shapes.out === "note" ? "note" : "person");
      pkt(r.ta + lane, r.onward, color, th.shapes.onward);
      if (r.host === "alice") {
        aliceOk = true;
        const arrive = r.ta + lane + pathLen(r.onward) / th.speed;
        if (th.reply) {
          const back = [SITE_IN, CLOUD_IN, WAN_OUT, GATE, LANE_IN, lanIn("alice"), hostOut("alice")];
          pkt(arrive + 0.6, back, color, th.shapes.reply);
          e.st.push({ t: arrive + 0.6 + pathLen(back.slice(0, 4)) / th.speed, s: th.states.open, to: th.to.open });
          browser.push({ t: arrive + 0.6 + pathLen(back) / th.speed, state: "ok" });
        } else {
          e.st.push({ t: arrive, s: th.states.open, to: th.to.open });
          browser.push({ t: arrive, state: "ok" });
        }
      }
    }
    entries.push(e);
  }
  browser.sort((a, b) => a.t - b.t);
  if (!aliceOk && kind !== "normal") browser.push({ t: start + 9.2, state: "error" });

  const val = (v) => (typeof v === "function" ? v(L) : v);
  const [line1, line2] = val(th.captions[kind]);
  const caption = { t0: start + 0.3, t1: start + ACT[kind] - 0.3, text: line1, router: line2 };
  const st = val(th.status[kind]);
  if (kind === "normal" || kind === "mitigation") status.push({ t0: start + 0.6, t1: start + ACT[kind] - 0.4, text: st, tone: kind === "normal" ? "info" : "ok" });
  else if (fullAt) status.push({ t0: fullAt, t1: start + ACT[kind] - 0.4, text: st, tone: "bad" });
  const times = { normal: [4.6, 5.6], outbound: [6.3, 7.5, 8.7, 9.9], inbound: [6.3, 7.5, 8.7, 9.9], mitigation: [3.6, 5.0, 8.2, 9.4] }[kind];
  val(th.effects[kind]).forEach((text, k) => effects.push({ t: start + times[k], text, tone: kind === "outbound" || kind === "inbound" ? "bad" : "ok" }));
  return { kind, start, end: start + ACT[kind], packets, entries, drops, effects, status, browser, caption };
}

export function buildScene(theme, cfg) {
  const th = THEMES[theme];
  const tl = timeline(cfg);
  const cases = ["normal", "outbound", "inbound", "mitigation"].filter((k) => tl.at[k] !== undefined).map((k) => simulateCase(th, k, tl.at[k], cfg));
  cases.forEach((c, i) => (c.n = String(i + 1)));
  return { theme, th, cfg, tl, cases };
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
const set = (e, attrs) => { for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); };

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

// Moving things: one path per packet, shaped by kind.
const SHAPES = {
  note: { d: "M-6 -7 H6 V7 H-6 Z", fill: "#FFFDF7", strokeW: 2, rotate: false },
  phoneNote: { d: "M-6 -7 H6 V7 H-6 Z", fill: "#FFE7D6", strokeW: 2, rotate: false },
  plate: { d: "M-7 0 A7 7 0 1 0 7 0 A7 7 0 1 0 -7 0 Z", fill: "#FFFFFF", strokeW: 3, rotate: false },
  car: { d: "M-10 -6 H8 Q12 -6 12 -2 V2 Q12 6 8 6 H-10 Q-12 6 -12 2 V-2 Q-12 -6 -10 -6 Z", fill: null, strokeW: 1, rotate: true },
  train: { d: "M-16 -4.5 H12 Q17 -4.5 17 0 Q17 4.5 12 4.5 H-16 Z", fill: "#E9EDF2", strokeW: 2.5, rotate: true },
  person: { d: "M-4 0 A4 4 0 1 0 4 0 A4 4 0 1 0 -4 0 Z", fill: null, strokeW: 0, rotate: false },
};

// Left-side figures.
function guest(g, color, prankster) {
  el("ellipse", { cx: 0, cy: 30, rx: 42, ry: 9, fill: "#D9C4A8" }, g);
  el("path", { d: "M-24 26 C-24 2 24 2 24 26 Z", fill: color }, g);
  el("circle", { cx: 0, cy: -12, r: 14, fill: "#F1C9A5" }, g);
  el("path", { d: "M-14 -14 Q-12 -30 0 -28 Q12 -30 14 -14 Q6 -22 -14 -14 Z", fill: "#4A3426" }, g);
  if (prankster) {
    el("path", { d: "M-12 -22 L-16 -36 L-6 -25 Z M12 -22 L16 -36 L6 -25 Z", fill: C.mallory }, g);
    el("path", { d: "M-6 -6 Q0 -1 6 -6", stroke: "#4A3426", "stroke-width": 2, fill: "none" }, g);
  }
  el("ellipse", { cx: 22, cy: 28, rx: 9, ry: 3.5, fill: "#FFFFFF", stroke: "#C8B79F" }, g);
}
function carSide(g, color) {
  el("path", { d: "M-46 10 L-44 -4 Q-42 -9 -34 -10 L-22 -11 L-12 -24 L16 -24 L28 -11 L40 -9 Q46 -7 46 0 L46 10 Z", fill: color }, g);
  el("path", { d: "M-10 -21 L-18 -12 L-1 -12 L-1 -21 Z M2 -21 L2 -12 L24 -12 L15 -21 Z", fill: "#D7E8F7" }, g);
  for (const x of [-26, 28]) {
    el("circle", { cx: x, cy: 11, r: 9, fill: "#2A2F38" }, g);
    el("circle", { cx: x, cy: 11, r: 3.5, fill: "#9AA3AF" }, g);
  }
}
function towTruck(g, color) {
  el("rect", { x: -50, y: -4, width: 66, height: 12, rx: 2, fill: "#5A616C" }, g);
  el("path", { d: "M-46 -4 L-42 -14 L-30 -15 L-24 -24 L-6 -24 L2 -14 L10 -12 L10 -4 Z", fill: "#8A929C" }, g);
  el("path", { d: "M-30 -20 L-36 -13 M-14 -22 L-12 -15", stroke: "#5A616C", "stroke-width": 2 }, g);
  el("path", { d: "M16 10 L16 -22 Q16 -26 20 -26 L36 -26 L46 -10 L48 10 Z", fill: color }, g);
  el("path", { d: "M22 -22 L22 -11 L41 -11 L34 -22 Z", fill: "#D7E8F7" }, g);
  for (const x of [-34, 34]) {
    el("circle", { cx: x, cy: 11, r: 9, fill: "#2A2F38" }, g);
    el("circle", { cx: x, cy: 11, r: 3.5, fill: "#9AA3AF" }, g);
  }
}

// Right-side figures.
function oven(g) {
  el("path", { d: "M-38 22 L-38 0 A38 32 0 0 1 38 0 L38 22 Z", fill: "#B5562C" }, g);
  el("path", { d: "M-15 22 L-15 8 A15 13 0 0 1 15 8 L15 22 Z", fill: "#2A1A12" }, g);
  el("path", { d: "M-8 21 Q-6 10 0 14 Q2 6 6 12 Q10 10 8 21 Z", fill: "#FFB020" }, g);
  el("rect", { x: -6, y: -42, width: 12, height: 16, fill: "#8C4322" }, g);
}
function grill(g) {
  el("rect", { x: -30, y: -12, width: 60, height: 26, rx: 4, fill: "#3A404B" }, g);
  for (let i = 0; i < 5; i++) el("rect", { x: -24 + i * 11, y: -9, width: 4, height: 20, fill: "#E8643A" }, g);
}
function phoneIcon(g, color) {
  el("rect", { x: -11, y: -20, width: 22, height: 38, rx: 5, fill: "#2A2F38" }, g);
  el("rect", { x: -8, y: -15, width: 16, height: 26, rx: 2, fill: color }, g);
}
function station(g) {
  el("rect", { x: -40, y: -18, width: 80, height: 40, fill: "#C9D3DF" }, g);
  el("path", { d: "M-46 -18 L0 -40 L46 -18 Z", fill: "#7C8796" }, g);
  el("circle", { cx: 0, cy: -24, r: 7, fill: "#FFFFFF", stroke: "#5E6673" }, g);
  el("path", { d: "M0 -28 V-24 H3", stroke: "#5E6673", "stroke-width": 1.5, fill: "none" }, g);
  for (const x of [-28, -8, 12]) el("rect", { x, y: -6, width: 14, height: 28, fill: "#8FA3B8" }, g);
}

// One cell of the table: a ticket on the rail, or a parking space.
function ticketCell(parent, x, y, th) {
  const g = el("g", {}, parent);
  el("rect", { x: x + 25, y: y - 6, width: 12, height: 8, rx: 2, fill: "#8A929C" }, g);
  const free = el("g", {}, g);
  el("rect", { x: x + 0.5, y: y + 0.5, width: G.cw - 1, height: G.ch - 1, rx: 4, fill: "none", stroke: "#D3D7DD", "stroke-dasharray": "4 3" }, free);
  text(free, x + G.cw / 2, y + 37, "free clip", { "font-size": 9, fill: "#B3BAC4", "text-anchor": "middle" });
  const paper = el("g", {}, g);
  el("rect", { x, y, width: G.cw, height: G.ch, rx: 3, fill: "#FFFDF7", stroke: "#E3DCCF" }, paper);
  const strip = el("rect", { x, y, width: G.cw, height: 5, rx: 2 }, paper);
  const l1 = text(paper, x + 5, y + 18, "", { "font-size": 10.5, "font-weight": 700, "font-family": MONO });
  const l2 = text(paper, x + 5, y + 31, "", { "font-size": 9.5 });
  const l3 = text(paper, x + 5, y + 44, "", { "font-size": 10, "font-weight": 700 });
  const stx = text(paper, x + 5, y + 59, "", { "font-size": 8, "font-weight": 700 });
  const tox = text(paper, x + G.cw - 4, y + 59, "", { "font-size": 8.5, "font-family": MONO, "text-anchor": "end", fill: C.muted });
  return (e, st, left, fresh = 0) => {
    set(free, { opacity: e ? 0 : 1 });
    set(paper, { opacity: e ? 1 - 0.6 * fresh : 0, transform: `translate(0 ${-10 * fresh})` });
    if (!e) return;
    set(strip, { fill: C[e.host] });
    l1.textContent = `#${e.ticket}`;
    l2.textContent = e.who;
    l3.textContent = e.what;
    stx.textContent = st.s;
    set(stx, { fill: th.stateColor[st.s] });
    tox.textContent = th.fmt(left);
  };
}
function spaceCell(parent, x, y, th, index) {
  const g = el("g", {}, parent);
  el("rect", { x, y, width: G.cw, height: G.ch, fill: "#3A3F47" }, g);
  el("path", { d: `M${x + 1} ${y} V${y + G.ch} M${x + G.cw - 1} ${y} V${y + G.ch}`, stroke: "#E9ECEF", "stroke-width": 2 }, g);
  text(g, x + 5, y + 11, String(index + 1).padStart(2, "0"), { "font-size": 8, fill: "#8A929C", "font-family": MONO });
  const free = el("g", {}, g);
  text(free, x + G.cw / 2, y + 40, "P", { "font-size": 24, "font-weight": 700, fill: "#525963", "text-anchor": "middle" });
  text(free, x + G.cw / 2, y + 60, "free", { "font-size": 8.5, fill: "#8A929C", "text-anchor": "middle" });
  const car = el("g", {}, g);
  const body = el("rect", { x: x + 17, y: y + 6, width: 28, height: 38, rx: 7 }, car);
  el("rect", { x: x + 20, y: y + 13, width: 22, height: 7, rx: 2, fill: "#D7E8F7" }, car);
  el("rect", { x: x + 20, y: y + 35, width: 22, height: 5, rx: 2, fill: "#D7E8F7", opacity: 0.8 }, car);
  const info = el("g", {}, g);
  el("rect", { x: x + 5, y: y + 46, width: G.cw - 10, height: 10, rx: 2, fill: "#FFFFFF" }, info);
  const plate = text(info, x + G.cw / 2, y + 54.5, "", { "font-size": 8, "font-family": MONO, "font-weight": 700, "text-anchor": "middle" });
  const stx = text(info, x + 4, y + 64, "", { "font-size": 7, "font-weight": 700 });
  const tox = text(info, x + G.cw - 4, y + 64, "", { "font-size": 7.5, "font-family": MONO, fill: "#FFFFFF", "text-anchor": "end" });
  return (e, st, left, fresh = 0) => {
    set(free, { opacity: e ? 0 : 1 });
    set(car, { opacity: e ? 1 : 0, transform: `translate(0 ${-24 * fresh})` });
    set(info, { opacity: e ? 1 - fresh : 0 });
    if (!e) return;
    set(body, { fill: C[e.host] });
    plate.textContent = e.who;
    stx.textContent = st.s;
    set(stx, { fill: th.stateColor[st.s] });
    tox.textContent = th.fmt(left);
  };
}

// Builds the static picture once; returns render(t) for the moving parts.
export function createRenderer(svg, scene) {
  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
  const { cfg, th, theme } = scene;
  const N = cfg.tableSize;
  const cars = theme === "cars";
  el("rect", { width: WIDTH, height: HEIGHT, fill: "#F6F7F9" }, svg);
  const titleEl = text(svg, 30, 56, cfg.title, { "font-size": 30, "font-weight": 700 });

  // Areas.
  el("rect", { x: 20, y: 165, width: 240, height: 455, rx: 18, fill: cars ? "#EEF3EA" : "#FFFFFF", stroke: "#E1E5EA" }, svg);
  text(svg, 38, 193, th.lanArea, { "font-size": 14, fill: C.muted, "font-weight": 600 });
  el("rect", { x: 905, y: 168, width: 360, height: 170, rx: 18, fill: cars ? "#E8EEF6" : "#FFF3E2", stroke: cars ? "#C9DAF0" : "#F1D3A8", "stroke-width": 2 }, svg);
  if (cars) for (const [x, w, h] of [[925, 34, 70], [962, 26, 96], [1150, 30, 84], [1184, 40, 60], [1228, 22, 104]])
    el("rect", { x, y: 330 - h, width: w, height: h, fill: "#D5DFEB" }, svg);
  text(svg, 1085, 158, th.farArea, { "font-size": 15, fill: C.muted, "font-weight": 600, "text-anchor": "middle" });

  // Links: walkways in the restaurant, roads in town.
  const linkAttrs = cars ? { stroke: "#7C8590", "stroke-width": 9 } : { stroke: C.link, "stroke-width": 4 };
  const linkG = el("g", {}, svg);
  const lanLinks = Object.keys(HOSTS).map((h) => {
    const d = `M${hostOut(h)[0]} ${hostOut(h)[1]} L${lanIn(h)[0]} ${lanIn(h)[1]}`;
    const p = el("path", { d, fill: "none", "stroke-linecap": "round", ...linkAttrs }, linkG);
    if (cars) el("path", { d, stroke: "#FFFFFF", "stroke-width": 1.2, "stroke-dasharray": "6 6", fill: "none" }, linkG);
    return p;
  });
  const outsideD = "M" + OUTSIDE_IN.map(([x, y]) => `${x} ${y}`).join(" L");
  const outsideLink = el("path", { d: outsideD, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round", ...(cars ? { stroke: "#7C8590", "stroke-width": 9 } : { stroke: C.link, "stroke-width": 2.5, "stroke-dasharray": "6 5" }) }, linkG);
  if (cars) el("path", { d: outsideD, stroke: "#FFFFFF", "stroke-width": 1.2, "stroke-dasharray": "6 6", fill: "none" }, linkG);
  const wanLink = el("path", { d: `M${WAN_OUT[0]} ${WAN_OUT[1]} L${CLOUD_IN[0]} ${CLOUD_IN[1]}`, fill: "none", "stroke-linecap": "round", ...linkAttrs, "stroke-width": cars ? 12 : 6 }, linkG);

  // Left-side figures.
  const hostEls = {};
  for (const [id, h] of Object.entries(HOSTS)) {
    const g = el("g", { transform: `translate(${h.x} ${h.y})` }, svg);
    const halo = el("circle", { r: 58, fill: C[id], opacity: 0 }, g);
    if (cars) (id === "mallory" ? towTruck : carSide)(g, C[id]);
    else guest(g, C[id], id === "mallory");
    text(g, 62, -14, th.names[id], { "font-size": 17, "font-weight": 700 });
    text(g, 62, 3, th.roles[id], { "font-size": 12, fill: C.muted });
    text(g, 62, 20, th.ids[id], { "font-size": 12, fill: C[id], "font-family": MONO, "font-weight": 600 });
    hostEls[id] = { halo };
  }

  // Right-side figures.
  const siteG = el("g", { transform: `translate(${SITE.x} ${SITE.y})` }, svg);
  (cars ? station : oven)(siteG);
  text(siteG, 0, 42, cars ? cfg.site : `${cfg.site} · oven`, { "font-size": 14, "font-weight": 600, "text-anchor": "middle" });
  const callG = el("g", { transform: `translate(${CALL[0]} ${CALL[1]})` }, svg);
  if (!cars) {
    grill(callG);
    text(callG, 0, 30, "grill", { "font-size": 11, fill: C.muted, "text-anchor": "middle" });
  } else text(callG, 0, 26, "train line", { "font-size": 11, fill: C.muted, "text-anchor": "middle" });
  const botG = el("g", { transform: `translate(${BOTNET.x} ${BOTNET.y})`, opacity: 0 }, svg);
  [[-46, 0], [0, -8], [46, 4]].forEach(([dx, dy]) => {
    const g = el("g", { transform: `translate(${dx} ${dy}) scale(${cars ? 0.42 : 1})` }, botG);
    (cars ? carSide : phoneIcon)(g, C.botnet);
  });
  text(botG, 0, 34, th.attackers, { "font-size": 12, fill: C.botnet, "font-weight": 600, "text-anchor": "middle" });

  // The shared resource, opened up.
  const routerG = el("g", {}, svg);
  const shell = cars ? "#2F343C" : "#5B636E";
  el("rect", { x: R.x, y: R.y, width: R.w, height: R.h, rx: 22, fill: shell }, routerG);
  el("rect", { x: R.x + 12, y: R.y + 44, width: R.w - 24, height: R.h - 56, rx: 12, fill: cars ? "#E6E9ED" : "#FFFFFF" }, routerG);
  text(routerG, R.x + 22, R.y + 22, th.boxTitle, { "font-size": 16, "font-weight": 700, fill: "#FFFFFF" });
  text(routerG, R.x + 22, R.y + 37, th.boxSub, { "font-size": 12, fill: "#C3C9D1" });
  for (const h of Object.keys(HOSTS)) {
    const [x, y] = lanIn(h);
    el("rect", { x: x - 6, y: y - 5, width: 14, height: 10, rx: 2, fill: "#E8C547", stroke: "#8A7420" }, routerG);
  }
  el("rect", { x: WAN_OUT[0] - 8, y: WAN_OUT[1] - 5, width: 14, height: 10, rx: 2, fill: "#5AA6E8", stroke: "#2A5E8A" }, routerG);
  el("rect", { x: R.x + 12, y: R.laneY - 11, width: R.w - 24, height: 22, fill: cars ? "#BFC5CC" : "#F3EEE6" }, routerG);
  text(routerG, R.x + 20, R.laneY - 17, th.laneLeft, { "font-size": 11, fill: C.muted });
  text(routerG, R.x + R.w - 20, R.laneY - 17, th.laneRight, { "font-size": 11, fill: C.muted, "text-anchor": "end" });
  el("path", { d: `M${R.gateX} ${R.laneY + 15} V${G.y - 10}`, stroke: "#9AA3AF", "stroke-width": 1.5, "stroke-dasharray": "3 3" }, routerG);

  // The cells, plus rails for the tickets.
  const rowsN = N / G.cols;
  if (!cars) for (let r = 0; r < rowsN; r++) {
    const y = G.y + r * (G.ch + G.gy) - 3;
    el("rect", { x: G.x - 4, y: y - 2, width: G.cols * (G.cw + G.gx) - G.gx + 8, height: 4, rx: 2, fill: "#AEB5BE" }, routerG);
  }
  const cells = Array.from({ length: N }, (_, i) => {
    const x = G.x + (i % G.cols) * (G.cw + G.gx), y = G.y + Math.floor(i / G.cols) * (G.ch + G.gy);
    return cars ? spaceCell(routerG, x, y, th, i) : ticketCell(routerG, x, y, th);
  });

  const dropG = el("g", { opacity: 0 }, routerG);
  text(dropG, G.x, 538, "✗ turned away", { "font-size": 12, "font-weight": 700, fill: C.mallory });
  const dropText = text(dropG, G.x + 96, 538, "", { "font-size": 11.5, "font-family": MONO, fill: C.mallory });
  const counter = text(routerG, G.x + 546, 566, "", { "font-size": 13, "font-weight": 700, "text-anchor": "end" });
  text(routerG, G.x, 566, th.gaugeLabel, { "font-size": 13, "font-weight": 600 });
  el("rect", { x: G.x, y: 574, width: 546, height: 10, rx: 5, fill: "#D9DDE2" }, routerG);
  const gauge = el("rect", { x: G.x, y: 574, width: 0, height: 10, rx: 5, fill: "#46C27A" }, routerG);
  const limitText = text(routerG, G.x, 600, "", { "font-size": 11, fill: C.muted });

  // Intro: what stands for what.
  const introG = el("g", {}, svg);
  const iy = R.y + 40;
  el("rect", { x: R.x, y: iy, width: R.w, height: 300, rx: 20, fill: "#FFFFFF", stroke: "#E1E5EA" }, introG);
  text(introG, R.x + R.w / 2, iy + 44, "An analogy for the router's connection table", { "font-size": 20, "font-weight": 700, "text-anchor": "middle" });
  th.intro.forEach(([a, b], k) => {
    const y = iy + 96 + k * 42;
    text(introG, R.x + R.w / 2 - 22, y, a, { "font-size": 17, "font-weight": 600, "text-anchor": "end" });
    text(introG, R.x + R.w / 2, y, "=", { "font-size": 17, fill: C.muted, "text-anchor": "middle" });
    text(introG, R.x + R.w / 2 + 22, y, b, { "font-size": 17, fill: "#0F6FDE" });
  });

  // Status bubble.
  const statusG = el("g", { opacity: 0 }, svg);
  const statusBox = el("rect", { x: R.gateX - 200, y: 122, width: 400, height: 36, rx: 18 }, statusG);
  const statusText = text(statusG, R.gateX, 146, "", { "font-size": 15, "font-weight": 700, fill: "#FFFFFF", "text-anchor": "middle" });

  // Alice's card.
  const browserG = el("g", { transform: "translate(20 82)", opacity: 0 }, svg);
  el("rect", { width: 262, height: 74, rx: 10, fill: "#FFFFFF", stroke: "#D5DAE0" }, browserG);
  el("rect", { width: 262, height: 22, rx: 10, fill: "#EEF1F4" }, browserG);
  text(browserG, 12, 15, th.browser.title(cfg.site), { "font-size": 11, fill: C.muted, "font-weight": 600 });
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

  // Caption: the story, and what it means in the router.
  const capG = el("g", { opacity: 0 }, svg);
  el("rect", { x: 20, y: 636, width: 1245, height: 62, rx: 31, fill: "#FFFFFF", stroke: "#E1E5EA" }, capG);
  const capBadge = el("circle", { cx: 52, cy: 667, r: 18, fill: "#0F6FDE" }, capG);
  const capN = text(capG, 52, 673, "", { "font-size": 17, "font-weight": 700, fill: "#FFFFFF", "text-anchor": "middle" });
  const capText = text(capG, 82, 662, "", { "font-size": 17, "font-weight": 600 });
  const capRouter = text(capG, 82, 683, "", { "font-size": 13, fill: "#0F6FDE" });

  // Moving things above everything inside, the gate above them, crosses on top.
  const packetLayer = el("g", {}, svg);
  const gateG = el("g", {}, svg);
  const gate = el("rect", { x: R.gateX - 46, y: R.laneY - 15, width: 92, height: 30, rx: 8, fill: shell }, gateG);
  text(gateG, R.gateX, R.laneY + 4, th.gate, { "font-size": 12, "font-weight": 700, fill: "#FFFFFF", "text-anchor": "middle" });
  const markLayer = el("g", {}, svg);
  const pool = [], marks = [];
  const getPacket = (i) => pool[i] ?? (pool[i] = el("path", {}, packetLayer));
  const getMark = (i) => marks[i] ?? (marks[i] = el("path", { d: "M-7 -7 L7 7 M7 -7 L-7 7", "stroke-width": 3.5, "stroke-linecap": "round", fill: "none" }, markLayer));

  return function render(t) {
    const tl = scene.tl;
    const fade = 1 - prog(t, tl.holdEnd, tl.holdEnd + 0.8);
    svg.style.opacity = String(Math.min(prog(t, 0, 0.4), fade));
    titleEl.setAttribute("opacity", String(prog(t, 0.2, 0.8)));
    const c = scene.cases.find((k) => t >= k.start && t < k.end) ?? (t >= tl.holdEnd ? scene.cases[scene.cases.length - 1] : null);

    // Intro card, then the opened resource.
    set(introG, { opacity: prog(t, 0.3, 0.7) * (1 - prog(t, 2.6, 3.0)) });
    const open = prog(t, 2.7, 3.1);
    set(routerG, { opacity: open });
    set(gateG, { opacity: open });
    set(linkG, { opacity: open });

    // Cells.
    const filled = c ? c.entries.filter((e) => e.t <= t) : [];
    const n = filled.length, frac = n / N;
    cells.forEach((update, i) => {
      const e = filled[i];
      if (!e) return update(null);
      const st = e.st.filter((s) => s.t <= t).pop() ?? e.st[0];
      const left = e.refresh ? st.to : st.to - (t - st.t);
      update(e, st, left, 1 - prog(t, e.t, e.t + 0.35));
    });
    counter.textContent = `${n} / ${N} ${th.unit[1]}`;
    set(counter, { fill: frac >= 1 ? C.mallory : frac > 0.75 ? "#C27A00" : C.ink });
    set(gauge, { width: 546 * frac, fill: frac >= 1 ? C.mallory : frac > 0.75 ? "#F2A516" : "#46C27A" });
    if (c?.kind === "mitigation") {
      const m = filled.filter((e) => e.host === "mallory").length;
      limitText.textContent = `Limit: ${cfg.perHostLimit} per ${cars ? "household" : "table"} · Mallory ${m} / ${cfg.perHostLimit}`;
    } else limitText.textContent = "";

    const recent = (c?.drops ?? []).filter((d) => d.t <= t && t - d.t < (d.host === "alice" ? 1.8 : 0.7));
    const drop = recent.filter((d) => d.host === "alice").pop() ?? recent.pop();
    set(dropG, { opacity: drop ? 1 : 0 });
    if (drop) {
      dropText.textContent = drop.text;
      set(dropText, { "font-weight": drop.host === "alice" ? 700 : 400 });
    }
    const justDropped = recent.some((d) => t - d.t < 0.15);
    set(gate, { fill: frac >= 1 ? C.mallory : justDropped ? "#B4553A" : shell });

    // Status bubble.
    const st = c?.status.find((s) => t >= s.t0 && t < s.t1);
    if (st) {
      statusText.textContent = st.text;
      set(statusBox, { fill: st.tone === "bad" ? C.mallory : st.tone === "ok" ? C.ok : "#0F6FDE" });
    }
    set(statusG, { opacity: st ? Math.min(1, (t - st.t0) / 0.3, (st.t1 - t) / 0.3) : 0 });

    // The prankster glows while flooding; attackers outside show in their case.
    const floodingLan = c && (c.kind === "outbound" || c.kind === "mitigation") && t > c.start + 0.8 && t < c.start + 8;
    set(hostEls.mallory.halo, { opacity: floodingLan ? 0.12 + 0.1 * Math.sin(t * 8) : 0 });
    const floodingWan = c && c.kind === "inbound";
    set(botG, { opacity: floodingWan ? Math.min(1, (t - c.start) / 0.5, (c.end - t) / 0.4) : 0 });
    const saturated = floodingWan && t > c.start + 2;
    set(wanLink, { stroke: saturated ? C.botnet : cars ? "#7C8590" : C.link, "stroke-width": (cars ? 12 : 6) + (saturated ? 3 + 2 * Math.sin(t * 10) : 0) });
    set(outsideLink, { stroke: saturated ? C.botnet : cars ? "#7C8590" : C.link });
    lanLinks[2].setAttribute("stroke", floodingLan ? "#F3A3A5" : cars ? "#7C8590" : C.link);

    // Alice's card.
    const b = c?.browser.filter((s) => s.t <= t).pop();
    set(browserG, { opacity: b ? 1 : 0 });
    if (b) {
      set(spinner, { opacity: b.state === "loading" ? 1 : 0, transform: `translate(30 48) rotate(${(t * 360) % 360})` });
      set(okMark, { opacity: b.state === "ok" ? 1 : 0 });
      set(errMark, { opacity: b.state === "error" ? 1 : 0 });
      const [a1, a2] = th.browser[b.state](cfg.site);
      browserLine1.textContent = a1;
      browserLine2.textContent = a2;
      set(browserLine1, { fill: b.state === "error" ? C.mallory : C.ink });
    }

    // Side effects.
    const fx = c ? c.effects.filter((e) => e.t <= t + 0.0001) : [];
    set(fxG, { opacity: fx.length ? Math.min(1, (c.end - t) / 0.3) : 0 });
    fxTitle.textContent = c?.kind === "normal" ? "Good to know" : c?.kind === "mitigation" ? "Effect of the rule" : "Side effects";
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
      capRouter.textContent = cp.router;
      set(capBadge, { fill: c.kind === "mitigation" ? C.ok : c.kind === "normal" ? "#0F6FDE" : C.mallory });
    }

    // Moving things.
    let np = 0, nm = 0;
    for (const p of c?.packets ?? []) {
      if (t < p.t0) continue;
      const k = (t - p.t0) / p.dur;
      if (k <= 1) {
        const [x, y] = along(p.path, k);
        const sh = SHAPES[p.shape];
        let rot = 0;
        if (sh.rotate) {
          const [x2, y2] = along(p.path, Math.min(1, k + 0.01));
          const [x0, y0] = along(p.path, Math.max(0, k - 0.01));
          rot = (Math.atan2(y2 - y0, x2 - x0) * 180) / Math.PI;
        }
        set(getPacket(np++), { d: sh.d, transform: `translate(${x} ${y}) rotate(${rot})`, fill: sh.fill ?? p.color, stroke: sh.fill ? p.color : "#1B1F27", "stroke-width": sh.strokeW, opacity: 1 });
      } else if (p.drop && t < p.t0 + p.dur + 0.5) {
        const [x, y] = p.path[p.path.length - 1];
        set(getMark(nm++), { transform: `translate(${x} ${y})`, stroke: p.color, opacity: 1 - (t - p.t0 - p.dur) / 0.5 });
      }
    }
    for (let i = np; i < pool.length; i++) pool[i].setAttribute("opacity", "0");
    for (let i = nm; i < marks.length; i++) marks[i].setAttribute("opacity", "0");
  };
}
