import {Node, makeScene2D} from '@revideo/2d';
import {createSignal, makeProject, tween, useScene} from '@revideo/core';
import {drawFrame} from '../../shared/router-canvas.js';
import {DEFAULTS, frameState, normalize, timeline, type FrameState} from '../../shared/router-scene.js';

// Centro Business 3.0 setup. The scene (timeline maths, geometry, camera) is shared
// with the Remotion and HyperFrames versions; see benchmark/shared/router-scene.js.
// Revideo draws on a 2D canvas without CSS 3D, so one custom node projects the
// boxes, cables and photos itself (benchmark/shared/router-canvas.js).

// Photos, loaded by the demo page before the player starts (keyed by URL).
export const images: Record<string, HTMLImageElement> = {};

class RouterCanvas extends Node {
  public state: () => FrameState | null = () => null;

  protected override async draw(context: CanvasRenderingContext2D) {
    const st = this.state();
    if (st) {
      // Revideo's origin is the centre of the frame; the scene uses top-left pixels.
      context.save();
      context.translate(-640, -360);
      drawFrame(context, st, images);
      context.restore();
    }
    await super.draw(context);
  }
}

const scene = makeScene2D('router-setup', function* (view) {
  // The whole scene config is one project variable, so a change reaches the
  // node's state() without rebuilding anything.
  const config = useScene().variables.get('config', DEFAULTS);
  const t = createSignal(0);
  const node = new RouterCanvas({});
  node.state = () => frameState(t(), normalize(config()));
  view.fill('#FFFFFF');
  view.add(node);
  // The steps are configurable, so the length comes from the config. A config change
  // reloads the scene, which re-runs this with the new length.
  const duration = timeline(normalize(config())).duration;
  yield* tween(duration, v => t(v * duration));
});

export default makeProject({
  scenes: [scene],
  settings: {
    shared: {
      size: {x: 1280, y: 720},
    },
  },
});
