import { Image, View } from "react-native";

interface LogoProps {
  size?: number;
  /** Optional rounded background color behind the mark. */
  bg?: string;
}

/**
 * Archivum brand mark — the official gradient "A" monogram.
 * Uses the exact asset shared by the brand (assets/images/logo-mark.png),
 * matching apps/web/public/logo-mark.png.
 */
export function Logo({ size = 72, bg }: LogoProps) {
  const img = (
    <Image
      source={require("../assets/images/logo-mark.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
  if (!bg) return img;
  return (
    <View
      style={{
        width: size * 1.4,
        height: size * 1.4,
        borderRadius: size * 0.3,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {img}
    </View>
  );
}
