import { useColors } from "@/lib/colors";
import { useTheme } from "@/context/theme-context";

/**
 * Shadows tinted with the theme's own text color instead of pure black —
 * pure #000 shadows read as generic/flat. In dark mode surfaces already sit
 * on a dark background, so the tint collapses to plain black at low opacity.
 */
export function useShadows() {
  const C = useColors();
  const { isDark } = useTheme();
  const tint = isDark ? "#000000" : C.text;

  return {
    sm: {
      shadowColor: tint,
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    md: {
      shadowColor: tint,
      shadowOpacity: isDark ? 0.35 : 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    lg: {
      shadowColor: tint,
      shadowOpacity: isDark ? 0.4 : 0.1,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  } as const;
}
