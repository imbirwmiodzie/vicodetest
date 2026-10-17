import { Composition } from "remotion";
import {
  DURATION_FRAMES,
  FPS,
  StatusCard,
  defaultConfig,
} from "./StatusCard";

// Studio preview only; the live demo uses <Player> in demo/main.tsx.
export const MyComposition = () => {
  return (
    <Composition
      id="StatusCard"
      component={StatusCard}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={1280}
      height={720}
      defaultProps={defaultConfig}
    />
  );
};
