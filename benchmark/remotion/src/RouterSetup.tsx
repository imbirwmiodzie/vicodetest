import React from "react";
import { Img, useCurrentFrame, useVideoConfig } from "remotion";
import { DEFAULTS, FPS as SCENE_FPS, frameState, timeline, type Quad, type RouterConfig } from "../../shared/router-scene.js";
import {
  HAND_SHAPES,
  captionStyles,
  dotStyle,
  faceImage,
  handTransform,
  labelStyle,
  layerStyles,
  quadStyle,
  titleStyle,
  worldTransform,
} from "../../shared/router-dom.js";

// Centro Business 3.0 setup: Ethernet, the TCL IK41 into a USB port, then onto a USB
// extension cable and to the window. The scene itself (timeline, geometry, camera)
// lives in ../../shared/router-scene.js so all three tools play the same animation;
// this component maps each frame's quads to DOM elements with CSS 3D.

export type { RouterConfig };
export const FPS = SCENE_FPS;
export const defaultRouterConfig: RouterConfig = DEFAULTS;
// The steps are configurable, so the length depends on the config.
export const durationFrames = (cfg: RouterConfig) => Math.round(timeline(cfg).duration * FPS);
export const holdEndFrame = (cfg: RouterConfig) => Math.round(timeline(cfg).holdEnd * FPS); // where loop:false stops

const renderQuad = (q: Quad) => {
  const im = faceImage(q);
  return (
    <div key={q.key} style={quadStyle(q)}>
      {im ? (
        <div style={im.wrap}>
          <Img src={im.src} style={im.img} />
        </div>
      ) : null}
      {q.face.dots?.map((d, i) => <div key={i} style={dotStyle(d)} />)}
    </div>
  );
};

export const RouterSetup: React.FC<RouterConfig> = (cfg) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const st = frameState(frame / fps, cfg);

  return (
    <div style={layerStyles.root}>
      <div style={{ ...layerStyles.stage, opacity: st.opacity }}>
        {/* The wall gets its own layer behind everything (see router-scene.js). */}
        <div style={{ ...layerStyles.world, transform: worldTransform(st.cam) }}>
          {st.quads.filter((q) => q.layer === "back").map(renderQuad)}
        </div>
        <div style={{ ...layerStyles.world, transform: worldTransform(st.cam) }}>
          {st.quads.filter((q) => q.layer !== "back").map(renderQuad)}
        </div>
      </div>
      {st.overlays.map((o) =>
        o.type === "hand" ? (
          <svg key="hand" width={1280} height={720} style={layerStyles.svg}>
            <g transform={handTransform(o)} opacity={o.opacity}>
              {HAND_SHAPES.map((s, i) => (
                <path key={i} d={s.d} fill={s.fill} stroke={s.stroke} strokeWidth={s.stroke ? 2 : undefined} />
              ))}
            </g>
          </svg>
        ) : (
          <div key="label" style={labelStyle(o)}>
            {o.text}
          </div>
        ),
      )}
      {st.title.opacity > 0 ? <div style={titleStyle(st.title.opacity)}>{st.title.text}</div> : null}
      {st.captions.map((c) => {
        const s = captionStyles(c);
        return (
          <div key={c.n} style={s.pill}>
            <span style={s.badge}>{c.n}</span>
            <span style={s.text}>{c.text}</span>
          </div>
        );
      })}
    </div>
  );
};
