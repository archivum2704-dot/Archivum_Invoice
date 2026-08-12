import { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, X, ChevronDown } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/colors";
import { useTranslation } from "react-i18next";
import { KeyboardModal } from "@/components/KeyboardModal";
import { DocRow } from "@/components/DocRow";
import { EmptyState } from "@/components/ui";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

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
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text, marginBottom: spacing.sm + 2 }}>{t("buscar.title")}</Text>

        {/* Search bar */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: spacing.sm,
          backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: query ? C.blue : C.border,
          borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm + 2,
        }}>
          <Search size={16} color={C.muted} strokeWidth={1.75} />
          <TextInput
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: C.text, paddingVertical: 11 }}
            placeholder={t("buscar.placeholder")}
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={handleQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); setResults([]); setSearched(false); }} hitSlop={8}>
              <X size={16} color={C.muted} strokeWidth={1.75} />
            </TouchableOpacity>
          )}
        </View>

        {/* Sort chip + results count */}
        {searched && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm - 2 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>
              {t("buscar.resultsFor", { count: results.length, query })}
            </Text>
            <TouchableOpacity
              onPress={() => setSortModal(true)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
                borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5,
              }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: C.text }}>{activeSort.label}</Text>
              <ChevronDown size={12} color={C.muted} strokeWidth={1.75} />
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
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon={<Search size={28} color={C.muted} strokeWidth={1.5} />}
            title={t("buscar.searchAny")}
            subtitle={t("buscar.searchHint")}
          />
        </View>
      ) : results.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon={<Search size={28} color={C.muted} strokeWidth={1.5} />}
            title={t("buscar.noResults")}
            subtitle={t("buscar.tryOther")}
          />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DocRow doc={item} />}
          contentContainerStyle={{ backgroundColor: C.surface }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Sort modal */}
      <KeyboardModal visible={sortModal} animationType="slide" transparent onRequestClose={() => setSortModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={() => setSortModal(false)} />
        <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, paddingBottom: spacing.xl }}>
          <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.xs }} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text, padding: spacing.lg, paddingBottom: spacing.sm }}>{t("buscar.sortBy")}</Text>
          {SORT_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.key}
              onPress={() => handleSort(o.key)}
              style={{
                flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                padding: spacing.md + 2, paddingHorizontal: spacing.xl - 4, borderBottomWidth: 1, borderBottomColor: C.border,
              }}
            >
              <Text style={{
                fontFamily: o.key === sort ? fonts.semibold : fonts.regular, fontSize: 14,
                color: o.key === sort ? C.blue : C.text,
              }}>
                {o.label}
              </Text>
              {o.key === sort && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue }} />}
            </TouchableOpacity>
          ))}
          <View style={{ height: spacing.sm }} />
        </View>
      </KeyboardModal>
    </SafeAreaView>
  );
}
