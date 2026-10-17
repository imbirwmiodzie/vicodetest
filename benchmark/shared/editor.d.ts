import type { RouterConfig } from "./router-scene";
export function loadConfig(url?: string): Promise<RouterConfig>;
export function mountEditor(root: HTMLElement, initial: RouterConfig, onChange: (cfg: RouterConfig) => void): { set(cfg: unknown): void };
export function preload(srcs: string[]): Promise<Record<string, HTMLImageElement>>;
