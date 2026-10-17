import React from "react";
import { Img, useCurrentFrame, useVideoConfig } from "remotion";
import {
  DEFAULTS,
  DURATION_S,
  FPS as SCENE_FPS,
  HOLD_END_S,
  frameState,
  type Box,
  type RouterConfig,
} from "../../shared/router-scene.js";
import {
  FACES,
  boxStyle,
  cableLines,
  captionStyles,
  dotStyle,
  faceImage,
  faceStyle,
  layerStyles,
  panelStyle,
  titleStyle,
  worldTransform,
} from "../../shared/router-dom.js";

// Centro Business 3.0 setup: Ethernet into a LAN port, the TCL IK41 into USB, then the
// stick moved onto a USB extension cable. The scene itself (timeline, geometry, camera)
// lives in ../../shared/router-scene.js so all three tools play the same animation;
// this component maps each frame to DOM + CSS 3D.

export type { RouterConfig };
export const FPS = SCENE_FPS;
export const DURATION_FRAMES = Math.round(DURATION_S * FPS);
export const HOLD_END_FRAME = Math.round(HOLD_END_S * FPS); // where loop:false stops
export const defaultRouterConfig: RouterConfig = DEFAULTS;

const Boxes: React.FC<{ list: Box[] }> = ({ list }) => (
  <>
    {list.map((b) => (
      <div key={b.key} style={boxStyle(b)}>
        {FACES.map((name) => {
          const face = b.faces[name];
          if (!face) return null;
          const im = faceImage(name, b);
          return (
            <div key={name} style={faceStyle(name, b)}>
              {im ? (
                <div style={im.wrap}>
                  <Img src={im.src} style={im.img} />
                </div>
              ) : null}
              {face.dots?.map((d, i) => <div key={i} style={dotStyle(d)} />)}
            </div>
          );
        })}
      </div>
    ))}
  </>
);

export const RouterSetup: React.FC<RouterConfig> = (cfg) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const st = frameState(frame / fps, cfg);
  const world = worldTransform(st.cam);

  return (
    <div style={layerStyles.root}>
      <div style={{ ...layerStyles.stage, opacity: st.opacity }}>
        <div style={{ ...layerStyles.world, transform: world }}>
          <Boxes list={st.router} />
          <div style={layerStyles.panel}>
            {st.panel.map((it) => (
              <div key={it.key} style={panelStyle(it)} />
            ))}
          </div>
        </div>
        <svg width={1280} height={720} style={layerStyles.svg}>
          {st.cables.map((c) => (
            <g key={c.key} opacity={c.opacity}>
              {cableLines(st.cam, c).map((l, i) => (
                <line key={i} x1={l.x0} y1={l.y0} x2={l.x1} y2={l.y1} stroke={l.stroke} strokeWidth={l.w} strokeLinecap="round" />
              ))}
            </g>
          ))}
        </svg>
        <div style={{ ...layerStyles.world, transform: world }}>
          <Boxes list={st.objects} />
        </div>
      </div>
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
