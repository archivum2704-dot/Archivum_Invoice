import { useEffect, useState, useRef, ReactNode } from "react";
import {
  View, Text, TouchableOpacity, Modal, Animated, Easing,
  StyleSheet, Dimensions,
} from "react-native";
import { X, ArrowRight } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { Card } from "@/components/ui";

const COACHMARK_PREFIX = "@archivum/coachmark_";
const { width: SW, height: SH } = Dimensions.get("window");

export async function isCoachmarkSeen(id: string): Promise<boolean> {
  try { return (await AsyncStorage.getItem(COACHMARK_PREFIX + id)) === "true"; }
  catch { return true; }
}

export async function markCoachmarkSeen(id: string): Promise<void> {
  try { await AsyncStorage.setItem(COACHMARK_PREFIX + id, "true"); } catch {}
}

export async function resetCoachmark(id: string): Promise<void> {
  try { await AsyncStorage.removeItem(COACHMARK_PREFIX + id); } catch {}
}

export async function resetAllCoachmarks(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(k => k.startsWith(COACHMARK_PREFIX));
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  } catch {}
}

interface CoachmarkProps {
  /** Unique id used to persist dismissal */
  id: string;
  /** Whether the coachmark should be considered for display (e.g. only when list empty) */
  active: boolean;
  /** Title shown in the bubble */
  title: string;
  /** Description text */
  description: string;
  /** Where the bubble should sit on the screen. Defaults to center. */
  position?: "top" | "center" | "bottom";
  /** Force show (for manual replay) */
  force?: boolean;
  /** Optional icon node shown above the title */
  icon?: ReactNode;
  /** Called after dismissal */
  onDismiss?: () => void;
}

/**
 * Coachmark — full-screen overlay with a hint bubble for first-time users.
 *
 * Mobile note: Pointing precisely at a target requires `measure()` calls and
 * scroll tracking that get messy fast in RN. We instead show a clean centered
 * bubble explaining the action — the same UX pattern Linear/Notion use on
 * mobile. Pair this with the on-screen action button so the user immediately
 * sees both.
 */
export function Coachmark({
  id, active, title, description, position = "center",
  force = false, icon, onDismiss,
}: CoachmarkProps) {
  const { t } = useTranslation();
  const C = useColors();
  const [visible, setVisible] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      const seen = await isCoachmarkSeen(id);
      if (cancelled) return;
      if (force || !seen) {
        // small delay so the screen has rendered
        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 500);
      }
    })();
    return () => { cancelled = true; };
  }, [id, active, force]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleDismiss = async () => {
    await markCoachmarkSeen(id);
    Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      setVisible(false);
      onDismiss?.();
    });
  };

  if (!visible) return null;

  // Vertical alignment based on `position`
  const justify = position === "top" ? "flex-start" : position === "bottom" ? "flex-end" : "center";
  const paddingTop = position === "top" ? 100 : 0;
  const paddingBottom = position === "bottom" ? 120 : 0;

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleDismiss} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.overlay, opacity: fade, justifyContent: justify, paddingTop, paddingBottom, paddingHorizontal: spacing.xl }]}>
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFillObject} onPress={handleDismiss} />
        <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
          <Card style={{ padding: spacing.xl, paddingTop: spacing.lg + 4 }}>
            {/* Close */}
            <TouchableOpacity
              onPress={handleDismiss}
              style={{ position: "absolute", top: 10, right: 10, padding: spacing.xs + 2, zIndex: 1 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={16} color={C.muted} strokeWidth={1.75} />
            </TouchableOpacity>

            {/* Icon */}
            {icon && (
              <View style={{ alignItems: "center", marginBottom: spacing.md + 2 }}>
                {icon}
              </View>
            )}

            {/* Tag */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.blue }} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, color: C.blue }}>{t("coachmarks.tipLabel")}</Text>
            </View>

            {/* Title */}
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 17, color: C.text, marginBottom: spacing.xs + 2, letterSpacing: -0.3 }}>
              {title}
            </Text>

            {/* Description */}
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: spacing.lg + 2 }}>
              {description}
            </Text>

            {/* CTA */}
            <TouchableOpacity
              onPress={handleDismiss}
              style={{
                backgroundColor: C.blue, borderRadius: radius.pill, paddingVertical: spacing.md + 3,
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
              }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: "#fff" }}>{t("common.gotIt")}</Text>
              <ArrowRight size={14} color="#fff" strokeWidth={1.75} />
            </TouchableOpacity>
          </Card>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
