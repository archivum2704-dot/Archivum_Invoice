import { useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

interface Slide {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  bullets: string[];
}

const SLIDES: Slide[] = [
  {
    icon: <Sparkles size={42} color={C.blue} />,
    iconBg: C.blueL,
    iconColor: C.blue,
    title: "Bienvenido a Archivum",
    description: "Tu sistema inteligente para organizar todos los documentos de tu empresa.",
    bullets: [
      "Procesamiento automático con IA",
      "Acceso desde cualquier dispositivo",
      "Datos seguros y privados",
    ],
  },
  {
    icon: <Upload size={42} color={C.green} />,
    iconBg: C.greenL,
    iconColor: C.green,
    title: "Sube y procesa documentos",
    description: "Captura facturas, contratos y recibos. La IA extrae los datos automáticamente.",
    bullets: [
      "Soporta PDF, fotos y escaneos",
      "Extracción de importes, fechas, NIF/CIF",
      "Sin necesidad de transcribir nada",
    ],
  },
  {
    icon: <Building2 size={42} color={C.purple} />,
    iconBg: C.purpleL,
    iconColor: C.purple,
    title: "Organiza por empresa",
    description: "Crea una empresa por cada cliente o departamento y agrupa sus documentos.",
    bullets: [
      "Plan Gratis: 1 empresa",
      "Plan Pro: hasta 20 empresas",
      "Añade más por 2€/empresa/mes",
    ],
  },
  {
    icon: <Users size={42} color={C.orange} />,
    iconBg: C.orangeL,
    iconColor: C.orange,
    title: "Trabaja en equipo",
    description: "Invita a tu equipo con roles y permisos personalizados por empresa.",
    bullets: [
      "Roles: Administrador, Miembro, Visor",
      "Acceso granular por empresa o carpeta",
      "Plan Gratis: 1 usuario · Pro: 5 + extras",
    ],
  },
  {
    icon: <Search size={42} color={C.yellow} />,
    iconBg: C.yellowL,
    iconColor: C.yellow,
    title: "Encuentra todo al instante",
    description: "Búsqueda inteligente y filtros por empresa, fecha, tipo o importe.",
    bullets: [
      "Búsqueda por contenido del documento",
      "Filtros combinables",
      "Ordenado por relevancia",
    ],
  },
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
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const total = SLIDES.length;
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
          <Text style={{ fontSize: 14, color: C.muted, fontWeight: "600" }}>Saltar</Text>
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
        {SLIDES.map((slide, i) => (
          <View key={i} style={{ width: W, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" }}>
            {/* Icon */}
            <View style={{
              width: 120, height: 120, borderRadius: 60, backgroundColor: slide.iconBg,
              alignItems: "center", justifyContent: "center", marginBottom: 32,
            }}>
              {slide.icon}
            </View>

            {/* Title */}
            <Text style={{ fontSize: 26, fontWeight: "800", color: C.text, textAlign: "center", marginBottom: 12, letterSpacing: -0.5 }}>
              {slide.title}
            </Text>

            {/* Description */}
            <Text style={{ fontSize: 15, color: C.muted, textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
              {slide.description}
            </Text>

            {/* Bullets */}
            <View style={{ gap: 12, alignSelf: "stretch" }}>
              {slide.bullets.map((b, idx) => (
                <View key={idx} style={{
                  flexDirection: "row", alignItems: "center", gap: 10,
                  backgroundColor: C.surface, borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: C.border,
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: slide.iconColor }} />
                  <Text style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: "500" }}>{b}</Text>
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
          {SLIDES.map((_, i) => {
            const active = i === page;
            return (
              <View key={i} style={{
                width: active ? 22 : 7, height: 7, borderRadius: 4,
                backgroundColor: active ? SLIDES[page].iconColor : C.border,
              }} />
            );
          })}
        </View>

        {/* Button */}
        <TouchableOpacity
          onPress={goNext}
          style={{
            backgroundColor: SLIDES[page].iconColor,
            borderRadius: 14, paddingVertical: 16,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            {isLast ? "Empezar" : "Siguiente"}
          </Text>
          <ArrowRight size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
