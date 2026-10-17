// Downloads the product photos used by the router demo into benchmark/media/.
// The photos belong to Swisscom (Centro Business guide) and TCL/KOMSA, so they are
// not committed to this public repo; run `node media/fetch.mjs` once after cloning.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILES = {
  // Centro Business 3.0, back panel ("liegend"), from https://cb-guide.swisscom.ch/en/router/router_installation
  "cb3-back.png":
    "https://cb-guide.swisscom.ch/en/assets/images/CB3_liegend-208f6c6bf6223955e7861e59178eb1bc.png",
  // TCL LinkKey IK41, side view, from the KOMSA product page
  "tcl-ik41-side.jpeg":
    "https://www.komsa.pl/Images/Product/Alternative/xlarge/TCL%20LINKKEY%20IK41VE1-2ALCPL2%20Modem%204G%20LTE%20150%20Mbs%20(2).jpeg",
};

for (const [name, url] of Object.entries(FILES)) {
  const out = path.join(DIR, name);
  if (fs.existsSync(out)) {
    console.log(`${name}: already there`);
    continue;
  }
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`${name}: ${fs.statSync(out).size} bytes`);
}
