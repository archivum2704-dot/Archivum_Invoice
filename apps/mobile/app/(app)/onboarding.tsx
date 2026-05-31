import { useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Dimensions, TextInput,
  NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import {
  Upload, Building2, Users, Search, ArrowRight,
} from "lucide-react-native";
import { useColors } from "@/lib/colors";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";

const { width: W } = Dimensions.get("window");

type SlideKey = "welcome" | "upload" | "companies" | "team" | "search";

const ONBOARDING_KEY = "@archivum/onboarding_completed";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
  const C = useColors();
  const { refreshProfile } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [showOrgSetup, setShowOrgSetup] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  const purple = "#7C3AED";
  const purpleL = "#F5F3FF";
  const orange = "#EA580C";
  const orangeL = "#FFF7ED";

  const SLIDE_STYLES = [
    { key: "welcome" as SlideKey,   icon: <Logo size={60} />, iconBg: C.blueL,   iconColor: C.blue   },
    { key: "upload" as SlideKey,    icon: <Upload    size={42} color={C.green}  />, iconBg: C.greenL,  iconColor: C.green  },
    { key: "companies" as SlideKey, icon: <Building2 size={42} color={purple}   />, iconBg: purpleL,   iconColor: purple   },
    { key: "team" as SlideKey,      icon: <Users     size={42} color={orange}   />, iconBg: orangeL,   iconColor: orange   },
    { key: "search" as SlideKey,    icon: <Search    size={42} color={C.yellow} />, iconBg: C.yellowL, iconColor: C.yellow },
  ];

  const total = SLIDE_STYLES.length;
  const isLast = page === total - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const newPage = Math.round(x / W);
    if (newPage !== page) setPage(newPage);
  };

  const goNext = () => {
    if (isLast) { setShowOrgSetup(true); return; }
    scrollRef.current?.scrollTo({ x: (page + 1) * W, animated: true });
  };

  const handleSkip = () => setShowOrgSetup(true);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/(auth)/login"); return; }

    const { error } = await supabase.rpc("create_organization_with_owner", {
      org_name: orgName.trim(),
      org_slug: slugify(orgName),
      owner_id: user.id,
    });

    if (error) {
      setCreating(false);
      Alert.alert("Error", error.message);
      return;
    }

    await refreshProfile();
    try { await AsyncStorage.setItem(ONBOARDING_KEY, "true"); } catch {}
    router.replace("/(app)/dashboard");
  };

  // ── Org setup screen ──────────────────────────────────────────────────────
  if (showOrgSetup) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: "center" }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40, backgroundColor: C.blueL,
            alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 28,
          }}>
            <Building2 size={38} color={C.blue} />
          </View>

          <Text style={{ fontSize: 26, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 8, letterSpacing: -0.5 }}>
            {t("onboarding.orgSetup.title")}
          </Text>
          <Text style={{ fontSize: 15, color: C.muted, textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
            {t("onboarding.orgSetup.description")}
          </Text>

          <Text style={{ fontSize: 13, fontWeight: "600", color: C.text, marginBottom: 8 }}>
            {t("onboarding.orgSetup.nameLabel")}
          </Text>
          <TextInput
            value={orgName}
            onChangeText={setOrgName}
            placeholder={t("onboarding.orgSetup.namePlaceholder")}
            placeholderTextColor={C.muted}
            style={{
              borderWidth: 1.5, borderColor: orgName.trim() ? C.blue : C.border,
              borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
              fontSize: 16, color: C.text, backgroundColor: C.inputBg, marginBottom: 24,
            }}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreateOrg}
          />

          <TouchableOpacity
            onPress={handleCreateOrg}
            disabled={!orgName.trim() || creating}
            style={{
              backgroundColor: orgName.trim() ? C.blue : C.border,
              borderRadius: 14, paddingVertical: 16,
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {creating
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                    {t("onboarding.orgSetup.createButton")}
                  </Text>
                  <ArrowRight size={18} color="#fff" />
                </>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Tutorial slides ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Skip */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 8 }}>
        <TouchableOpacity onPress={handleSkip} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
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
