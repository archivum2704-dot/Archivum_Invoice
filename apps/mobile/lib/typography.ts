export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
  mono: "monospace",
};

export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  mono: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 19 },
} as const;
