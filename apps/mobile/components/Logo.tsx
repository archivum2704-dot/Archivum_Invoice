import Svg, { Rect, Path, Defs, ClipPath, G } from "react-native-svg";

interface LogoProps {
  size?: number;
  /** Background color of the rounded rectangle. Defaults to "#000" */
  bg?: string;
  /** Foreground (paths) color. Defaults to "#fff" */
  fg?: string;
}

/**
 * Archivum brand mark — Mountain icon.
 * Matches the web logo.svg exactly (mountain/pyramid shape only, no text).
 *
 * The paths come from logo.svg which uses a flipped coordinate system
 * (translate(0,500) scale(0.1,-0.1)). We apply the same transform here
 * and use a cropped viewBox to center the mountain icon.
 */
export function Logo({ size = 72, bg = "#000", fg = "#fff" }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="90 110 320 250" fill="none">
      <Defs>
        <ClipPath id="clip">
          <Rect x={90} y={110} width={320} height={250} fill="white" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#clip)">
        <Rect x={90} y={110} width={320} height={250} rx={50} fill={bg} />
        {/* Mountain paths from logo.svg with original transform */}
        <G transform="translate(0,500) scale(0.1,-0.1)" fill={fg}>
          {/* Main mountain peak */}
          <Path d="M2642 3470 c-189 -195 -307 -299 -316 -277 -3 9 -5 9 -5 -1 -1 -8 -9 -10 -26 -6 -26 6 -59 -11 -49 -27 3 -5 -2 -6 -11 -3 -8 4 -28 2 -43 -4 -59 -22 -178 -51 -201 -49 -21 2 -33 -10 -72 -75 -26 -42 -64 -107 -84 -145 -21 -37 -66 -117 -100 -178 -34 -60 -74 -134 -89 -162 l-26 -53 94 74 c191 149 419 254 688 315 l93 22 64 113 c102 181 87 178 155 32 65 -140 47 -126 191 -141 64 -7 220 -42 245 -55 11 -6 7 -10 -15 -15 -139 -32 -289 -82 -282 -94 2 -5 33 -69 155 -321 36 -74 85 -129 147 -166 76 -44 128 -54 298 -54 86 0 157 3 157 6 0 6 -30 64 -205 389 -56 105 -141 264 -188 355 -205 394 -373 704 -382 707 -5 1 -92 -83 -193 -187z m-642 -376 c0 -8 -19 -13 -24 -6 -3 5 1 9 9 9 8 0 15 -2 15 -3z" />
          {/* Mountain base */}
          <Path d="M2567 2613 c6 -15 -6 -17 -26 -4 -9 6 -23 4 -40 -7 -14 -10 -22 -12 -18 -4 5 6 4 12 -1 12 -8 0 -116 -38 -162 -57 -8 -3 -28 -8 -45 -10 -16 -3 -37 -9 -46 -14 -10 -5 -29 -9 -43 -9 -14 0 -28 -4 -31 -10 -3 -5 -13 -10 -22 -10 -9 0 -24 -6 -32 -13 -9 -8 -56 -26 -105 -42 -49 -16 -96 -37 -105 -47 -8 -10 -23 -18 -33 -18 -10 0 -18 -7 -18 -15 0 -8 -6 -15 -13 -15 -8 0 -22 -9 -32 -20 -9 -10 -20 -19 -24 -18 -11 3 -61 -25 -61 -34 0 -4 -7 -8 -15 -8 -8 0 -15 -6 -15 -13 0 -8 -19 -20 -42 -27 l-43 -14 40 -7 c22 -4 121 -8 221 -8 157 -1 189 2 244 20 82 27 137 65 230 160 41 42 100 99 130 125 30 26 54 52 53 56 -2 4 0 7 5 6 10 -3 59 31 65 46 3 7 -1 13 -8 13 -7 0 -11 -6 -8 -14z" />
          {/* Dot */}
          <Path d="M2525 1916 c-23 -34 -5 -66 36 -66 41 0 61 40 34 70 -24 27 -51 25 -70 -4z" />
        </G>
      </G>
    </Svg>
  );
}
