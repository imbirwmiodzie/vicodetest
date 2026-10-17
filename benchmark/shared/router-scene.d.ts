export type RouterConfig = {
  title: string;
  ethernet: boolean;
  port: number;
  direct: boolean;
  extension: boolean;
  usbPort: "front" | "back";
  panelStyle: "vector" | "photo";
  stepEthernet: string;
  stepDirect: string;
  stepExtension: string;
  stepExtensionRouter: string;
  stepWindow: string;
  cableLabel: string;
  done: string;
  cableColor: string;
  usbCableColor: string;
  ledColor: string;
  accentColor: string;
  speed: number;
  loop: boolean;
};
export type Vec3 = [number, number, number];
export type Cam = { fx: number; fy: number; fz: number; zoom: number; rotY: number; rotX: number };
export type Dot = { x: number; y: number; w: number; h: number; fill: string; glow?: string; glowSize?: number; stripes?: boolean };
export type Face = {
  fill?: string;
  stroke?: string;
  strokeW?: number;
  radius?: number | number[] | "50%";
  glow?: string;
  gradient?: [number, string][];
  shadow?: boolean;
  img?: { media: keyof typeof MEDIA; sx: number; sy: number; sw: number; sh: number; rot: number };
  dots?: Dot[];
  res?: number;
};
export type Quad = { key: string; o: Vec3; u: Vec3; v: Vec3; w: number; h: number; face: Face; opacity: number; cull: boolean; ground?: boolean; layer?: "back"; solid?: "router" };
export type Overlay =
  | { type: "hand"; x: number; y: number; s: number; opacity: number }
  | { type: "label"; x: number; y: number; text: string; opacity: number };
export type Caption = { n: string; text: string; color: string; opacity: number };
export type FrameState = {
  cam: Cam;
  opacity: number;
  quads: Quad[];
  overlays: Overlay[];
  title: { text: string; opacity: number };
  captions: Caption[];
};

export const FPS: number;
export const WIDTH: number;
export const HEIGHT: number;
export const MAX_DURATION_S: number;
export const MEDIA: Record<
  "router" | "routerFront" | "stickFront" | "stickEdge" | "backVector" | "frontVector" | "ledGreen" | "guideWhite" | "guideGreen",
  { src: string; w: number; h: number }
>;
export const DEFAULTS: RouterConfig;
export const HAND: { d: string; fill: string; stroke?: string }[];
export function normalize(raw: unknown, isColor?: (c: string) => boolean): RouterConfig;
export function timeline(cfg: RouterConfig): { at: Record<string, number>; duration: number; holdEnd: number };
export const VIEW: { perspective: number; top: number };
export function cssWorld(cam: Cam): string;
export function eye(cam: Cam): Vec3;
export const BODY: { x0: number; x1: number; y0: number; y1: number; depth: number };
export function cross3(a: Vec3, b: Vec3): Vec3;
export function frameState(t: number, cfg: RouterConfig): FrameState;
