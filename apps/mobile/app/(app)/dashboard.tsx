import { useEffect, useState, useCallback, ReactNode } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Bell, AlertTriangle, FileText, ChevronRight, Package, Receipt, ClipboardList, Truck,
} from "lucide-react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useColors, type Colors } from "@/lib/colors";
import { useTranslation } from "react-i18next";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { Card, EmptyState } from "@/components/ui";
import { DocRow } from "@/components/DocRow";
import { UploadFab } from "@/components/UploadFab";

/* ── Bar chart (SVG, no external lib needed) ─────────────────────────────── */
function BarChart({ data, C }: { data: { month: string; count: number }[]; C: Colors }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 320; const H = 100; const BAR_W = 28; const GAP = (W - data.length * BAR_W) / (data.length + 1);

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={W} height={H + 20}>
        {data.map((d, i) => {
          const barH = Math.round((d.count / max) * H);
          const x = GAP + i * (BAR_W + GAP);
          const y = H - barH;
          const isLast = i === data.length - 1;
          return (
            <Svg key={i}>
              <Rect
                x={x} y={y} width={BAR_W} height={barH} rx={4}
                fill={isLast ? C.blue : C.blueMed}
              />
              <SvgText x={x + BAR_W / 2} y={H + 14} fontSize={10} fill={C.muted} textAnchor="middle">
                {d.month}
              </SvgText>
              {d.count > 0 && (
                <SvgText x={x + BAR_W / 2} y={y - 4} fontSize={10} fill={C.muted} textAnchor="middle">
                  {d.count}
                </SvgText>
              )}
            </Svg>
          );
        })}
      </Svg>
    </View>
  );
}

/* ── Quick access row ────────────────────────────────────────────────────── */
function QuickAccessRow({ icon, label, onPress, C }: { icon: ReactNode; label: string; onPress: () => void; C: Colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing.md,
        backgroundColor: C.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: C.border,
        padding: spacing.md + 2,
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: radius.md - 2, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: C.text }}>{label}</Text>
      <ChevronRight size={18} color={C.muted} strokeWidth={1.75} />
    </TouchableOpacity>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
export default function DashboardScreen() {
  const { profile, orgId, isPaid, isPlatformAdmin } = useAuth();
  const paidFeatures = isPaid || isPlatformAdmin;
  const C = useColors();
  const { t } = useTranslation();
  const [docs,       setDocs]       = useState<any[]>([]);
  const [chartData,  setChartData]  = useState<{ month: string; count: number }[]>([]);
  const [kpi,        setKpi]        = useState({ paid: 0, paidN: 0, pending: 0, pendingN: 0, overdue: 0, overdueN: 0 });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }

    const { data: allDocs } = await supabase
      .from("documents")
      .select("id, document_number, status, total, issue_date, companies(name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    const docs = allDocs ?? [];

    // KPIs
    const paidDocs    = docs.filter((d) => d.status === "paid");
    const pendingDocs = docs.filter((d) => d.status === "pending");
    const overdueDocs = docs.filter((d) => d.status === "overdue");
    const sum = (arr: any[]) => arr.reduce((s, d) => s + (Number(d.total) || 0), 0);

    setKpi({
      paid:     sum(paidDocs),    paidN:    paidDocs.length,
      pending:  sum(pendingDocs), pendingN: pendingDocs.length,
      overdue:  sum(overdueDocs), overdueN: overdueDocs.length,
    });

    // Recent docs
    setDocs(docs.slice(0, 5));

    // Monthly chart (last 6 months)
    const now = new Date();
    const months: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("es-ES", { month: "short" });
      const count = docs.filter((doc) => {
        if (!doc.issue_date) return false;
        const parts = doc.issue_date.split("-");
        return parseInt(parts[0]) === d.getFullYear() && parseInt(parts[1]) - 1 === d.getMonth();
      }).length;
      months.push({ month: label, count });
    }
    setChartData(months);
    setLoading(false);
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const firstName = profile?.first_name ?? "Usuario";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.greeting.morning");
    if (hour < 19) return t("dashboard.greeting.afternoon");
    return t("dashboard.greeting.evening");
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl - 4, paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
          <View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted }}>{getGreeting()}</Text>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text }}>
              {firstName} 👋
            </Text>
          </View>
          <View>
            <Bell size={24} color={C.muted} strokeWidth={1.75} />
            {kpi.overdueN > 0 && (
              <View style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, backgroundColor: C.red, borderRadius: 4 }} />
            )}
          </View>
        </View>

        {/* Overdue alert */}
        {kpi.overdueN > 0 && (
          <View style={{
            marginHorizontal: spacing.lg, marginTop: spacing.md + 2,
            backgroundColor: C.redL, borderWidth: 1, borderColor: "rgba(220,38,38,.2)",
            borderRadius: radius.md, padding: spacing.md, flexDirection: "row", gap: spacing.sm + 2, alignItems: "center",
          }}>
            <AlertTriangle size={18} color={C.red} strokeWidth={1.75} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.red }}>
                {t("dashboard.overdueAlert", { count: kpi.overdueN })}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.red, marginTop: 1, opacity: 0.8 }}>
                €{kpi.overdue.toLocaleString("es-ES", { minimumFractionDigits: 2 })} {t("dashboard.uncollected")}
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.red }}>{t("dashboard.view")} →</Text>
          </View>
        )}

        {/* KPI cards */}
        <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md + 2 }}>
          {[
            { label: t("dashboard.paid"),    amount: kpi.paid,    count: kpi.paidN,    color: C.green,  borderColor: C.green },
            { label: t("dashboard.pending"), amount: kpi.pending, count: kpi.pendingN, color: C.yellow, borderColor: C.yellow },
            { label: t("dashboard.overdue"), amount: kpi.overdue, count: kpi.overdueN, color: C.red,    borderColor: C.red },
          ].map((k) => (
            <Card
              key={k.label}
              containerStyle={{ flex: 1 }}
              style={{ borderTopWidth: 3, borderTopColor: k.borderColor, padding: spacing.md }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: C.muted, marginBottom: 4 }}>{k.label}</Text>
              <Text style={{ fontFamily: fonts.extrabold, fontSize: 15, color: k.color }} numberOfLines={1}>
                €{k.amount.toLocaleString("es-ES", { minimumFractionDigits: 0 })}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, marginTop: 2 }}>{k.count} {t("common.docs")}</Text>
            </Card>
          ))}
        </View>

        {/* Quick access — paid features */}
        {paidFeatures && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md + 2, gap: spacing.sm + 2 }}>
            <QuickAccessRow icon={<Package size={18} color={C.blue} strokeWidth={1.75} />} label={t("inventory.title")} onPress={() => router.push("/(app)/inventario")} C={C} />
            <QuickAccessRow icon={<Receipt size={18} color={C.blue} strokeWidth={1.75} />} label={t("invoicing.title")} onPress={() => router.push("/(app)/facturacion")} C={C} />
            <QuickAccessRow icon={<ClipboardList size={18} color={C.blue} strokeWidth={1.75} />} label={t("quoting.title")} onPress={() => router.push("/(app)/presupuestos")} C={C} />
            <QuickAccessRow icon={<Truck size={18} color={C.blue} strokeWidth={1.75} />} label={t("delivery.title")} onPress={() => router.push("/(app)/albaranes")} C={C} />
          </View>
        )}

        {/* Chart */}
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.md + 2 }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
              <View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: C.text }}>{t("dashboard.monthlyActivity")}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>{t("dashboard.docsArchived")}</Text>
              </View>
            </View>
            <BarChart data={chartData} C={C} />
          </Card>
        </View>

        {/* Recent docs */}
        <View style={{ marginTop: spacing.md + 2, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.sm + 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: C.text }}>{t("dashboard.recentDocs")}</Text>
            <TouchableOpacity onPress={() => router.push("/(app)/biblioteca")}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.blue }}>{t("dashboard.viewAll")}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginHorizontal: spacing.lg }}>
            <Card padded={false}>
              {docs.length === 0 ? (
                <EmptyState
                  icon={<FileText size={28} color={C.muted} strokeWidth={1.5} />}
                  title={t("dashboard.noDocs")}
                  subtitle={t("dashboard.uploadFirst")}
                />
              ) : (
                docs.map((doc) => <DocRow key={doc.id} doc={doc} />)
              )}
            </Card>
          </View>
        </View>
      </ScrollView>

      <UploadFab />
    </SafeAreaView>
  );
}
