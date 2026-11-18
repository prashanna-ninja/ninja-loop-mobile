import Svg, { Circle, Path } from "react-native-svg";

/**
 * The Ninja Loop mark — a ninja face in a ring (headband + eyes), ported 1:1 from
 * the web's components/landing/ninja-logo-mark.tsx (viewBox 0 0 24 24).
 */
export function NinjaLoopMark({ size = 24, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="Ninja Loop">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.6} />
      <Path d="M3.5 11.6h17M3.5 12.6h17" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={9} cy={12} r={0.9} fill={color} />
      <Circle cx={15} cy={12} r={0.9} fill={color} />
    </Svg>
  );
}
