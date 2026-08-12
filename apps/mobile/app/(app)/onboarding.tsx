import { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent, Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import {
  Upload, Building2, Users, Search, ArrowRight,
} from "lucide-react-native";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { Button, Card, Input } from "@/components/ui";
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
  const { refreshProfile, orgId } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [showOrgSetup, setShowOrgSetup] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  // If the user already finished the tutorial but still has no organization,
  // skip the slides and go straight to org setup so they aren't stuck.
  useEffect(() => {
    (async () => {
      const completed = await isOnboardingCompleted();
      if (completed && !orgId) setShowOrgSetup(true);
    })();
  }, [orgId]);

  // Orphan orange/violet accent pair removed — remapped onto the theme's 4
  // existing accents. "companies" reads as a cool, corporate hue (closest to
  // the old violet) so it takes the brand blue; "team" takes the last free
  // accent, red, the closest remaining match for the old warm orange.
  const SLIDE_STYLES = [
    { key: "welcome" as SlideKey,   icon: <Logo size={60} />, iconBg: C.blueL,   iconColor: C.blue   },
    { key: "upload" as SlideKey,    icon: <Upload    size={42} color={C.green} strokeWidth={1.75} />, iconBg: C.greenL,  iconColor: C.green  },
    { key: "companies" as SlideKey, icon: <Building2 size={42} color={C.blue}  strokeWidth={1.75} />, iconBg: C.blueL,   iconColor: C.blue   },
    { key: "team" as SlideKey,      icon: <Users     size={42} color={C.red}   strokeWidth={1.75} />, iconBg: C.redL,    iconColor: C.red    },
    { key: "search" as SlideKey,    icon: <Search    size={42} color={C.yellow} strokeWidth={1.75} />, iconBg: C.yellowL, iconColor: C.yellow },
  ];

  const total = SLIDE_STYLES.length;
  const isLast = page === total - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const newPage = Math.round(x / W);
    if (newPage !== page) setPage(newPage);
  };

  // Finishing (or skipping) the tutorial only leads to org creation when the
  // user has no organization yet; existing users go straight to the dashboard.
  const finishTutorial = async () => {
    try { await AsyncStorage.setItem(ONBOARDING_KEY, "true"); } catch {}
    if (orgId) { router.replace("/(app)/dashboard"); return; }
    setShowOrgSetup(true);
  };

  const goNext = () => {
    if (isLast) { finishTutorial(); return; }
    scrollRef.current?.scrollTo({ x: (page + 1) * W, animated: true });
  };

  const handleSkip = () => finishTutorial();

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
        {/* The field autofocuses, so the keyboard is up before the user reads
            anything: without this the "create" button below it sat underneath
            the keyboard, and tapping it only dismissed the keyboard. */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
        >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl + 4, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{
            width: 80, height: 80, borderRadius: 40, backgroundColor: C.blueL,
            alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: spacing.xl + 4,
          }}>
            <Building2 size={38} color={C.blue} strokeWidth={1.75} />
          </View>

          <Text style={{ fontFamily: fonts.extrabold, fontSize: 26, color: C.text, textAlign: "center", marginBottom: spacing.sm, letterSpacing: -0.5 }}>
            {t("onboarding.orgSetup.title")}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: C.muted, textAlign: "center", lineHeight: 22, marginBottom: spacing.xxl }}>
            {t("onboarding.orgSetup.description")}
          </Text>

          <Input
            label={t("onboarding.orgSetup.nameLabel")}
            value={orgName}
            onChangeText={setOrgName}
            placeholder={t("onboarding.orgSetup.namePlaceholder")}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreateOrg}
            style={{ marginBottom: spacing.xl }}
          />

          <Button
            label={t("onboarding.orgSetup.createButton")}
            onPress={handleCreateOrg}
            disabled={!orgName.trim()}
            loading={creating}
            icon={<ArrowRight size={18} color="#fff" strokeWidth={1.75} />}
          />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Tutorial slides ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Skip */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <TouchableOpacity onPress={handleSkip} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: C.muted }}>{t("tutorial.skip")}</Text>
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
          <View key={slide.key} style={{ width: W, paddingHorizontal: spacing.xl + 4, alignItems: "center", justifyContent: "center" }}>
            {/* Icon */}
            <View style={{
              width: 120, height: 120, borderRadius: 60, backgroundColor: slide.iconBg,
              alignItems: "center", justifyContent: "center", marginBottom: spacing.xxl,
            }}>
              {slide.icon}
            </View>

            {/* Title */}
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 26, color: C.text, textAlign: "center", marginBottom: spacing.md, letterSpacing: -0.5 }}>
              {t(`tutorial.slides.${slide.key}.title`)}
            </Text>

            {/* Description */}
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: C.muted, textAlign: "center", lineHeight: 22, marginBottom: spacing.xl + 4 }}>
              {t(`tutorial.slides.${slide.key}.description`)}
            </Text>

            {/* Bullets */}
            <View style={{ gap: spacing.md, alignSelf: "stretch" }}>
              {(["b1", "b2", "b3"] as const).map((b) => (
                <Card key={b} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: slide.iconColor }} />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: C.text }}>
                    {t(`tutorial.slides.${slide.key}.${b}`)}
                  </Text>
                </Card>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Footer: dots + button */}
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.lg, gap: spacing.xl - 4 }}>
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
        <Button
          label={isLast ? t("tutorial.start") : t("tutorial.next")}
          onPress={goNext}
          icon={<ArrowRight size={18} color="#fff" strokeWidth={1.75} />}
          style={{ backgroundColor: SLIDE_STYLES[page].iconColor }}
        />
      </View>
    </SafeAreaView>
  );
}
