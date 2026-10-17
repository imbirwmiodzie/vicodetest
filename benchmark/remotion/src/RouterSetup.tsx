import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";

// Centro Business 3.0 installation steps: Ethernet cable into a LAN port, then the
// TCL LinkKey IK41 stick into the USB 2.0 port. The router is a CSS 3D box whose
// front face is the back-panel photo, so plugs can travel along the panel normal.
// World units are pixels of the 1360x260 back-panel photo; +z points out of the panel.

export type RouterConfig = {
  title: string;
  step1: string; // "{port}" is replaced by the port number
  step2: string;
  done: string;
  port: number;
  cableColor: string;
  ledColor: string;
  accentColor: string;
  speed: number;
  loop: boolean;
};

export const FPS = 30;
export const DURATION_S = 13;
export const DURATION_FRAMES = FPS * DURATION_S;
export const HOLD_END_FRAME = Math.round(11.6 * FPS); // where loop:false stops

export const defaultRouterConfig: RouterConfig = {
  title: "Centro Business 3.0",
  step1: "Connect the Ethernet cable to port {port}",
  step2: "Plug the TCL LinkKey IK41 into the USB 2.0 port",
  done: "Ethernet and mobile backup connected",
  port: 1,
  cableColor: "#E4E7EB",
  ledColor: "#38E07B",
  accentColor: "#0F6FDE",
  speed: 1,
  loop: true,
};

export const MEDIA = {
  router: "/media/cb3-back.png",
  stick: "/media/tcl-ik41-side.jpeg",
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const prog = (t: number, start: number, end: number) =>
  clamp((t - start) / (end - start), 0, 1);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

// Measured on the photo: router body, socket openings and link LEDs.
const BODY = { x0: 49, x1: 1305, y0: 10, y1: 232, depth: 1000, color: "#363944" };
const PORTS = [
  { x: 345.5, led: [366, 98, 14, 9] },
  { x: 422, led: [443, 98, 13, 9] },
  { x: 498.5, led: [519, 98, 14, 9] },
  { x: 574.5, led: [596, 98, 13, 9] },
  { x: 668, led: [690, 97, 11, 9] },
];
const PORT_Y = 121;
const USB = { x: 1027.5, y: 120 };

// RJ45 plug + boot, and the stick (body face cropped from the 1037x615 side photo).
const PLUG = { w: 58, h: 44, len: 120, inside: 100 };
const BOOT = { w: 52, h: 40, len: 90 };
const CABLE_R = 15;
const STICK = { h: 150, len: 494, t: 55, plugW: 24, plugH: 64, plugLen: 64 };
const STICK_CROP = { x: 165, y: 210, w: 790, h: 240, imgW: 1037, imgH: 615 };

type Cam = { fx: number; fy: number; fz: number; zoom: number };
const OVERVIEW: Cam = { fx: 800, fy: 160, fz: 160, zoom: -560 };
const START: Cam = { ...OVERVIEW, zoom: -760 };
const portCam = (x: number): Cam => ({ fx: x + 40, fy: PORT_Y + 10, fz: 110, zoom: 900 });
const USB_CAM: Cam = { fx: USB.x - 40, fy: USB.y + 30, fz: 260, zoom: 420 };

const mixCam = (a: Cam, b: Cam, p: number): Cam => ({
  fx: lerp(a.fx, b.fx, p),
  fy: lerp(a.fy, b.fy, p),
  fz: lerp(a.fz, b.fz, p),
  zoom: lerp(a.zoom, b.zoom, p),
});

export const RouterSetup: React.FC<RouterConfig> = (cfg) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const portN = clamp(Math.round(cfg.port) || 1, 1, 5);
  const port = { ...PORTS[portN - 1], n: portN };
  const P1 = portCam(port.x);

  // Camera path: overview -> port -> USB -> overview.
  let cam = START;
  if (t < 1.1) cam = mixCam(START, OVERVIEW, easeOutCubic(prog(t, 0.3, 1.1)));
  else if (t < 4.6) cam = mixCam(OVERVIEW, P1, easeInOutCubic(prog(t, 1.1, 2.1)));
  else if (t < 8.0) cam = mixCam(P1, USB_CAM, easeInOutCubic(prog(t, 4.6, 5.6)));
  else cam = mixCam(USB_CAM, OVERVIEW, easeInOutCubic(prog(t, 8.0, 9.2)));

  const sceneIn = easeOutCubic(prog(t, 0.3, 1.0));
  const fadeOut = 1 - easeInCubic(prog(t, 11.6, 12.4));

  // Plug travel: distance (along +z) still to go; snaps the last bit in ("click").
  const plugGap =
    t < 3.6 ? lerp(520, 14, easeOutCubic(prog(t, 2.1, 3.6))) : 14 * (1 - easeInCubic(prog(t, 3.6, 3.8)));
  const stickGap =
    t < 7.1 ? lerp(420, 12, easeOutCubic(prog(t, 5.6, 7.1))) : 12 * (1 - easeInCubic(prog(t, 7.1, 7.3)));
  const plugVisible = t >= 2.1;
  const stickVisible = t >= 5.6;

  const ledOn = t >= 4.0 && Math.floor((t - 4.0) * 8) % 6 !== 3;
  const stickLed = t >= 7.6 ? 0.55 + 0.45 * Math.sin((t - 7.6) * 2 * Math.PI * 0.8) : 0;
  const portHighlight = t >= 1.6 && t < 3.8 ? 0.5 + 0.5 * Math.sin((t - 1.6) * 2 * Math.PI * 1.2) : 0;
  const usbHighlight = t >= 5.2 && t < 7.3 ? 0.5 + 0.5 * Math.sin((t - 5.2) * 2 * Math.PI * 1.2) : 0;
  const click1 = prog(t, 3.8, 4.3);
  const click2 = prog(t, 7.3, 7.8);

  // Captions (2D overlay).
  const cap1 = prog(t, 1.4, 1.8) * (1 - prog(t, 4.6, 4.9));
  const cap2 = prog(t, 4.9, 5.3) * (1 - prog(t, 8.0, 8.3));
  const cap3 = prog(t, 8.6, 9.0);

  const world = `translateZ(${cam.zoom}px) rotateX(-14deg) rotateY(-32deg) translate3d(${-cam.fx}px, ${-cam.fy}px, ${-cam.fz}px)`;

  return (
    <AbsoluteFill style={{ backgroundColor: "#FFFFFF", fontFamily: "sans-serif" }}>
      <AbsoluteFill
        style={{
          perspective: 1600,
          perspectiveOrigin: "50% 50%",
          opacity: sceneIn * fadeOut,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 640, top: 380, transformStyle: "preserve-3d", transform: world }}>
          <Shadow />
          <RouterBox />
          <PanelOverlay
            led={port.led}
            ledColor={cfg.ledColor}
            ledOn={ledOn}
            accent={cfg.accentColor}
            portX={port.x}
            portHighlight={portHighlight}
            usbHighlight={usbHighlight}
            click1={click1}
            click2={click2}
          />
          {plugVisible ? <EthernetPlug x={port.x} gap={plugGap} color={cfg.cableColor} /> : null}
          {stickVisible ? <Stick gap={stickGap} led={stickLed} /> : null}
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: 64,
          top: 52,
          fontSize: 40,
          fontWeight: 700,
          color: "#1B1D22",
          padding: "6px 18px",
          marginLeft: -18,
          borderRadius: 12,
          background: "rgba(255,255,255,0.9)",
          opacity: prog(t, 0.4, 1.0) * fadeOut,
          whiteSpace: "nowrap",
          maxWidth: 1150,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {cfg.title}
      </div>
      <Caption n="1" text={cfg.step1.split("{port}").join(String(port.n))} opacity={cap1 * fadeOut} accent={cfg.accentColor} />
      <Caption n="2" text={cfg.step2} opacity={cap2 * fadeOut} accent={cfg.accentColor} />
      <Caption n="✓" text={cfg.done} opacity={cap3 * fadeOut} accent={cfg.ledColor} />
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ n: string; text: string; opacity: number; accent: string }> = ({
  n,
  text,
  opacity,
  accent,
}) =>
  opacity > 0 ? (
    <div
      style={{
        position: "absolute",
        left: 64,
        bottom: 56,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "16px 28px 16px 16px",
        borderRadius: 40,
        background: "rgba(255,255,255,0.94)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.12)",
        opacity,
        transform: `translateY(${(1 - opacity) * 16}px)`,
        maxWidth: 1150,
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          background: accent,
          color: "#FFFFFF",
          fontSize: 26,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        {n}
      </span>
      <span style={{ fontSize: 30, fontWeight: 600, color: "#1B1D22", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {text}
      </span>
    </div>
  ) : null;

// ---- 3D building blocks -------------------------------------------------------

type FaceName = "front" | "back" | "right" | "left" | "top" | "bottom";

// Box centred at (x, y, z) with size (w, h, d). Faces point outwards and hide their
// back side, so the browser's depth sorting gives a solid-looking box.
const Box: React.FC<{
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  faces: Partial<Record<FaceName, React.CSSProperties | null>>;
  children?: Partial<Record<FaceName, React.ReactNode>>;
}> = ({ x, y, z, w, h, d, faces, children }) => {
  const spec: Record<FaceName, [number, number, string]> = {
    front: [w, h, `translateZ(${d / 2}px)`],
    back: [w, h, `rotateY(180deg) translateZ(${d / 2}px)`],
    right: [d, h, `rotateY(90deg) translateZ(${w / 2}px)`],
    left: [d, h, `rotateY(-90deg) translateZ(${w / 2}px)`],
    top: [w, d, `rotateX(90deg) translateZ(${h / 2}px)`],
    bottom: [w, d, `rotateX(-90deg) translateZ(${h / 2}px)`],
  };
  return (
    <div style={{ position: "absolute", transformStyle: "preserve-3d", transform: `translate3d(${x}px, ${y}px, ${z}px)` }}>
      {(Object.keys(faces) as FaceName[]).map((k) => {
        const style = faces[k];
        if (!style) return null;
        const [fw, fh, tf] = spec[k];
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: -fw / 2,
              top: -fh / 2,
              width: fw,
              height: fh,
              transform: tf,
              backfaceVisibility: "hidden",
              ...style,
            }}
          >
            {children?.[k]}
          </div>
        );
      })}
    </div>
  );
};

const RouterBox: React.FC = () => {
  const w = BODY.x1 - BODY.x0;
  const h = BODY.y1 - BODY.y0;
  const side = `linear-gradient(90deg, #3B3F4B, #2A2D35)`;
  return (
    <Box
      x={BODY.x0 + w / 2}
      y={BODY.y0 + h / 2}
      z={-BODY.depth / 2}
      w={w}
      h={h}
      d={BODY.depth}
      faces={{
        front: { overflow: "hidden", borderRadius: 10 },
        top: { background: "linear-gradient(0deg, #4A4E5B, #30333C)", borderRadius: 10 },
        right: { background: side },
        left: { background: side },
      }}
      children={{
        front: (
          <Img
            src={MEDIA.router}
            style={{ position: "absolute", left: -BODY.x0, top: -BODY.y0, width: 1360, height: 260 }}
          />
        ),
      }}
    />
  );
};

// Soft contact shadow on the desk under the router.
const Shadow: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: BODY.x0 - 140,
      top: BODY.y1 + 18 - 700,
      width: BODY.x1 - BODY.x0 + 280,
      height: 1400,
      transform: `translateZ(${-BODY.depth / 2}px) rotateX(90deg)`,
      background: "radial-gradient(closest-side, rgba(0,0,0,0.28), rgba(0,0,0,0.12) 60%, rgba(0,0,0,0))",
    }}
  />
);

// Things drawn on the panel surface: link LED, port highlight, click ripple.
const PanelOverlay: React.FC<{
  led: number[];
  ledColor: string;
  ledOn: boolean;
  accent: string;
  portX: number;
  portHighlight: number;
  usbHighlight: number;
  click1: number;
  click2: number;
}> = ({ led, ledColor, ledOn, accent, portX, portHighlight, usbHighlight, click1, click2 }) => {
  const [lx, ly, lw, lh] = led;
  const ring = (cx: number, cy: number, p: number) =>
    p > 0 && p < 1 ? (
      <div
        style={{
          position: "absolute",
          left: cx - 30 - 70 * p,
          top: cy - 30 - 70 * p,
          width: 60 + 140 * p,
          height: 60 + 140 * p,
          borderRadius: "50%",
          border: `${6 * (1 - p) + 1}px solid ${accent}`,
          opacity: 1 - p,
        }}
      />
    ) : null;
  const outline = (x: number, y: number, w: number, h: number, a: number) =>
    a > 0 ? (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: 8,
          border: `4px solid ${accent}`,
          boxShadow: `0 0 18px ${accent}`,
          opacity: 0.35 + 0.65 * a,
        }}
      />
    ) : null;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, transform: "translateZ(1px)" }}>
      {outline(portX - 40, 88, 80, 72, portHighlight)}
      {outline(USB.x - 24, USB.y - 42, 48, 84, usbHighlight)}
      {ring(portX, PORT_Y, click1)}
      {ring(USB.x, USB.y, click2)}
      {ledOn ? (
        <div
          style={{
            position: "absolute",
            left: lx,
            top: ly,
            width: lw,
            height: lh,
            borderRadius: 2,
            background: ledColor,
            boxShadow: `0 0 14px 6px ${ledColor}`,
          }}
        />
      ) : null}
    </div>
  );
};

const EthernetPlug: React.FC<{ x: number; gap: number; color: string }> = ({ x, gap, color }) => {
  const plastic: React.CSSProperties = {
    background: "rgba(232,236,240,0.82)",
    border: "1px solid rgba(150,160,170,0.9)",
    boxSizing: "border-box",
  };
  const shade = (c: string, a: number) => ({ background: c, boxShadow: `inset 0 0 0 999px rgba(0,0,0,${a})` });
  // Plug body front sits PLUG.inside deep in the socket when gap = 0.
  const bodyZ = gap - PLUG.inside + PLUG.len / 2;
  const bootZ = gap - PLUG.inside + PLUG.len + BOOT.len / 2;
  const tail = gap - PLUG.inside + PLUG.len + BOOT.len; // where the cable leaves the boot
  return (
    <>
      <Box
        x={x}
        y={PORT_Y + 2}
        z={bodyZ}
        w={PLUG.w}
        h={PLUG.h}
        d={PLUG.len}
        faces={{ front: plastic, top: plastic, right: plastic, left: plastic, bottom: plastic }}
        children={{
          // Gold contacts along the top edge, latch lever along the bottom of the top face.
          right: (
            <div
              style={{
                position: "absolute",
                left: PLUG.len - 26,
                top: 4,
                width: 22,
                height: 8,
                background: "repeating-linear-gradient(90deg,#C9A23A 0 2px,transparent 2px 4px)",
              }}
            />
          ),
        }}
      />
      {/* latch lever on top */}
      <Box
        x={x}
        y={PORT_Y + 2 - PLUG.h / 2 - 5}
        z={bodyZ + 20}
        w={22}
        h={10}
        d={70}
        faces={{ top: plastic, right: plastic, left: plastic, front: plastic }}
      />
      <Box
        x={x}
        y={PORT_Y + 2}
        z={bootZ}
        w={BOOT.w}
        h={BOOT.h}
        d={BOOT.len}
        faces={{
          front: shade(color, 0.05),
          top: shade(color, 0),
          right: shade(color, 0.12),
          left: shade(color, 0.12),
          bottom: shade(color, 0.25),
        }}
      />
      <Cable x={x} z0={tail} color={color} />
    </>
  );
};

// Cable drawn in the vertical plane through the port (x = const): leaves the boot along
// +z, bends down to the desk and runs towards the viewer. Two crossed copies keep it
// from looking paper-thin when seen at an angle.
const Cable: React.FC<{ x: number; z0: number; color: string }> = ({ x, z0, color }) => {
  const y0 = PORT_Y + 2;
  const desk = BODY.y1 + 18 - CABLE_R;
  const end = Math.max(1150, z0 + 420);
  // SVG local coords: u = z, v = y (offset so everything is positive).
  const ox = 200;
  const d = `M${z0 + ox},${y0} L${z0 + 40 + ox},${y0} C${z0 + 200 + ox},${y0} ${z0 + 150 + ox},${desk} ${z0 + 300 + ox},${desk} L${end + ox},${desk}`;
  const svg = (
    <svg width={end + ox + 40} height={desk + 40} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <path d={d} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={CABLE_R * 2 + 3} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={CABLE_R * 2} strokeLinecap="round" />
      <path d={d} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={5} strokeLinecap="round" transform="translate(0,-7)" />
    </svg>
  );
  // rotateY(-90deg) maps local +x to world +z.
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transformOrigin: "0 0",
        transform: `translate3d(${x}px, 0, 0) rotateY(-90deg) translate3d(${-ox}px, 0, 0)`,
      }}
    >
      {svg}
    </div>
  );
};

const Stick: React.FC<{ gap: number; led: number }> = ({ gap, led }) => {
  const s = STICK;
  const scale = s.h / STICK_CROP.h;
  // Photo face: the side photo rotated 180 deg so the USB plug points at the panel and
  // the logo reads upright. Right face local +x runs from +z (viewer) to -z (panel).
  const photo: React.CSSProperties = {
    transform: "rotate(180deg)",
    borderRadius: "6px 16px 16px 6px",
    overflow: "hidden",
  };
  const dark = "#25272C";
  const bodyZ = gap + s.len / 2;
  const metal = "linear-gradient(180deg,#F4F5F7,#B9BEC6)";
  return (
    <>
      <Box
        x={USB.x}
        y={USB.y}
        z={bodyZ}
        w={s.t}
        h={s.h}
        d={s.len}
        faces={{
          right: { background: dark, borderRadius: "16px 6px 6px 16px" },
          left: { background: dark, borderRadius: "6px 16px 16px 6px" },
          top: { background: "linear-gradient(90deg,#3A3D44,#2C2E33)", borderRadius: 16 },
          bottom: { background: dark, borderRadius: 16 },
          front: { background: "linear-gradient(90deg,#2B2D33,#1E2024)", borderRadius: 16 },
          back: { background: dark },
        }}
        children={{
          right: (
            <div style={{ position: "absolute", inset: 0, ...photo }}>
              <Img
                src={MEDIA.stick}
                style={{
                  position: "absolute",
                  left: -STICK_CROP.x * scale,
                  top: -STICK_CROP.y * scale,
                  width: STICK_CROP.imgW * scale,
                  height: STICK_CROP.imgH * scale,
                }}
              />
              {led > 0 ? (
                <div
                  style={{
                    // LED dot of the photo, in the rotated face's coordinates.
                    position: "absolute",
                    left: (800 - STICK_CROP.x) * scale - 5,
                    top: (273 - STICK_CROP.y) * scale - 3,
                    width: 12,
                    height: 6,
                    borderRadius: 3,
                    background: "#5EC8FF",
                    boxShadow: `0 0 ${10 + 8 * led}px ${3 + 3 * led}px rgba(94,200,255,${led})`,
                  }}
                />
              ) : null}
            </div>
          ),
        }}
      />
      <Box
        x={USB.x}
        y={USB.y}
        z={gap - s.plugLen / 2}
        w={s.plugW}
        h={s.plugH}
        d={s.plugLen}
        faces={{
          right: { background: metal },
          left: { background: metal },
          top: { background: "#E8EAED" },
          bottom: { background: "#A9AEB6" },
          front: { background: "#9EA3AB" },
        }}
      />
    </>
  );
};
