import { useTheme } from "@/context/theme-context";

const light = {
  blue: "#2563EB",
  blueL: "#EFF6FF",
  blueMed: "#DBEAFE",
  green: "#16A34A",
  greenL: "#F0FDF4",
  yellow: "#D97706",
  yellowL: "#FFFBEB",
  red: "#DC2626",
  redL: "#FEF2F2",
  bg: "#F9FAFB",
  surface: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  overlay: "rgba(0,0,0,.45)",
  segmentBg: "#F3F4F6",
  inputBg: "#FFFFFF",
  skeleton: "#E5E7EB",
};

const dark = {
  blue: "#3B82F6",
  blueL: "#1E3A5F",
  blueMed: "#1E40AF",
  green: "#22C55E",
  greenL: "#14532D",
  yellow: "#F59E0B",
  yellowL: "#78350F",
  red: "#EF4444",
  redL: "#7F1D1D",
  bg: "#0F172A",
  surface: "#1E293B",
  text: "#F1F5F9",
  muted: "#94A3B8",
  border: "#334155",
  overlay: "rgba(0,0,0,.65)",
  segmentBg: "#334155",
  inputBg: "#1E293B",
  skeleton: "#334155",
};

export type Colors = typeof light;

export function useColors(): Colors {
  const { isDark } = useTheme();
  return isDark ? dark : light;
}
