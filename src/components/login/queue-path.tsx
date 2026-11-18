import * as React from "react";
import { AccessibilityInfo, Animated, Easing, useWindowDimensions } from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";

import { AUTH, AUTH_FONT } from "@/components/login/auth-palette";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Design canvas. Height follows width (same aspect) so nodes never crop; the path
 * runs past x=0 and x=360, so it still bleeds off both screen edges. */
const VB_W = 360;
const VB_H = 112;

/**
 * The queue, drawn as the web board's "snake": work enters bottom-left, runs
 * right, turns, and flows back along the top toward #1 — the top of the queue is
 * what's next. Same dashed line + moving dash as the web's `.snake-path-line`.
 */
const PATH = "M -10 90 H 300 A 34 34 0 0 0 300 22 H -10";

/** Dash pattern 8/6 (web: stroke-dasharray 8 6) → one period = 14. */
const DASH_PERIOD = 14;

const NODES = [
  { n: 1, x: 56, y: 22 },
  { n: 2, x: 140, y: 22 },
  { n: 3, x: 224, y: 22 },
  { n: 4, x: 232, y: 90 },
  { n: 5, x: 148, y: 90 },
  { n: 6, x: 64, y: 90 },
] as const;

const NODE_R = 11;

function useReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

/**
 * Decorative hero band for the sign-in screens. Built with RN's own Animated (not
 * Reanimated) like FadeIn — no worklets, can't break a build. SVG props can't use
 * the native driver, but it's one path + one circle, so the JS cost is trivial.
 * Respects the OS "reduce motion" setting (static path, no pulse).
 */
export function QueuePath() {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  // useState, not useRef().current — React Compiler rule (see FadeIn).
  const [flow] = React.useState(() => new Animated.Value(0));
  const [pulse] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    if (reduced) return;
    const flowLoop = Animated.loop(
      Animated.timing(flow, {
        toValue: 1,
        duration: 1200, // web: snake-path-move 1.2s linear infinite
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      ]),
    );
    flowLoop.start();
    pulseLoop.start();
    return () => {
      flowLoop.stop();
      pulseLoop.stop();
    };
  }, [flow, pulse, reduced]);

  // Negative offset moves dashes FORWARD along the path — toward #1.
  const dashOffset = flow.interpolate({ inputRange: [0, 1], outputRange: [0, -DASH_PERIOD * 2] });
  const haloR = pulse.interpolate({ inputRange: [0, 1], outputRange: [NODE_R + 3, NODE_R + 9] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <Svg
      width={width}
      height={Math.round((width * VB_H) / VB_W)}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AnimatedPath
        d={PATH}
        stroke={AUTH.heroLine}
        strokeWidth={1.6}
        strokeDasharray="8 6"
        strokeDashoffset={reduced ? 0 : dashOffset}
        strokeLinecap="round"
        fill="none"
      />

      {NODES.map(({ n, x, y }) => {
        const isNext = n === 1;
        return (
          <G key={n}>
            {isNext ? (
              <AnimatedCircle
                cx={x}
                cy={y}
                r={reduced ? NODE_R + 5 : haloR}
                fill={AUTH.nextGlow}
                opacity={reduced ? 0.5 : haloOpacity}
              />
            ) : null}
            <Circle
              cx={x}
              cy={y}
              r={NODE_R}
              fill={isNext ? AUTH.next : AUTH.heroBottom}
              stroke={isNext ? AUTH.next : AUTH.heroLine}
              strokeWidth={1.2}
            />
            {!isNext ? <Circle cx={x} cy={y} r={NODE_R} fill={AUTH.heroNode} /> : null}
            <SvgText
              x={x}
              y={y + 3.6}
              textAnchor="middle"
              fontSize={10}
              fontFamily={AUTH_FONT.bold}
              fill={isNext ? AUTH.heroBottom : AUTH.heroNodeText}
            >
              {n}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
