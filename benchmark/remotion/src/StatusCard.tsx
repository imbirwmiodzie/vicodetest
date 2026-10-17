import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type StatusConfig = {
  title: string;
  value: number;
  unit: string;
  accentColor: string;
  bars: number[];
  speed: number;
  loop: boolean;
};

export const FPS = 30;
export const DURATION_S = 8;
export const DURATION_FRAMES = FPS * DURATION_S;
export const HOLD_END_FRAME = Math.round(6.6 * FPS); // where loop:false stops

export const defaultConfig: StatusConfig = {
  title: "System status",
  value: 78,
  unit: "%",
  accentColor: "#3D8BFF",
  bars: [30, 55, 80, 45, 65],
  speed: 1,
  loop: true,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// Normalised progress of t through [start, end], clamped to 0..1.
const prog = (t: number, start: number, end: number) =>
  clamp((t - start) / (end - start), 0, 1);

const RING = { cx: 380, cy: 410, r: 150, stroke: 26 };
const CIRC = 2 * Math.PI * RING.r;
const BARS = { x: 700, w: 56, gap: 36, baseline: 580, maxH: 320 };

export const StatusCard: React.FC<StatusConfig> = (cfg) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const value = Number.isFinite(cfg.value) ? cfg.value : 0;
  const ringPct = clamp(value, 0, 100) / 100;

  const outP = easeInCubic(prog(t, 6.6, 7.6));
  const fadeOut = 1 - outP;

  const titleIn = easeOutCubic(prog(t, 0.3, 1.1));
  const titleY = 40 * (1 - titleIn) - 20 * outP;

  const tracks = prog(t, 0.6, 1.0) * fadeOut;
  const fill = easeInOutCubic(prog(t, 0.8, 2.8));
  const arc = fill * ringPct;
  const shown = Math.round(value * fill);

  let dotR = 9;
  if (t >= 2.8 && t <= 6.6) {
    dotR = 9 + 4 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (t - 2.8)) / 1.9));
  }
  const dotOpacity = prog(t, 2.8, 3.0) * fadeOut;
  const angle = -Math.PI / 2 + arc * 2 * Math.PI;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0E1116", fontFamily: "sans-serif" }}>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 80,
          width: 1120,
          height: 560,
          borderRadius: 24,
          backgroundColor: "#171B22",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 110,
          maxWidth: 1040,
          fontSize: 52,
          fontWeight: 600,
          lineHeight: 1,
          color: "#E6EAF2",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          opacity: titleIn * fadeOut,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {cfg.title}
      </div>

      <svg width={1280} height={720} style={{ position: "absolute", left: 0, top: 0 }}>
        <circle
          cx={RING.cx}
          cy={RING.cy}
          r={RING.r}
          fill="none"
          stroke="#2A2F3A"
          strokeWidth={RING.stroke}
          opacity={tracks}
        />
        {arc > 0 ? (
          <circle
            cx={RING.cx}
            cy={RING.cy}
            r={RING.r}
            fill="none"
            stroke={cfg.accentColor}
            strokeWidth={RING.stroke}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - arc)}
            transform={`rotate(-90 ${RING.cx} ${RING.cy})`}
            opacity={fadeOut}
          />
        ) : null}
        <circle
          cx={RING.cx + RING.r * Math.cos(angle)}
          cy={RING.cy + RING.r * Math.sin(angle)}
          r={dotR}
          fill="#FFFFFF"
          opacity={dotOpacity}
        />
        {cfg.bars.map((b, i) => {
          const x = BARS.x + i * (BARS.w + BARS.gap);
          const target = (clamp(b, 0, 100) / 100) * BARS.maxH;
          const h = target * easeOutCubic(prog(t, 1.2 + i * 0.15, 2.1 + i * 0.15));
          return (
            <g key={i} opacity={tracks}>
              <path d={barPath(x, BARS.maxH)} fill="#232833" />
              {h > 0 ? <path d={barPath(x, h)} fill={cfg.accentColor} /> : null}
            </g>
          );
        })}
      </svg>

      <div
        style={{
          position: "absolute",
          left: RING.cx - 200,
          top: RING.cy - 60,
          width: 400,
          height: 120,
          display: "flex",
          justifyContent: "center",
          alignItems: "baseline",
          lineHeight: "120px",
          opacity: tracks,
        }}
      >
        <span style={{ fontSize: 104, fontWeight: 700, color: "#FFFFFF" }}>{shown}</span>
        <span style={{ fontSize: 44, fontWeight: 600, color: cfg.accentColor }}>{cfg.unit}</span>
      </div>
    </AbsoluteFill>
  );
};

// Bar with rounded top corners (radius 8), growing up from the baseline.
function barPath(x: number, h: number) {
  const r = Math.min(8, h / 2, BARS.w / 2);
  const y = BARS.baseline - h;
  const x2 = x + BARS.w;
  return `M${x},${BARS.baseline} V${y + r} Q${x},${y} ${x + r},${y} H${x2 - r} Q${x2},${y} ${x2},${y + r} V${BARS.baseline} Z`;
}
