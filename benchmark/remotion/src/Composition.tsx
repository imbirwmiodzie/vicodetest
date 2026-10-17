import { Composition } from "remotion";
import {
  DURATION_FRAMES,
  FPS,
  StatusCard,
  defaultConfig,
} from "./StatusCard";
import {
  FPS as ROUTER_FPS,
  RouterSetup,
  defaultRouterConfig,
  durationFrames,
} from "./RouterSetup";

// Studio preview only; the live demos use <Player> in demo/main.tsx and demo/router.tsx.
export const MyComposition = () => {
  return (
    <>
      <Composition
        id="StatusCard"
        component={StatusCard}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={defaultConfig}
      />
      <Composition
        id="RouterSetup"
        component={RouterSetup}
        durationInFrames={durationFrames(defaultRouterConfig)}
        calculateMetadata={({ props }) => ({ durationInFrames: durationFrames(props) })}
        fps={ROUTER_FPS}
        width={1280}
        height={720}
        defaultProps={defaultRouterConfig}
      />
    </>
  );
};
