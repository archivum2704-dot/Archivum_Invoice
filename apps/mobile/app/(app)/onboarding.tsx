import { useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import {
  Sparkles, Upload, Building2, Users, Search, ArrowRight,
} from "lucide-react-native";

const { width: W } = Dimensions.get("window");

const C = {
  blue: "#2563EB", blueL: "#EFF6FF",
  green: "#16A34A", greenL: "#F0FDF4",
  yellow: "#D97706", yellowL: "#FFFBEB",
  purple: "#7C3AED", purpleL: "#F5F3FF",
  orange: "#EA580C", orangeL: "#FFF7ED",
  bg: "#F9FAFB", surface: "#FFFFFF",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
};

type SlideKey = "welcome" | "upload" | "companies" | "team" | "search";

interface SlideStyle {
  key: SlideKey;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const SLIDE_STYLES: SlideStyle[] = [
  { key: "welcome",   icon: <Sparkles  size={42} color={C.blue}   />, iconBg: C.blueL,   iconColor: C.blue   },
  { key: "upload",    icon: <Upload    size={42} color={C.green}  />, iconBg: C.greenL,  iconColor: C.green  },
  { key: "companies", icon: <Building2 size={42} color={C.purple} />, iconBg: C.purpleL, iconColor: C.purple },
  { key: "team",      icon: <Users     size={42} color={C.orange} />, iconBg: C.orangeL, iconColor: C.orange },
  { key: "search",    icon: <Search    size={42} color={C.yellow} />, iconBg: C.yellowL, iconColor: C.yellow },
];

const ONBOARDING_KEY = "@archivum/onboarding_completed";

export async function isOnboardingCompleted(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ONBOARDING_KEY);
    return v === "true";
  } catch {
    return false;
  }
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const total = SLIDE_STYLES.length;
  const isLast = page === total - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const newPage = Math.round(x / W);
    if (newPage !== page) setPage(newPage);
  };

  const goNext = () => {
    if (isLast) { complete(); return; }
    scrollRef.current?.scrollTo({ x: (page + 1) * W, animated: true });
  };

  const complete = async () => {
    try { await AsyncStorage.setItem(ONBOARDING_KEY, "true"); } catch {}
    router.replace("/(app)/dashboard");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Skip */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 8 }}>
        <TouchableOpacity onPress={complete} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 14, color: C.muted, fontWeight: "600" }}>{t("tutorial.skip")}</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDE_STYLES.map((slide, i) => (
          <View key={slide.key} style={{ width: W, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" }}>
            {/* Icon */}
            <View style={{
              width: 120, height: 120, borderRadius: 60, backgroundColor: slide.iconBg,
              alignItems: "center", justifyContent: "center", marginBottom: 32,
            }}>
              {slide.icon}
            </View>

            {/* Title */}
            <Text style={{ fontSize: 26, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 12, letterSpacing: -0.5 }}>
              {t(`tutorial.slides.${slide.key}.title`)}
            </Text>

            {/* Description */}
            <Text style={{ fontSize: 15, color: C.muted, textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
              {t(`tutorial.slides.${slide.key}.description`)}
            </Text>

            {/* Bullets */}
            <View style={{ gap: 12, alignSelf: "stretch" }}>
              {(["b1", "b2", "b3"] as const).map((b) => (
                <View key={b} style={{
                  flexDirection: "row", alignItems: "center", gap: 10,
                  backgroundColor: C.surface, borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: C.border,
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: slide.iconColor }} />
                  <Text style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: "500" }}>
                    {t(`tutorial.slides.${slide.key}.${b}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer: dots + button */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16, gap: 20 }}>
        {/* Dots */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {SLIDE_STYLES.map((_, i) => {
            const active = i === page;
            return (
              <View key={i} style={{
                width: active ? 22 : 7, height: 7, borderRadius: 4,
                backgroundColor: active ? SLIDE_STYLES[page].iconColor : C.border,
              }} />
            );
          })}
        </View>

        {/* Button */}
        <TouchableOpacity
          onPress={goNext}
          style={{
            backgroundColor: SLIDE_STYLES[page].iconColor,
            borderRadius: 14, paddingVertical: 16,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            {isLast ? t("tutorial.start") : t("tutorial.next")}
          </Text>
          <ArrowRight size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
