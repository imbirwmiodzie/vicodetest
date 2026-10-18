// Draws a router-scene frame on a 2D canvas (used by Revideo, which has no CSS 3D).
// Quads are projected with the same camera as the CSS version and painted back to
// front. Photo, gradient and large faces are split into a grid of triangles, each
// drawn with the affine map through its three projected corners, which follows the
// perspective mapping closely and leaves no gaps between pieces.
import { BODY, HAND, MEDIA, WIDTH, HEIGHT, eye, toView, viewToScreen, project } from "./router-scene.js";

const at = (q, s, t) => [q.o[0] + q.u[0] * s + q.v[0] * t, q.o[1] + q.u[1] * s + q.v[1] * t, q.o[2] + q.u[2] * s + q.v[2] * t];

// images: { [src]: image or canvas } (already loaded; SVGs best pre-rendered larger,
// see preload() in editor.js). The context's current
// transform maps the 1280x720 frame to the canvas.
export function drawFrame(ctx, st, images) {
  const base = ctx.getTransform();
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (st.opacity > 0) drawQuads(ctx, base, st.cam, st.quads, images, st.opacity);
  ctx.setTransform(base);
  ctx.globalAlpha = 1;
  for (const o of st.overlays) (o.type === "hand" ? drawHand : drawLabel)(ctx, o);
  drawTitle(ctx, st.title);
  for (const c of st.captions) drawCaption(ctx, c);
  ctx.restore();
}

function drawQuads(ctx, base, cam, quads, images, alpha) {
  const list = [];
  for (const q of quads) {
    const vs = [at(q, 0, 0), at(q, q.w, 0), at(q, q.w, q.h), at(q, 0, q.h)].map((p) => toView(cam, p));
    const ss = vs.map(viewToScreen);
    if (ss.some((s) => s[2] <= 0)) continue; // crosses behind the camera
    const cross = (ss[1][0] - ss[0][0]) * (ss[3][1] - ss[0][1]) - (ss[1][1] - ss[0][1]) * (ss[3][0] - ss[0][0]);
    if (q.cull && cross <= 0) continue;
    list.push({ q, ss, depth: (vs[0][2] + vs[1][2] + vs[2][2] + vs[3][2]) / 4 });
  }
  // Sorting by centre depth alone fails next to the router's huge faces (a plug in a
  // port has a centre "behind" the panel's centre), so parts are ordered around the
  // router box first: a part outside one of its camera-facing faces is drawn after
  // the router, any other part before it. Within each group: back to front.
  const e = eye(cam);
  const planes = [
    [[1, 0, 0], BODY.x1], [[-1, 0, 0], -BODY.x0], [[0, 1, 0], BODY.y1],
    [[0, -1, 0], -BODY.y0], [[0, 0, 1], 0], [[0, 0, -1], BODY.depth],
  ].filter(([n, d]) => n[0] * e[0] + n[1] * e[1] + n[2] * e[2] > d);
  const inFront = (q) => {
    const c = at(q, q.w / 2, q.h / 2);
    return planes.some(([n, d]) => n[0] * c[0] + n[1] * c[1] + n[2] * c[2] > d + 0.5);
  };
  const rank = (q) => (q.layer === "outside" ? -1 : q.layer === "back" ? 0 : q.ground ? 1 : q.solid ? 3 : inFront(q) ? 4 : 2);
  for (const item of list) item.rank = rank(item.q);
  list.sort((a, b) => a.rank - b.rank || a.depth - b.depth);
  for (const { q, ss } of list) {
    const face = q.face;
    ctx.globalAlpha = alpha * q.opacity;
    const big = q.w * q.h > 40000;
    // Large plain faces are drawn as one polygon (their corner radius is too small to matter).
    const plain = !face.img && !face.dots?.length && !face.gradient && !face.shadow && !face.glow && (!face.radius || big);
    if (plain) {
      ctx.setTransform(base);
      ctx.beginPath();
      ss.forEach((s, i) => (i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1])));
      ctx.closePath();
      ctx.fillStyle = face.fill;
      ctx.fill();
      if (face.stroke || (face.fill && !face.fill.startsWith("rgba"))) {
        // An outline in the face's own colour closes the anti-aliasing seams between
        // neighbouring faces (e.g. the facets of rounded parts).
        ctx.strokeStyle = face.stroke ?? face.fill;
        ctx.lineWidth = face.stroke ? 1 : 0.9;
        ctx.stroke();
      }
    } else if (face.gradient && !face.img && !face.radius) {
      // Gradient-only faces (glass, cable strips) as one polygon with the gradient laid
      // from the top edge to the bottom edge on screen: no overlapping pieces, which
      // would double up where the colours are see-through.
      const top = [(ss[0][0] + ss[1][0]) / 2, (ss[0][1] + ss[1][1]) / 2];
      const bottom = [(ss[3][0] + ss[2][0]) / 2, (ss[3][1] + ss[2][1]) / 2];
      const g = ctx.createLinearGradient(top[0], top[1], bottom[0], bottom[1]);
      for (const [stop, c] of face.gradient) g.addColorStop(stop, c);
      ctx.setTransform(base);
      ctx.beginPath();
      ss.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    } else if (face.img || face.gradient || face.shadow || big) {
      drawGrid(ctx, base, cam, q, images);
    } else {
      // Small decorated face (caps, LEDs, highlights): one affine map, not clipped, so
      // glows can spill over the edges as they do in CSS.
      ctx.save();
      ctx.setTransform(base.multiply(affine(ss[0], ss[1], ss[3], q.w, q.h)));
      drawFaceContent(ctx, face, q.w, q.h, images, false);
      ctx.restore();
    }
  }
  ctx.globalAlpha = alpha;
}

// Maps face pixels (0,0)-(w,h) to the screen through three corners.
const affine = (p0, p1, p3, w, h) =>
  new DOMMatrix([(p1[0] - p0[0]) / w, (p1[1] - p0[1]) / w, (p3[0] - p0[0]) / h, (p3[1] - p0[1]) / h, p0[0], p0[1]]);

function drawGrid(ctx, base, cam, q, images) {
  // Finer grid for crisp vector panels (res > 1): smaller pieces, smaller perspective error.
  const cell = q.face.res ? 64 : 140;
  const nu = Math.max(1, Math.min(24, Math.ceil(q.w / cell)));
  const nv = Math.max(1, Math.min(8, Math.ceil(q.h / cell)));
  const grid = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = (q.w * i) / nu, v = (q.h * j) / nv;
      const p = project(cam, at(q, u, v));
      grid.push({ u, v, x: p[0], y: p[1] });
    }
  }
  const g = (i, j) => grid[j * (nu + 1) + i];
  // Base colour for every piece first, then the image: painting the base under each
  // piece's image would tint the strips where pieces overlap.
  const passes = q.face.img || q.face.dots?.length ? ["base", "content"] : ["all"];
  for (const pass of passes) {
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        drawTriangle(ctx, base, q, images, g(i, j), g(i + 1, j), g(i, j + 1), pass);
        drawTriangle(ctx, base, q, images, g(i + 1, j + 1), g(i, j + 1), g(i + 1, j), pass);
      }
    }
  }
}

// Clips to the screen triangle (grown slightly to hide anti-aliasing seams) and
// draws the face content through the affine map that takes a, b, c to the screen.
function drawTriangle(ctx, base, q, images, a, b, c, pass) {
  const du1 = b.u - a.u, dv1 = b.v - a.v, du2 = c.u - a.u, dv2 = c.v - a.v;
  const det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-9) return;
  const dx1 = b.x - a.x, dy1 = b.y - a.y, dx2 = c.x - a.x, dy2 = c.y - a.y;
  const m11 = (dx1 * dv2 - dx2 * dv1) / det, m12 = (dx2 * du1 - dx1 * du2) / det;
  const m21 = (dy1 * dv2 - dy2 * dv1) / det, m22 = (dy2 * du1 - dy1 * du2) / det;
  const tx = a.x - m11 * a.u - m12 * a.v, ty = a.y - m21 * a.u - m22 * a.v;
  ctx.save();
  ctx.setTransform(base);
  ctx.beginPath();
  // Grow the triangle by moving every edge 0.8 px outwards (mitred corners), so
  // neighbouring pieces overlap and anti-aliased edges don't let the background through.
  const pts = [a, b, c];
  pts.forEach((p, k) => {
    const prev = pts[(k + 2) % 3], next = pts[(k + 1) % 3];
    const e1x = p.x - prev.x, e1y = p.y - prev.y, l1 = Math.hypot(e1x, e1y) || 1;
    const e2x = p.x - next.x, e2y = p.y - next.y, l2 = Math.hypot(e2x, e2y) || 1;
    let bx = e1x / l1 + e2x / l2, by = e1y / l1 + e2y / l2;
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl;
    by /= bl;
    // sin of half the corner angle = distance of the bisector from either edge.
    const sinHalf = Math.abs(bx * (e1y / l1) - by * (e1x / l1)) || 1;
    const m = Math.min(0.8 / sinHalf, 4);
    if (k) ctx.lineTo(p.x + bx * m, p.y + by * m); else ctx.moveTo(p.x + bx * m, p.y + by * m);
  });
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(base.multiply(new DOMMatrix([m11, m21, m12, m22, tx, ty])));
  drawFaceContent(ctx, q.face, q.w, q.h, images, true, pass);
  ctx.restore();
}

function shapePath(ctx, face, w, h) {
  ctx.beginPath();
  if (face.radius === "50%") ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else ctx.roundRect(0, 0, w, h, Array.isArray(face.radius) ? face.radius : [face.radius ?? 0]);
}

// pass: "base" (fill only), "content" (image, dots, stroke) or "all".
function drawFaceContent(ctx, face, w, h, images, clipped, pass = "all") {
  if (face.shadow) {
    // Same as CSS radial-gradient(closest-side, ...): a unit circle scaled to the face.
    ctx.translate(w / 2, h / 2);
    ctx.scale(w / 2, h / 2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, "rgba(0,0,0,0.28)");
    g.addColorStop(0.6, "rgba(0,0,0,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    return;
  }
  if (pass !== "content") drawFaceBase(ctx, face, w, h);
  if (pass === "base") return;
  drawFaceDetails(ctx, face, w, h, images, clipped);
}

function drawFaceBase(ctx, face, w, h) {
  shapePath(ctx, face, w, h);
  if (face.gradient) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [s, c] of face.gradient) g.addColorStop(s, c);
    ctx.fillStyle = g;
    ctx.fill();
  } else if (face.fill) {
    ctx.save();
    if (face.glow) {
      ctx.shadowColor = face.glow;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = face.fill;
    ctx.fill();
    ctx.restore();
  }
}

function drawFaceDetails(ctx, face, w, h, images, clipped) {
  if (face.img || face.dots?.length) {
    ctx.save();
    if (!clipped || face.radius) {
      shapePath(ctx, face, w, h);
      ctx.clip();
    }
    if (face.img) {
      const { media, sx, sy, sw, sh, rot } = face.img;
      const img = images[MEDIA[media].src];
      if (img) {
        const turned = rot % 180 !== 0;
        const kx = (turned ? h : w) / sw, ky = (turned ? w : h) / sh;
        // Source pixels: the image may be a pre-rendered (larger) copy, e.g. an SVG at 3x.
        const ks = img.width / MEDIA[media].w;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(img, sx * ks, sy * ks, sw * ks, sh * ks, (-sw * kx) / 2, (-sh * ky) / 2, sw * kx, sh * ky);
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
    ctx.restore();
  }
  if (face.stroke) {
    // CSS borders sit inside the box, so inset the stroke by half its width.
    const sw = face.strokeW ?? 1;
    const r = Array.isArray(face.radius) ? face.radius[0] : face.radius ?? 0;
    ctx.save();
    if (face.glow) {
      ctx.shadowColor = face.glow;
      ctx.shadowBlur = 18;
    }
    ctx.beginPath();
    if (face.radius === "50%") ctx.ellipse(w / 2, h / 2, (w - sw) / 2, (h - sw) / 2, 0, 0, Math.PI * 2);
    else ctx.roundRect(sw / 2, sw / 2, w - sw, h - sw, Math.max(0, r - sw / 2));
    ctx.strokeStyle = face.stroke;
    ctx.lineWidth = sw;
    ctx.stroke();
    ctx.restore();
  }
}

const HAND_PATHS = typeof Path2D === "undefined" ? [] : HAND.map((s) => ({ ...s, path: new Path2D(s.d) }));

function drawHand(ctx, o) {
  ctx.save();
  ctx.globalAlpha = o.opacity;
  ctx.translate(o.x, o.y);
  ctx.scale(o.s, o.s);
  for (const s of HAND_PATHS) {
    ctx.fillStyle = s.fill;
    ctx.fill(s.path);
    if (s.stroke) {
      ctx.strokeStyle = s.stroke;
      ctx.lineWidth = 2;
      ctx.stroke(s.path);
    }
  }
  ctx.restore();
}

function drawLabel(ctx, o) {
  if (o.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = o.opacity;
  ctx.font = "600 22px sans-serif";
  const w = ctx.measureText(o.text).width + 34, h = 40;
  ctx.shadowColor = "rgba(0,0,0,0.12)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.roundRect(o.x - w / 2, o.y - h, w, h, 18);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#D5DAE0";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#1B1D22";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(o.text, o.x, o.y - h / 2 + 1);
  ctx.restore();
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
