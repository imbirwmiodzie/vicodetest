// Generates clean vector redraws of the Centro Business 3.0 panels:
//   cb3-back.svg  - back panel, same 1360x260 grid as media/cb3-back.png
//   cb3-front.svg - front panel of the lying router, 1256x222 (the router's front face)
// Positions were measured on the guide's photos; nothing is traced from their pixels.
// Usage: node vector/build-panels.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FONT = `font-family="'Frutiger', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"`;
const LABEL = "#D6DAE0";

const text = (x, y, s, size = 15.5, extra = "") =>
  `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" fill="${LABEL}" ${FONT} ${extra}>${s}</text>`;

// ---- shared parts ------------------------------------------------------------------

// Lit LED colours: [core, middle, edge]; the glow uses the middle colour.
const LIT = {
  green: ["#F2FFF6", "#5BFF9C", "#1FC765"],
  white: ["#FFFFFF", "#F1F5FA", "#B9C3CE"],
  blue: ["#EAF3FF", "#5FA2FF", "#2369E0"],
};

// Back-panel link LED: a flat mint light pipe flush with the yellow frame, lighter at
// the top, with a soft shadow on the frame; when lit a saturated core and a glow.
function ledLens(x, y, w, h, lit) {
  const shadow = `<rect x="${x + 0.8}" y="${y + 1}" width="${w}" height="${h}" rx="1.6" fill="#8A7E00" opacity="0.35" filter="url(#soft)"/>`;
  if (!lit) {
    return `${shadow}
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="url(#lens-off)"/>
    <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="1.2" fill="none" stroke="#5FC6A6" stroke-width="0.7" opacity="0.8"/>
    <path d="M${x + 1.6} ${y + 1.4} H${x + w - 1.6}" stroke="#F2FFFA" stroke-width="1" stroke-linecap="round" opacity="0.7"/>`;
  }
  const [core, mid] = LIT[lit];
  return `<rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" rx="5" fill="${mid}" opacity="0.7" filter="url(#glow)"/>
    <rect x="${x - 9}" y="${y - 9}" width="${w + 18}" height="${h + 18}" rx="10" fill="${mid}" opacity="0.25" filter="url(#glow-wide)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.6" fill="url(#lens-${lit})"/>
    <rect x="${x + 2}" y="${y + 1.8}" width="${w - 4}" height="${h - 3.6}" rx="1.4" fill="${core}" opacity="0.55" filter="url(#soft)"/>`;
}

// Front light guide: a curved, matte grey pipe in a shallow groove (as in the photo);
// when lit, a coloured core with glow spilling onto the panel.
function lightGuide(x1, y1, x2, y2, lit) {
  // Bows out to the upper left like the real guides.
  const d = `M${x1} ${y1} Q${x2 + 2} ${y1 + 4} ${x2} ${y2}`;
  const seg = (color, width, extra = "") => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
  const groove = seg("#16181B", 6.6, 'opacity="0.7"');
  if (!lit) return `${groove}${seg("#767C84", 4.6)}${seg("#959BA3", 2.4, 'filter="url(#soft)"')}`;
  const [core, mid, edge] = LIT[lit];
  return `${seg(mid, 16, 'opacity="0.3" filter="url(#glow-wide)"')}${seg(mid, 8, 'opacity="0.75" filter="url(#glow)"')}
    ${groove}${seg(edge, 4.6)}${seg(mid, 3.4)}${seg(core, 1.8, 'opacity="0.9" filter="url(#soft)"')}`;
}

const defs = `
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3D404A"/><stop offset="0.08" stop-color="#363943"/>
      <stop offset="0.9" stop-color="#32353E"/><stop offset="1" stop-color="#2B2E35"/>
    </linearGradient>
    <linearGradient id="front" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#363A3F"/><stop offset="0.1" stop-color="#2E3236"/>
      <stop offset="0.92" stop-color="#2A2D31"/><stop offset="1" stop-color="#24272B"/>
    </linearGradient>
    <linearGradient id="socket" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2A2920"/><stop offset="1" stop-color="#47442F"/>
    </linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#9AA1AA"/><stop offset="0.35" stop-color="#EEF1F4"/>
      <stop offset="0.7" stop-color="#C3C8CF"/><stop offset="1" stop-color="#8E959E"/>
    </linearGradient>
    <radialGradient id="button" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#4A4D55"/><stop offset="0.7" stop-color="#2C2E33"/><stop offset="1" stop-color="#1C1D21"/>
    </radialGradient>
    <!-- LEDs: unlit and lit lenses, blur filters for soft edges and glow -->
    <linearGradient id="lens-off" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#B9F8E6"/><stop offset="0.5" stop-color="#8CEFD3"/><stop offset="1" stop-color="#72DDBF"/>
    </linearGradient>
    ${Object.entries(LIT).map(([name, [core, mid, edge]]) => `
    <radialGradient id="lens-${name}" cx="0.5" cy="0.45" r="0.65">
      <stop offset="0" stop-color="${core}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${edge}"/>
    </radialGradient>`).join("")}
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.6"/></filter>
    <filter id="glow" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="glow-wide" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>`;

// RJ45 socket opening, 63 x 50, top-left at (x, y): latch notch, upper step, main
// opening, eight gold contacts.
function rj45(x, y) {
  const d = `M${x + 24} ${y} h15 v4 h11 v10 h11 a2 2 0 0 1 2 2 v32 a2 2 0 0 1 -2 2 h-59 a2 2 0 0 1 -2 -2 v-32 a2 2 0 0 1 2 -2 h11 v-10 h11 z`;
  const pins = Array.from({ length: 8 }, (_, i) => `<rect x="${x + 12.5 + i * 5.2}" y="${y + 33}" width="2.4" height="14" fill="#C9B458"/>`).join("");
  return `<path d="${d}" fill="url(#socket)" stroke="#1E1D16" stroke-width="1"/>
    <rect x="${x + 9}" y="${y + 30}" width="45" height="18" rx="1.5" fill="#2E2D22"/>${pins}`;
}

// RJ11 (phone) socket, 48 x 46.
function rj11(x, y) {
  const d = `M${x + 18} ${y} h12 v4 h8 v8 h8 a2 2 0 0 1 2 2 v30 a2 2 0 0 1 -2 2 h-44 a2 2 0 0 1 -2 -2 v-30 a2 2 0 0 1 2 -2 h8 v-8 h8 z`;
  const pins = Array.from({ length: 6 }, (_, i) => `<rect x="${x + 11 + i * 5}" y="${y + 30}" width="2.2" height="13" fill="#C9B458"/>`).join("");
  return `<path d="${d}" fill="#2B2C2F" stroke="#16171A" stroke-width="1"/>
    <rect x="${x + 7}" y="${y + 27}" width="34" height="17" rx="1.5" fill="#202124"/>${pins}`;
}

// ---- back panel --------------------------------------------------------------------

function back(lit = {}) {
  const ports = [345.5, 422, 498.5, 574.5];
  const leds = [[366, 98, 14, 9], [443, 98, 13, 9], [519, 98, 14, 9], [596, 98, 13, 9], [690, 97, 11, 9]];
  const sfpRibs = Array.from({ length: 5 }, (_, i) => `<rect x="${880 + i * 13}" y="117" width="8" height="38" rx="1.5" fill="#B9BFC7" stroke="#8E959E" stroke-width="0.8"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1360 260" width="1360" height="260">${defs}
  <!-- feet -->
  <rect x="125" y="226" width="140" height="24" rx="5" fill="#25272D"/>
  <rect x="1098" y="226" width="152" height="24" rx="5" fill="#25272D"/>
  <!-- body -->
  <rect x="49" y="10" width="1256" height="222" rx="16" fill="url(#body)"/>
  <rect x="49" y="10" width="1256" height="222" rx="16" fill="none" stroke="#4A4E59" stroke-width="2"/>
  <!-- top lip and bottom rim of the case, as seen in the photo -->
  <path d="M49 50 V26 a16 16 0 0 1 16 -16 H1289 a16 16 0 0 1 16 16 V50 Z" fill="#3B3E49"/>
  <path d="M52 50 H1302" stroke="#2B2E35" stroke-width="2"/>
  <path d="M65 12 H1289" stroke="#555A66" stroke-width="2"/>
  <path d="M51 204 H1303 V216 a16 16 0 0 1 -16 16 H67 a16 16 0 0 1 -16 -16 Z" fill="#3A3D47"/>
  <path d="M52 204 H1302" stroke="#2C2F36" stroke-width="1.5"/>

  <!-- labels -->
  ${text(213, 82, "Phone")}
  ${text(460, 82, "Ethernet 1.0 Gbit/s")}
  ${text(668, 82, "10 Gbit/s")}
  ${text(911, 82, "Internet")}
  ${text(1028, 82, "USB 2.0")}
  ${text(1093, 82, "Power")}
  ${text(1153, 82, "On /Off")}

  <!-- phone sockets -->
  <rect x="137" y="93" width="152" height="63" rx="3" fill="#E7E9EE" stroke="#C9CDD4" stroke-width="1"/>
  <path d="M213 96 V153" stroke="#C9CDD4" stroke-width="1.5" stroke-dasharray="3 3"/>
  ${rj11(151, 101)}${rj11(227, 101)}
  ${text(175, 182, "1", 16)}${text(251, 182, "2", 16)}

  <!-- Ethernet 1-4 and 5 (10G) -->
  <rect x="307" y="93" width="307" height="63" rx="2" fill="#F2E33A" stroke="#CDBE22" stroke-width="1"/>
  <rect x="630" y="93" width="76" height="63" rx="2" fill="#F2E33A" stroke="#CDBE22" stroke-width="1"/>
  ${ports.map((x) => rj45(x - 31.5, 96)).join("")}
  ${rj45(668 - 31.5, 96)}
  ${leds.map(([x, y, w, h], i) => ledLens(x, y, w, h, lit[i + 1])).join("")}
  ${ports.map((x, i) => text(x, 182, String(i + 1), 16)).join("")}
  ${text(574.5, 198, "WAN", 16)}
  ${text(668, 182, "5", 16)}${text(668, 198, "SG", 16)}

  <!-- Internet: SFP slot with module -->
  <rect x="866" y="100" width="90" height="66" rx="3" fill="#1D1F24" stroke="#4A4E59" stroke-width="1"/>
  <rect x="874" y="109" width="74" height="51" rx="2" fill="url(#metal)" stroke="#7C838C" stroke-width="1"/>
  ${sfpRibs}
  <rect x="874" y="103" width="70" height="9" rx="2.5" fill="#2E7BD6"/>

  <!-- USB 2.0 -->
  <rect x="1014" y="88" width="28" height="66" rx="3" fill="url(#metal)" stroke="#7C838C" stroke-width="1"/>
  <rect x="1018" y="92" width="20" height="58" rx="1.5" fill="#15161A"/>
  <rect x="1027" y="97" width="8" height="48" rx="1" fill="#EDEFF2"/>

  <!-- Power socket -->
  <rect x="1071" y="101" width="45" height="57" rx="2" fill="#1C1D21" stroke="#5A5F6A" stroke-width="1.2"/>
  <circle cx="1093.5" cy="129.5" r="14" fill="#0D0E10" stroke="#2C2E33" stroke-width="2"/>
  <circle cx="1093.5" cy="129.5" r="3" fill="#E8EAED"/>

  <!-- On/Off button -->
  <circle cx="1152" cy="128.5" r="22" fill="url(#button)" stroke="#16171A" stroke-width="1.5"/>
  <path d="M1144.5 121.5 a10.5 10.5 0 1 0 15 0" fill="none" stroke="#5E626B" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M1152 116 V129" stroke="#5E626B" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M1129 178 H1176 M1131 178 V169 H1146 V178 M1149 178 V161 H1170 V178" fill="none" stroke="${LABEL}" stroke-width="1.6"/>

  <!-- Reset -->
  <circle cx="1213" cy="137" r="5" fill="#0D0E10" stroke="#2C2E33" stroke-width="1"/>
  ${text(1213, 182, "Reset")}
</svg>
`;
}

// ---- front panel (lying router, seen from the front) --------------------------------

// The lying router's front: left end = the power side. Text and icons are turned 90
// degrees, as on the real device when it lies on its side.
function front(lit = {}) {
  const W = 1256, H = 222;
  const rot = (u, v, inner) => `<g transform="translate(${u} ${v}) rotate(90)">${inner}</g>`;
  const stroke = `fill="none" stroke="${LABEL}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
  // 28 x 28 line icons around (0, 0), in the standing orientation.
  const icons = {
    power: `<path d="M-6 -7 a9.5 9.5 0 1 0 12 0" ${stroke}/><path d="M0 -11 V-1" ${stroke}/>`,
    internet: `<circle r="10" ${stroke}/><ellipse rx="4.5" ry="10" ${stroke}/><path d="M-10 0 H10 M-8.5 -5 H8.5 M-8.5 5 H8.5" ${stroke}/>`,
    mobile: `<circle cx="-2" r="9" ${stroke}/><ellipse cx="-2" rx="4" ry="9" ${stroke}/><path d="M-11 0 H7" ${stroke}/><path d="M9 -6 a8 8 0 0 1 0 12 M12.5 -9 a12.5 12.5 0 0 1 0 18" ${stroke}/>`,
    backup: `<path d="M-7 4 C-12 -6 -2 -12 4 -8 C10 -4 8 6 2 8 L-4 8" ${stroke}/><path d="M-3 4 L1 8 L-3 12" ${stroke}/>`,
    phone: `<path d="M-9 -9 C-11 -3 -6 6 3 10 C6 11 9 9 9 6 L5 3 L2 5 C-1 4 -4 1 -5 -2 L-3 -5 L-6 -9 Z" ${stroke}/>`,
    service: `<path d="M-11 -9 H11 V7 H1 L-5 12 V7 H-11 Z" ${stroke}/><path d="M0 -4 V-3 M0 0 V4" ${stroke}/>`,
    wlan: `<path d="M-11 -3 a15.5 15.5 0 0 1 22 0 M-7 1 a10 10 0 0 1 14 0 M-3 5 a4.5 4.5 0 0 1 6 0" ${stroke}/><circle cy="9" r="1.4" fill="${LABEL}"/>`,
  };
  // Icon centres along the panel (measured: standing photo y -> u).
  const row = [["power", 523], ["internet", 596], ["mobile", 670], ["backup", 744], ["phone", 819], ["service", 893], ["wlan", 967]];
  const slits = row.map(([name, u]) => lightGuide(u + 27, 9, u + 13, 48, lit[name])).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs}
  <rect width="${W}" height="${H}" rx="12" fill="url(#front)"/>
  <rect width="${W}" height="${H}" rx="12" fill="none" stroke="#454A51" stroke-width="2"/>
  <path d="M14 3 H${W - 14}" stroke="#4E535B" stroke-width="2"/>

  <!-- "3.0" -->
  ${rot(52, 104, `<text x="0" y="14" font-size="40" text-anchor="middle" fill="${LABEL}" ${FONT}>3.0</text>`)}

  <!-- USB 3.0 -->
  <rect x="133" y="63" width="33" height="79" rx="3" fill="url(#metal)" stroke="#7C838C" stroke-width="1"/>
  <rect x="138" y="68" width="23" height="69" rx="1.5" fill="#121317"/>
  <rect x="149" y="74" width="8" height="57" rx="1" fill="#2F6FD8"/>
  ${rot(184, 102, `<text x="0" y="5" font-size="13" text-anchor="middle" fill="${LABEL}" ${FONT}>USB 3.0</text>`)}

  <!-- WLAN (WPS) button -->
  <rect x="296" y="63" width="30" height="77" rx="4" fill="#1D2024" stroke="#121417" stroke-width="1.2"/>
  <path d="M300 68 V135" stroke="#3A3E44" stroke-width="1.5"/>
  ${rot(342, 102, `<text x="0" y="5" font-size="13" text-anchor="middle" fill="${LABEL}" ${FONT}>WLAN</text>`)}

  <!-- LED light guides and icons: Power, Internet, Mobile Internet, Internet Backup,
       Telephony, Service, WLAN -->
  ${slits}
  ${row.map(([name, u]) => rot(u, 108, `<g transform="scale(1.35)">${icons[name]}</g>`)).join("")}

  <!-- logo area: the operator's logo is not redrawn; drop the official SVG in here -->
  <circle cx="1165" cy="105" r="26" fill="none" stroke="#4A4F57" stroke-width="2" stroke-dasharray="4 4"/>
</svg>
`;
}

fs.writeFileSync(path.join(DIR, "cb3-back.svg"), back());
fs.writeFileSync(path.join(DIR, "cb3-front.svg"), front());
// Lit examples: link on ports 1 and 4; power, internet, mobile internet and WLAN on.
fs.writeFileSync(path.join(DIR, "cb3-back-lit.svg"), back({ 1: "green", 4: "green" }));
fs.writeFileSync(path.join(DIR, "cb3-front-lit.svg"), front({ power: "white", internet: "white", mobile: "green", wlan: "blue" }));

// Lit-LED sprites for the animation, laid over the unlit LEDs of the panels above.
// Each one is the lit LED plus a transparent margin for its glow.
const sprite = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs}${body}</svg>\n`;
export const SPRITES = { ledMargin: 12, ledW: 14, ledH: 9, guideMargin: 16, guideW: 14, guideH: 39 };
const { ledMargin: lm, ledW, ledH, guideMargin: gm, guideW, guideH } = SPRITES;
fs.writeFileSync(path.join(DIR, "led-green.svg"), sprite(ledW + 2 * lm, ledH + 2 * lm, ledLens(lm, lm, ledW, ledH, "green")));
for (const color of ["white", "green", "blue"]) {
  fs.writeFileSync(path.join(DIR, `guide-${color}.svg`), sprite(guideW + 2 * gm, guideH + 2 * gm, lightGuide(gm + guideW, gm, gm, gm + guideH, color)));
}

// ---- TCL LinkKey IK41 (USB stick) ----------------------------------------------------
// Faces of the stick body as the animation maps them: the wide face (378 x 114, plug end
// on the right) with logo and LED slit, and the narrow edge (378 x 23) with the two
// antenna-socket caps. Positions measured on the KOMSA photos.
const stickFront = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 378 114" width="378" height="114">
  <defs>
    <linearGradient id="ik" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3A3D43"/><stop offset="0.5" stop-color="#2D2F34"/><stop offset="1" stop-color="#26282C"/>
    </linearGradient>
    <linearGradient id="ik-sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0.07"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="378" height="114" fill="url(#ik)"/>
  <rect width="378" height="114" fill="url(#ik-sheen)"/>
  <!-- cap seam near the plug end -->
  <path d="M352 0 V114" stroke="#1E2023" stroke-width="1.5"/>
  <text x="257" y="57" font-size="34" font-weight="800" letter-spacing="2" text-anchor="middle" dominant-baseline="central"
    fill="#8E9299" ${FONT}>TCL</text>
  <!-- LED slit -->
  <rect x="85" y="51" width="5" height="12" rx="2.5" fill="#15161A"/>
</svg>
`;
const stickEdge = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 378 23" width="378" height="23">
  <defs>
    <linearGradient id="ike" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2A2C31"/><stop offset="0.5" stop-color="#34373D"/><stop offset="1" stop-color="#2A2C31"/>
    </linearGradient>
  </defs>
  <rect width="378" height="23" fill="url(#ike)"/>
  <path d="M352 0 V23" stroke="#1E2023" stroke-width="1.5"/>
  ${[[90, "LTE1"], [251, "LTE2"]].map(([u, label]) => `
  <rect x="${u - 14}" y="3" width="28" height="17" rx="3" fill="#24262A" stroke="#4A4D54" stroke-width="1"/>
  <text x="${u}" y="11.5" font-size="7" text-anchor="middle" dominant-baseline="central" fill="#7D828A" ${FONT}>${label}</text>`).join("")}
</svg>
`;
fs.writeFileSync(path.join(DIR, "ik41-front.svg"), stickFront());
fs.writeFileSync(path.join(DIR, "ik41-edge.svg"), stickEdge());

// ---- 5G Receiver (outdoor unit), its bracket and the PoE adapter ----------------------
// Redrawn after the Centro Business guide's "5G Receiver" installation pictures: a white
// rounded unit with raised vertical ribs and a status LED, and a white PoE adapter with
// a LAN and a blue POE/WAN socket.
const receiverFront = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 340" width="240" height="340">
  <defs>
    <linearGradient id="rx" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FBFCFD"/><stop offset="1" stop-color="#E2E6EB"/>
    </linearGradient>
    <linearGradient id="rib" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#E9ECF0"/><stop offset="0.5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D9DDE3"/>
    </linearGradient>
  </defs>
  <rect width="240" height="340" rx="30" fill="url(#rx)"/>
  <rect x="1" y="1" width="238" height="338" rx="29" fill="none" stroke="#C9CED6" stroke-width="2"/>
  ${[0, 1, 2, 3].map((i) => `<rect x="${44 + i * 40}" y="64" width="32" height="236" rx="16" fill="url(#rib)" stroke="#CDD2D9" stroke-width="1.2"/>`).join("")}
  <!-- status LED (unlit) -->
  <circle cx="200" cy="30" r="4.5" fill="#B9C0C8" stroke="#9AA2AC" stroke-width="1"/>
</svg>
`;
const poeFront = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 70" width="120" height="70">
  <defs>
    <linearGradient id="poe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E4E8EC"/>
    </linearGradient>
  </defs>
  <rect width="120" height="70" rx="6" fill="url(#poe)"/>
  <rect x="0.5" y="0.5" width="119" height="69" rx="5.5" fill="none" stroke="#C9CED6" stroke-width="1"/>
  <text x="34" y="16" font-size="8" text-anchor="middle" fill="#59606A" ${FONT}>LAN</text>
  <text x="86" y="16" font-size="8" text-anchor="middle" fill="#59606A" ${FONT}>POE/WAN</text>
  <!-- LAN socket (silver) and POE/WAN socket (blue) -->
  <rect x="17" y="22" width="34" height="30" rx="2" fill="#C5CAD1" stroke="#8E959E" stroke-width="1"/>
  <path d="M27 26 h14 v3 h4 v19 h-22 v-19 h4 z" fill="#2A2C30"/>
  <rect x="69" y="22" width="34" height="30" rx="2" fill="#2F6FD8" stroke="#1F4FA0" stroke-width="1"/>
  <path d="M79 26 h14 v3 h4 v19 h-22 v-19 h4 z" fill="#14233E"/>
</svg>
`;
fs.writeFileSync(path.join(DIR, "receiver-front.svg"), receiverFront());
fs.writeFileSync(path.join(DIR, "poe-front.svg"), poeFront());

console.log("wrote the CB3 panels, lit-LED sprites, IK41, 5G Receiver and PoE adapter drawings");
