import {Circle, Layout, Node, Rect, Txt, makeScene2D} from '@revideo/2d';
import {
  all,
  chain,
  createRef,
  createSignal,
  delay,
  easeInCubic,
  easeInOutCubic,
  easeInOutSine,
  easeOutCubic,
  linear,
  loop,
  makeProject,
  tween,
  useScene,
  waitFor,
} from '@revideo/core';

// Layout is specified in 1280x720 top-left coordinates (see PLAN.md);
// Revideo's origin is the centre of the frame.
const X = (x: number) => x - 640;
const Y = (y: number) => y - 360;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

const RING = {cx: X(380), cy: Y(410), r: 150, stroke: 26};
const BARS = {x: 700, w: 56, gap: 36, baseline: Y(580), maxH: 320};

const scene = makeScene2D('status-card', function* (view) {
  // Project variables are signals: changing them in the player updates the
  // computed props below without rebuilding the node tree.
  const vars = useScene().variables;
  const title = vars.get('title', 'System status');
  const value = vars.get('value', 78);
  const unit = vars.get('unit', '%');
  const accent = vars.get('accentColor', '#3D8BFF');
  const bars = vars.get('bars', [30, 55, 80, 45, 65]);

  const fill = createSignal(0);
  const barP = [0, 1, 2, 3, 4].map(() => createSignal(0));
  const arc = () => fill() * (clamp(Number(value()) || 0, 0, 100) / 100);
  const angle = () => -90 + 360 * arc();

  const num = createRef<Txt>();
  const content = createRef<Node>();
  const titleTxt = createRef<Txt>();
  const gauge = createRef<Node>();
  const dot = createRef<Circle>();

  view.fill('#0E1116');
  view.add(
    <>
      <Rect width={1120} height={560} radius={24} fill={'#171B22'} />
      <Node ref={content}>
        <Txt
            ref={titleTxt}
            // Plain strings, not reactive: a reactive Txt spawns new text nodes,
            // which fails during drawing (outside the scene context). A variables
            // change reloads the scene, so these are re-read anyway.
            text={String(title())}
            x={X(120)}
            y={Y(110)}
            offset={[-1, -1]}
            fontFamily={'sans-serif'}
            fontSize={52}
            fontWeight={600}
            lineHeight={52}
            fill={'#E6EAF2'}
            opacity={0}
          />
        <Node ref={gauge} opacity={0}>
          <Circle
            x={RING.cx}
            y={RING.cy}
            size={RING.r * 2}
            lineWidth={RING.stroke}
            stroke={'#2A2F3A'}
          />
          <Circle
            x={RING.cx}
            y={RING.cy}
            size={RING.r * 2}
            lineWidth={RING.stroke}
            stroke={() => String(accent())}
            lineCap={'round'}
            startAngle={-90}
            endAngle={angle}
            opacity={() => (arc() > 0 ? 1 : 0)}
          />
          <Circle
            ref={dot}
            x={() => RING.cx + RING.r * Math.cos((angle() * Math.PI) / 180)}
            y={() => RING.cy + RING.r * Math.sin((angle() * Math.PI) / 180)}
            size={18}
            fill={'#FFFFFF'}
            opacity={0}
          />
          <Layout layout direction={'row'} alignItems={'baseline'} x={RING.cx} y={RING.cy}>
            <Txt
              ref={num}
              text={'0'}
              fontFamily={'sans-serif'}
              fontSize={104}
              fontWeight={700}
              fill={'#FFFFFF'}
            />
            <Txt
              text={String(unit())}
              fontFamily={'sans-serif'}
              fontSize={44}
              fontWeight={600}
              fill={() => String(accent())}
            />
          </Layout>
          {barP.map((p, i) => {
            const cx = X(BARS.x + i * (BARS.w + BARS.gap) + BARS.w / 2);
            const target = () =>
              (clamp(Number(bars()[i]) || 0, 0, 100) / 100) * BARS.maxH;
            return (
              <Node>
                <Rect
                  x={cx}
                  y={BARS.baseline}
                  offset={[0, 1]}
                  width={BARS.w}
                  height={BARS.maxH}
                  radius={[8, 8, 0, 0]}
                  fill={'#232833'}
                />
                <Rect
                  x={cx}
                  y={BARS.baseline}
                  offset={[0, 1]}
                  width={BARS.w}
                  height={() => target() * p()}
                  radius={[8, 8, 0, 0]}
                  fill={() => String(accent())}
                />
              </Node>
            );
          })}
        </Node>
      </Node>
    </>,
  );

  titleTxt().y(Y(110) + 40);
  yield* all(
    // Intro
    delay(0.3, all(titleTxt().opacity(1, 0.8, easeOutCubic), titleTxt().y(Y(110), 0.8, easeOutCubic))),
    delay(0.6, gauge().opacity(1, 0.4, linear)),
    delay(
      0.8,
      tween(2.0, v => {
        fill(easeInOutCubic(v));
        num().text(String(Math.round((Number(value()) || 0) * fill())));
      }),
    ),
    ...barP.map((p, i) => delay(1.2 + i * 0.15, p(1, 0.9, easeOutCubic))),
    // Hold: end-dot pulse, 9 -> 13 -> 9 twice
    delay(
      2.8,
      all(
        dot().opacity(1, 0.2, linear),
        loop(2, () => chain(dot().size(26, 0.95, easeInOutSine), dot().size(18, 0.95, easeInOutSine))),
      ),
    ),
    // Outro
    delay(6.6, all(content().opacity(0, 1.0, easeInCubic), titleTxt().y(Y(110) - 20, 1.0, easeInCubic))),
    waitFor(8),
  );
});

export default makeProject({
  scenes: [scene],
  settings: {
    shared: {
      size: {x: 1280, y: 720},
    },
  },
});
