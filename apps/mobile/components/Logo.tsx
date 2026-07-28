import Svg, { Path, Defs, LinearGradient, Stop, Rect, G, ClipPath } from "react-native-svg";

interface LogoProps {
  size?: number;
  /** Optional rounded background color. Omit for a transparent mark. */
  bg?: string;
}

/**
 * Archivum brand mark — gradient "A" monogram with cyan swoosh.
 * Matches apps/web/public/logo.svg (viewBox 0 0 256 256).
 */
export function Logo({ size = 72, bg }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill="none">
      <Defs>
        <LinearGradient id="arch-a" x1="30" y1="226" x2="150" y2="34" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#2C8CE6" />
          <Stop offset="1" stopColor="#5BADF4" />
        </LinearGradient>
        <LinearGradient id="arch-right" x1="140" y1="52" x2="214" y2="226" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#3F63D8" />
          <Stop offset="1" stopColor="#44269E" />
        </LinearGradient>
        <LinearGradient id="arch-swoosh" x1="206" y1="130" x2="70" y2="196" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#7FEFF5" />
          <Stop offset="0.5" stopColor="#2FD0E4" />
          <Stop offset="1" stopColor="#12AECB" />
        </LinearGradient>
        <ClipPath id="round">
          <Rect x="0" y="0" width="256" height="256" rx="56" />
        </ClipPath>
      </Defs>
      <G clipPath={bg ? "url(#round)" : undefined}>
        {bg ? <Rect x="0" y="0" width="256" height="256" rx="56" fill={bg} /> : null}
        {/* A silhouette (open-bottom counter, no crossbar) */}
        <Path d="M150 28 L230 228 L172 228 L146 116 L88 228 L26 228 Z" fill="url(#arch-a)" />
        {/* Right leg as a distinct violet plane for depth */}
        <Path d="M150 28 L230 228 L172 228 L146 116 Z" fill="url(#arch-right)" />
        {/* Soft highlight streak on the left face */}
        <Path d="M150 42 L70 228 L96 228 Z" fill="#ffffff" opacity={0.1} />
        {/* Cyan swoosh crossing the counter, tip protruding right */}
        <Path d="M64 184 C120 176 166 168 208 132 C188 170 130 198 92 199 C78 200 66 194 64 184 Z" fill="url(#arch-swoosh)" />
        {/* Swoosh top highlight */}
        <Path d="M64 184 C120 174 165 166 208 132 C180 152 132 172 96 178 C84 180 70 184 64 184 Z" fill="#B5F5F9" opacity={0.55} />
      </G>
    </Svg>
  );
}
