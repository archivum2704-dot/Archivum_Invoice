import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Bell, AlertTriangle, FileText, ChevronRight, Plus, Package,
} from "lucide-react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/colors";
import { useTranslation } from "react-i18next";

/* ── Bar chart (SVG, no external lib needed) ─────────────────────────────── */
function BarChart({ data, C }: { data: { month: string; count: number }[]; C: any }) {
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

/* ── Doc row ─────────────────────────────────────────────────────────────── */
function DocRow({ doc, C, t }: { doc: any; C: any; t: any }) {
  const STATUS: Record<string, { label: string; bg: string; color: string }> = {
    paid:      { label: t("status.paid"),      bg: C.greenL, color: C.green },
    pending:   { label: t("status.pending"),   bg: C.yellowL, color: C.yellow },
    overdue:   { label: t("status.overdue"),   bg: C.redL, color: C.red },
    draft:     { label: t("status.draft"),     bg: C.segmentBg, color: C.muted },
    cancelled: { label: t("status.cancelled"), bg: C.segmentBg, color: C.muted },
  };
  const sm = STATUS[doc.status] ?? STATUS.draft;
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(app)/documento/${doc.id}`)}
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        padding: 12, borderBottomWidth: 1, borderBottomColor: C.border,
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 8,
        backgroundColor: C.blueL, alignItems: "center", justifyContent: "center",
      }}>
        <FileText size={16} color={C.blue} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: C.text, fontFamily: "monospace" }} numberOfLines={1}>
            {doc.document_number}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: C.text }}>
            {doc.total != null ? `€${Number(doc.total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}` : "—"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>
            {doc.companies?.name ?? t("common.noCompany")}
          </Text>
          <View style={{ backgroundColor: sm.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: sm.color }}>{sm.label}</Text>
          </View>
        </View>
      </View>
      <ChevronRight size={16} color={C.muted} />
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
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
          <View>
            <Text style={{ fontSize: 13, color: C.muted }}>{getGreeting()}</Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.text }}>
              {firstName} 👋
            </Text>
          </View>
          <View>
            <Bell size={24} color={C.muted} />
            {kpi.overdueN > 0 && (
              <View style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, backgroundColor: C.red, borderRadius: 4 }} />
            )}
          </View>
        </View>

        {/* Overdue alert */}
        {kpi.overdueN > 0 && (
          <View style={{
            marginHorizontal: 16, marginTop: 14,
            backgroundColor: C.redL, borderWidth: 1, borderColor: "rgba(220,38,38,.2)",
            borderRadius: 10, padding: 12, flexDirection: "row", gap: 10, alignItems: "center",
          }}>
            <AlertTriangle size={18} color={C.red} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: C.red }}>
                {t("dashboard.overdueAlert", { count: kpi.overdueN })}
              </Text>
              <Text style={{ fontSize: 12, color: C.red, marginTop: 1, opacity: 0.8 }}>
                €{kpi.overdue.toLocaleString("es-ES", { minimumFractionDigits: 2 })} {t("dashboard.uncollected")}
              </Text>
            </View>
            <Text style={{ fontSize: 12, fontWeight: "600", color: C.red }}>{t("dashboard.view")} →</Text>
          </View>
        )}

        {/* KPI cards */}
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 14 }}>
          {[
            { label: t("dashboard.paid"),    amount: kpi.paid,    count: kpi.paidN,    color: C.green,  borderColor: C.green },
            { label: t("dashboard.pending"), amount: kpi.pending, count: kpi.pendingN, color: C.yellow, borderColor: C.yellow },
            { label: t("dashboard.overdue"), amount: kpi.overdue, count: kpi.overdueN, color: C.red,    borderColor: C.red },
          ].map((k) => (
            <View
              key={k.label}
              style={{
                flex: 1, backgroundColor: C.surface, borderRadius: 12,
                padding: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 }, elevation: 2,
                borderTopWidth: 3, borderTopColor: k.borderColor,
              }}
            >
              <Text style={{ fontSize: 11, color: C.muted, fontWeight: "500", marginBottom: 4 }}>{k.label}</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: k.color }} numberOfLines={1}>
                €{k.amount.toLocaleString("es-ES", { minimumFractionDigits: 0 })}
              </Text>
              <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{k.count} {t("common.docs")}</Text>
            </View>
          ))}
        </View>

        {/* Quick access — paid features */}
        {paidFeatures && (
          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            <TouchableOpacity
              onPress={() => router.push("/(app)/inventario")}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
                <Package size={18} color={C.blue} />
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: C.text }}>{t("inventory.title")}</Text>
              <ChevronRight size={18} color={C.muted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Chart */}
        <View style={{
          marginHorizontal: 16, marginTop: 14,
          backgroundColor: C.surface, borderRadius: 14, padding: 14,
          shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{t("dashboard.monthlyActivity")}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{t("dashboard.docsArchived")}</Text>
            </View>
          </View>
          <BarChart data={chartData} C={C} />
        </View>

        {/* Recent docs */}
        <View style={{ marginTop: 14, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{t("dashboard.recentDocs")}</Text>
            <TouchableOpacity onPress={() => router.push("/(app)/biblioteca")}>
              <Text style={{ fontSize: 13, color: C.blue, fontWeight: "500" }}>{t("dashboard.viewAll")}</Text>
            </TouchableOpacity>
          </View>
          <View style={{
            backgroundColor: C.surface, borderRadius: 14, marginHorizontal: 16,
            overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
          }}>
            {docs.length === 0 ? (
              <View style={{ padding: 32, alignItems: "center", gap: 8 }}>
                <FileText size={36} color={C.muted} />
                <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>{t("dashboard.noDocs")}</Text>
                <Text style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
                  {t("dashboard.uploadFirst")}
                </Text>
              </View>
            ) : (
              docs.map((doc) => <DocRow key={doc.id} doc={doc} C={C} t={t} />)
            )}
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push("/(app)/subir")}
        style={{
          position: "absolute", bottom: 20, right: 20,
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: C.blue, alignItems: "center", justifyContent: "center",
          shadowColor: C.blue, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
        }}
      >
        <Plus size={22} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
