// Draws a router-scene frame on a 2D canvas (used by Revideo, which has no CSS 3D).
// Faces are projected with the same camera as the CSS version and painted back to
// front. Photo faces are split into a grid of triangles, each drawn with its own
// affine transform, which follows the perspective mapping closely at this distance.
import { MEDIA, WIDTH, HEIGHT, faceFrame, poseApply, toView, viewToScreen, project, cableSegments } from "./router-scene.js";

const FACES = ["front", "back", "right", "left", "top", "bottom"];

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const rot = (pose, v) => poseApply({ ...pose, x: 0, y: 0, z: 0 }, v);

// images: { [src]: HTMLImageElement } (already loaded). The context's current
// transform maps the 1280x720 frame to the canvas.
export function drawFrame(ctx, st, images) {
  const base = ctx.getTransform();
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = st.opacity;
  if (st.opacity > 0) {
    drawBoxes(ctx, base, st.cam, st.router, images, st.opacity);
    drawPanel(ctx, base, st.cam, st.panel, st.opacity);
    drawCables(ctx, st.cam, st.cables, st.opacity);
    drawBoxes(ctx, base, st.cam, st.objects, images, st.opacity);
  }
  ctx.setTransform(base);
  drawTitle(ctx, st.title);
  for (const c of st.captions) drawCaption(ctx, c);
  ctx.restore();
}

function drawBoxes(ctx, base, cam, boxes, images, alpha) {
  const faces = [];
  for (const b of boxes) {
    const [w, h, d] = b.size;
    for (const name of FACES) {
      const face = b.faces[name];
      if (!face) continue;
      const [fw, fh, tl, u, v] = faceFrame(name, w, h, d);
      const o = poseApply(b.pose, add(b.c, tl));
      const U = rot(b.pose, u), V = rot(b.pose, v);
      const corner = (s, t) => add(add(o, mul(U, s)), mul(V, t));
      const vs = [corner(0, 0), corner(fw, 0), corner(fw, fh), corner(0, fh)].map((p) => toView(cam, p));
      const ss = vs.map(viewToScreen);
      if (ss.some((s) => s[2] <= 0)) continue;
      const cross = (ss[1][0] - ss[0][0]) * (ss[3][1] - ss[0][1]) - (ss[1][1] - ss[0][1]) * (ss[3][0] - ss[0][0]);
      if (cross <= 0) continue; // back face
      const depth = (vs[0][2] + vs[1][2] + vs[2][2] + vs[3][2]) / 4;
      faces.push({ face, fw, fh, corner, ss, depth, opacity: b.opacity, shadow: !!face.shadow });
    }
  }
  faces.sort((a, b) => (a.shadow !== b.shadow ? (a.shadow ? -1 : 1) : a.depth - b.depth));
  for (const f of faces) {
    ctx.globalAlpha = alpha * f.opacity;
    if (!f.face.img && !f.face.dots && !f.shadow) {
      ctx.beginPath();
      f.ss.forEach((s, i) => (i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1])));
      ctx.closePath();
      ctx.fillStyle = f.face.fill;
      ctx.fill();
      if (f.face.stroke) {
        ctx.strokeStyle = f.face.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      continue;
    }
    const nu = f.face.cells ?? Math.min(12, Math.ceil(f.fw / 140));
    const nv = f.face.cells ?? Math.min(6, Math.ceil(f.fh / 140));
    const grid = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const u = (f.fw * i) / nu, v = (f.fh * j) / nv;
        const p = project(cam, f.corner(u, v));
        grid.push({ u, v, x: p[0], y: p[1] });
      }
    }
    const at = (i, j) => grid[j * (nu + 1) + i];
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        // Two triangles per cell, each mapped exactly through its three corners, so
        // neighbouring pieces meet without gaps.
        drawTriangle(ctx, base, f.face, f.fw, f.fh, images, at(i, j), at(i + 1, j), at(i, j + 1));
        drawTriangle(ctx, base, f.face, f.fw, f.fh, images, at(i + 1, j + 1), at(i, j + 1), at(i + 1, j));
      }
    }
  }
  ctx.globalAlpha = alpha;
}

// Clips to the screen triangle (grown by ~1 px to hide anti-aliasing seams) and
// draws the face content through the affine map that takes a, b, c to the screen.
function drawTriangle(ctx, base, face, fw, fh, images, a, b, c) {
  const du1 = b.u - a.u, dv1 = b.v - a.v, du2 = c.u - a.u, dv2 = c.v - a.v;
  const det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-9) return;
  const dx1 = b.x - a.x, dy1 = b.y - a.y, dx2 = c.x - a.x, dy2 = c.y - a.y;
  // Screen = M * (u, v) + t, solved from the two triangle edges.
  const m11 = (dx1 * dv2 - dx2 * dv1) / det, m12 = (dx2 * du1 - dx1 * du2) / det;
  const m21 = (dy1 * dv2 - dy2 * dv1) / det, m22 = (dy2 * du1 - dy1 * du2) / det;
  const tx = a.x - m11 * a.u - m12 * a.v, ty = a.y - m21 * a.u - m22 * a.v;
  const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
  const grow = (p) => {
    const dx = p.x - cx, dy = p.y - cy, len = Math.hypot(dx, dy) || 1;
    return [p.x + (dx / len) * 1.1, p.y + (dy / len) * 1.1];
  };
  ctx.save();
  ctx.setTransform(base);
  ctx.beginPath();
  for (const [k, p] of [a, b, c].entries()) {
    const [x, y] = grow(p);
    if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(base.multiply(new DOMMatrix([m11, m21, m12, m22, tx, ty])));
  drawFaceContent(ctx, face, fw, fh, images);
  ctx.restore();
}

function drawFaceContent(ctx, face, fw, fh, images) {
  ctx.beginPath();
  const r = face.radius ?? 0;
  ctx.roundRect(0, 0, fw, fh, Array.isArray(r) ? r : [r]);
  ctx.clip();
  if (face.shadow) {
    // Same as CSS radial-gradient(closest-side, ...): a unit circle scaled to the face.
    ctx.save();
    ctx.translate(fw / 2, fh / 2);
    ctx.scale(fw / 2, fh / 2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, "rgba(0,0,0,0.28)");
    g.addColorStop(0.6, "rgba(0,0,0,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    return;
  }
  ctx.fillStyle = face.fill;
  ctx.fillRect(0, 0, fw, fh);
  if (face.img) {
    const { media, sx, sy, sw, sh, rot: deg } = face.img;
    const img = images[MEDIA[media].src];
    if (img) {
      const k = deg % 180 ? fw / sh : fw / sw;
      ctx.save();
      ctx.translate(fw / 2, fh / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(img, sx, sy, sw, sh, (-sw * k) / 2, (-sh * k) / 2, sw * k, sh * k);
      ctx.restore();
    }
  }
  for (const d of face.dots ?? []) {
    ctx.save();
    if (d.glow) {
      ctx.shadowColor = d.glow;
      ctx.shadowBlur = d.glowSize ?? 10;
    }
    ctx.fillStyle = d.fill;
    if (d.stripes) {
      for (let x = d.x; x < d.x + d.w; x += 4) ctx.fillRect(x, d.y, 2, d.h);
    } else {
      ctx.beginPath();
      ctx.roundRect(d.x, d.y, d.w, d.h, Math.min(d.w, d.h) / 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// Items on the panel surface (z = 1), each drawn with the affine map at its centre.
function drawPanel(ctx, base, cam, items, alpha) {
  for (const it of items) {
    const cx = it.type === "ring" ? it.x : it.x + it.w / 2;
    const cy = it.type === "ring" ? it.y : it.y + it.h / 2;
    const s0 = project(cam, [cx, cy, 1]);
    const sx = project(cam, [cx + 10, cy, 1]);
    const sy = project(cam, [cx, cy + 10, 1]);
    const a = [(sx[0] - s0[0]) / 10, (sx[1] - s0[1]) / 10];
    const b = [(sy[0] - s0[0]) / 10, (sy[1] - s0[1]) / 10];
    ctx.save();
    ctx.setTransform(base.multiply(new DOMMatrix([a[0], a[1], b[0], b[1], s0[0] - a[0] * cx - b[0] * cy, s0[1] - a[1] * cx - b[1] * cy])));
    ctx.globalAlpha = alpha * (it.opacity ?? 1);
    ctx.beginPath();
    if (it.type === "ring") ctx.arc(it.x, it.y, it.r - it.strokeW / 2, 0, Math.PI * 2);
    else ctx.roundRect(it.x, it.y, it.w, it.h, it.radius);
    if (it.glow) {
      ctx.shadowColor = it.glow;
      ctx.shadowBlur = it.fill ? 14 : 18;
    }
    if (it.fill) {
      ctx.fillStyle = it.fill;
      ctx.fill();
    }
    if (it.stroke) {
      ctx.strokeStyle = it.stroke;
      ctx.lineWidth = it.strokeW;
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCables(ctx, cam, cables, alpha) {
  ctx.lineCap = "round";
  for (const cable of cables) {
    const segs = cableSegments(cam, cable);
    ctx.globalAlpha = alpha * cable.opacity;
    const passes = [
      ["rgba(0,0,0,0.25)", (w) => w + 3, () => 0],
      [cable.color, (w) => w, () => 0],
      ["rgba(255,255,255,0.55)", (w) => Math.max(1, w * 0.17), (w) => -w * 0.23],
    ];
    for (const [stroke, width, dy] of passes) {
      ctx.strokeStyle = stroke;
      for (const [x0, y0, x1, y1, w] of segs) {
        ctx.lineWidth = width(w);
        ctx.beginPath();
        ctx.moveTo(x0, y0 + dy(w));
        ctx.lineTo(x1, y1 + dy(w));
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = alpha;
}

function drawTitle(ctx, title) {
  if (title.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = title.opacity;
  ctx.font = "700 40px sans-serif";
  const w = ctx.measureText(title.text).width;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.roundRect(46, 52, w + 36, 60, 12);
  ctx.fill();
  ctx.fillStyle = "#1B1D22";
  ctx.textBaseline = "middle";
  ctx.fillText(title.text, 64, 82);
  ctx.restore();
}

function drawCaption(ctx, c) {
  ctx.save();
  ctx.globalAlpha = c.opacity;
  ctx.translate(0, (1 - c.opacity) * 16);
  ctx.font = "600 30px sans-serif";
  const tw = Math.min(ctx.measureText(c.text).width, 1150 - 110);
  const x = 64, y = 584, h = 80, w = 16 + 48 + 18 + tw + 28;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 40);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.arc(x + 16 + 24, y + h / 2, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 26px sans-serif";
  ctx.fillText(c.n, x + 40, y + h / 2 + 1);
  ctx.textAlign = "left";
  ctx.fillStyle = "#1B1D22";
  ctx.font = "600 30px sans-serif";
  ctx.fillText(c.text, x + 82, y + h / 2 + 1, tw);
  ctx.restore();
}
