import { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator,
} from "react-native";
import Sheet from "@/components/Sheet";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Search, X, ChevronDown, FileText, ChevronRight } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/colors";
import { useTranslation } from "react-i18next";

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

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
      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: C.border }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
        <FileText size={16} color={C.blue} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: C.text, fontFamily: "monospace" }} numberOfLines={1}>{doc.document_number}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: C.text }}>
            {doc.total != null ? `€${Number(doc.total).toLocaleString("es-ES", { minimumFractionDigits: 2 })}` : "—"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>{doc.companies?.name ?? t("common.noCompany")}</Text>
          <View style={{ backgroundColor: sm.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: sm.color }}>{sm.label}</Text>
          </View>
        </View>
      </View>
      <ChevronRight size={16} color={C.muted} />
    </TouchableOpacity>
  );
}

export default function BuscarScreen() {
  const { orgId } = useAuth();
  const C = useColors();
  const { t } = useTranslation();
  const [query,      setQuery]      = useState("");
  const [results,    setResults]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [sort,       setSort]       = useState<SortKey>("date_desc");
  const [sortModal,  setSortModal]  = useState(false);
  const [searched,   setSearched]   = useState(false);

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: "date_desc",   label: t("buscar.sortDateDesc") },
    { key: "date_asc",    label: t("buscar.sortDateAsc") },
    { key: "amount_desc", label: t("buscar.sortAmountDesc") },
    { key: "amount_asc",  label: t("buscar.sortAmountAsc") },
  ];

  const search = useCallback(async (q: string, s: SortKey) => {
    if (!orgId || !q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);

    let qb = supabase
      .from("documents")
      .select("id, document_number, document_type, status, total, issue_date, companies(name)")
      .eq("organization_id", orgId);

    if (q.trim()) {
      qb = qb.or(`document_number.ilike.%${q}%`);
    }

    if (s === "date_desc")    qb = qb.order("issue_date", { ascending: false });
    if (s === "date_asc")     qb = qb.order("issue_date", { ascending: true });
    if (s === "amount_desc")  qb = qb.order("total", { ascending: false });
    if (s === "amount_asc")   qb = qb.order("total", { ascending: true });

    const { data } = await qb;
    setResults(data ?? []);
    setLoading(false);
  }, [orgId]);

  const handleQuery = (v: string) => {
    setQuery(v);
    if (v.length > 1) search(v, sort);
    else { setResults([]); setSearched(false); }
  };

  const handleSort = (s: SortKey) => {
    setSort(s);
    setSortModal(false);
    if (query.trim()) search(query, s);
  };

  const activeSort = SORT_OPTIONS.find((o) => o.key === sort)!;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: C.text, marginBottom: 10 }}>{t("buscar.title")}</Text>

        {/* Search bar */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: query ? C.blue : C.border,
          borderRadius: 10, paddingHorizontal: 12, marginBottom: 10,
        }}>
          <Search size={16} color={C.muted} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: C.text, paddingVertical: 11 }}
            placeholder={t("buscar.placeholder")}
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={handleQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); setResults([]); setSearched(false); }}>
              <X size={16} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort chip + results count */}
        {searched && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: C.muted }}>
              {t("buscar.resultsFor", { count: results.length, query })}
            </Text>
            <TouchableOpacity
              onPress={() => setSortModal(true)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
                borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
              }}
            >
              <Text style={{ fontSize: 12, color: C.text }}>{activeSort.label}</Text>
              <ChevronDown size={12} color={C.muted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.blue} />
        </View>
      ) : !searched ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
          <Search size={56} color={C.muted} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{t("buscar.searchAny")}</Text>
          <Text style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
            {t("buscar.searchHint")}
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
          <Search size={56} color={C.muted} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{t("buscar.noResults")}</Text>
          <Text style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
            {t("buscar.tryOther")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DocRow doc={item} C={C} t={t} />}
          contentContainerStyle={{ backgroundColor: C.surface }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Sort modal */}
      <Sheet visible={sortModal} onClose={() => setSortModal(false)} C={C}>
        <View style={{ paddingBottom: 24, paddingTop: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, padding: 16, paddingBottom: 8 }}>{t("buscar.sortBy")}</Text>
          {SORT_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.key}
              onPress={() => handleSort(o.key)}
              style={{
                flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                padding: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border,
              }}
            >
              <Text style={{ fontSize: 14, color: o.key === sort ? C.blue : C.text, fontWeight: o.key === sort ? "600" : "400" }}>
                {o.label}
              </Text>
              {o.key === sort && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue }} />}
            </TouchableOpacity>
          ))}
          <View style={{ height: 8 }} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
