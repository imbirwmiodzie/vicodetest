export type RouterConfig = {
  title: string;
  step1: string;
  step2: string;
  step3: string;
  done: string;
  port: number;
  cableColor: string;
  usbCableColor: string;
  ledColor: string;
  accentColor: string;
  speed: number;
  loop: boolean;
};
export type Cam = { fx: number; fy: number; fz: number; zoom: number };
export type Pose = { x: number; y: number; z: number; ry?: number; rx?: number };
export type Face = {
  fill?: string;
  stroke?: string;
  radius?: number | number[];
  shadow?: boolean;
  cells?: number;
  img?: { media: keyof typeof MEDIA; sx: number; sy: number; sw: number; sh: number; rot: number };
  dots?: { x: number; y: number; w: number; h: number; fill: string; glow?: string; glowSize?: number; stripes?: boolean }[];
};
export type FaceName = "front" | "back" | "right" | "left" | "top" | "bottom";
export type Box = {
  key: string;
  pose: Pose;
  c: [number, number, number];
  size: [number, number, number];
  faces: Partial<Record<FaceName, Face>>;
  opacity: number;
};
export type PanelItem = {
  key: string;
  type: "rect" | "ring";
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeW?: number;
  glow?: string;
  opacity?: number;
};
export type Cable = { key: string; pts: [number, number, number][]; r: number; color: string; opacity: number };
export type Caption = { n: string; text: string; color: string; opacity: number };
export type FrameState = {
  cam: Cam;
  opacity: number;
  router: Box[];
  panel: PanelItem[];
  cables: Cable[];
  objects: Box[];
  title: { text: string; opacity: number };
  captions: Caption[];
};

export const FPS: number;
export const DURATION_S: number;
export const HOLD_END_S: number;
export const WIDTH: number;
export const HEIGHT: number;
export const MEDIA: {
  router: { src: string; w: number; h: number };
  stickFront: { src: string; w: number; h: number };
  stickEdge: { src: string; w: number; h: number };
};
export const DEFAULTS: RouterConfig;
export function normalize(raw: unknown, isColor?: (c: string) => boolean): RouterConfig;
export const VIEW: { perspective: number; rotX: number; rotY: number; top: number };
export function cssWorld(cam: Cam): string;
export function cssPose(pose: Pose): string;
export function frameState(t: number, cfg: RouterConfig): FrameState;
