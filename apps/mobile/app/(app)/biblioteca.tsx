import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, ScrollView,
} from "react-native";
import Sheet from "@/components/Sheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Search, SlidersHorizontal, FileText, ChevronRight,
  BookOpen, X, Plus,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Coachmark } from "@/components/Coachmark";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";

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
      <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
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
            {doc.companies?.name ?? t("common.noCompany")} · {t(`docTypesPlural.${doc.document_type}`, { defaultValue: doc.document_type })}
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

export default function BibliotecaScreen() {
  const { t } = useTranslation();
  const C = useColors();
  const { orgId } = useAuth();
  const [docs,        setDocs]        = useState<any[]>([]);
  const [filtered,    setFiltered]    = useState<any[]>([]);
  const [query,       setQuery]       = useState("");
  const [activeType,  setActiveType]  = useState("all");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const DOC_TYPES: Record<string, string> = {
    all:              t("docTypesPlural.all"),
    invoice_issued:   t("docTypesPlural.invoice_issued"),
    invoice_received: t("docTypesPlural.invoice_received"),
    delivery_note:    t("docTypesPlural.delivery_note"),
    order:            t("docTypesPlural.order"),
    receipt:          t("docTypesPlural.receipt"),
    payroll:          t("docTypesPlural.payroll"),
    contract:         t("docTypesPlural.contract"),
    quote:            t("docTypesPlural.quote"),
    other:            t("docTypesPlural.other"),
  };

  const STATUS: Record<string, { label: string; bg: string; color: string }> = {
    paid:      { label: t("status.paid"),      bg: C.greenL, color: C.green },
    pending:   { label: t("status.pending"),   bg: C.yellowL, color: C.yellow },
    overdue:   { label: t("status.overdue"),   bg: C.redL, color: C.red },
    draft:     { label: t("status.draft"),     bg: C.segmentBg, color: C.muted },
    cancelled: { label: t("status.cancelled"), bg: C.segmentBg, color: C.muted },
  };

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    const { data } = await supabase
      .from("documents")
      .select("id, document_number, document_type, status, total, issue_date, companies(name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setDocs(data ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Filter logic
  useEffect(() => {
    let result = docs;
    if (activeType !== "all") result = result.filter((d) => d.document_type === activeType);
    if (statusFilter !== "all") result = result.filter((d) => d.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (d) =>
          d.document_number?.toLowerCase().includes(q) ||
          d.companies?.name?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [docs, query, activeType, statusFilter]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const chips = Object.keys(DOC_TYPES).slice(0, 6);

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  const hasFilters = activeType !== "all" || statusFilter !== "all";

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Sticky header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, backgroundColor: C.bg }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, marginBottom: 10 }}>{t("biblioteca.title")}</Text>

        {/* Search + filter */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <View style={{
            flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
            backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border,
            borderRadius: 10, paddingHorizontal: 12,
          }}>
            <Search size={16} color={C.muted} />
            <TextInput
              style={{ flex: 1, fontSize: 14, color: C.text, paddingVertical: 10 }}
              placeholder={t("biblioteca.searchPlaceholder")}
              placeholderTextColor={C.muted}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <X size={16} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setFilterModal(true)}
            style={{
              paddingHorizontal: 14, borderRadius: 10,
              backgroundColor: hasFilters ? C.blue : C.blueL,
              flexDirection: "row", alignItems: "center", gap: 4,
            }}
          >
            <SlidersHorizontal size={16} color={hasFilters ? "#fff" : C.blue} />
            {hasFilters && <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>•</Text>}
          </TouchableOpacity>
        </View>

        {/* Type chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: "row", gap: 6, paddingBottom: 4 }}>
            {chips.map((type) => {
              const active = activeType === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setActiveType(active && type !== "all" ? "all" : type)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
                    backgroundColor: active ? C.blue : C.surface,
                    borderWidth: 1, borderColor: active ? C.blue : C.border,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "500", color: active ? "#fff" : C.muted }}>
                    {DOC_TYPES[type]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Text style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
          {t("biblioteca.docsFound", { count: filtered.length })}
        </Text>
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
          <BookOpen size={56} color={C.muted} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{t("biblioteca.noResults")}</Text>
          <Text style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
            {t("biblioteca.noResultsDesc")}
          </Text>
          {hasFilters && (
            <TouchableOpacity
              onPress={() => { setActiveType("all"); setStatusFilter("all"); setQuery(""); }}
              style={{ backgroundColor: C.blue, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>{t("biblioteca.clearFilters")}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DocRow doc={item} C={C} t={t} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
          contentContainerStyle={{ backgroundColor: C.surface }}
          showsVerticalScrollIndicator={false}
        />
      )}

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

      {/* Filter modal */}
      <Sheet visible={filterModal} onClose={() => setFilterModal(false)} C={C}>
        <View style={{ paddingBottom: 24, paddingTop: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>{t("biblioteca.advancedFilters")}</Text>
            <TouchableOpacity onPress={() => { setActiveType("all"); setStatusFilter("all"); }}>
              <Text style={{ fontSize: 13, color: C.muted }}>{t("biblioteca.clear")}</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 12, fontWeight: "600", color: C.muted, paddingHorizontal: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>{t("biblioteca.statusLabel")}</Text>
          {["all", "pending", "paid", "overdue", "draft", "cancelled"].map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setStatusFilter(s)}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}
            >
              <Text style={{ fontSize: 14, color: s === statusFilter ? C.blue : C.text, fontWeight: s === statusFilter ? "600" : "400" }}>
                {s === "all" ? t("common.all") : STATUS[s]?.label ?? s}
              </Text>
              {s === statusFilter && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue }} />}
            </TouchableOpacity>
          ))}

          <View style={{ padding: 16, marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => setFilterModal(false)}
              style={{ backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>{t("biblioteca.applyFilters")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Sheet>

      {/* First-time hint */}
      <Coachmark
        id="biblioteca-empty"
        active={!loading && docs.length === 0}
        icon={<BookOpen size={32} color={C.blue} />}
        title={t("coachmarks.bibliotecaEmpty.title")}
        description={t("coachmarks.bibliotecaEmpty.description")}
        position="center"
      />
    </SafeAreaView>
  );
}
