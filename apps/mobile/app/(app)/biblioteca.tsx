import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, ScrollView, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search, SlidersHorizontal,
  BookOpen, X, FolderPlus, Folder as FolderIcon,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Coachmark } from "@/components/Coachmark";
import { useTranslation } from "react-i18next";
import { useColors, type Colors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { KeyboardModal } from "@/components/KeyboardModal";
import { DocRow } from "@/components/DocRow";
import { UploadFab } from "@/components/UploadFab";
import { Button, EmptyState, Input } from "@/components/ui";

interface Folder { id: string; name: string }

/**
 * Create-folder sheet.
 *
 * Kept at module scope so the text field is not remounted on every keystroke —
 * declaring it inside the screen would drop focus and dismiss the keyboard.
 */
function NewFolderModal({ visible, orgId, onClose, onCreated, C, t }: {
  visible: boolean; orgId: string; onClose: () => void; onCreated: () => void; C: Colors; t: any;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) { setName(""); setSaving(false); } }, [visible]);

  const create = async () => {
    const clean = name.trim();
    if (!clean) return;
    setSaving(true);
    const { error } = await supabase.from("folders").insert({ organization_id: orgId, name: clean });
    setSaving(false);
    if (error) { Alert.alert(t("common.error"), error.message); return; }
    onCreated();
    onClose();
  };

  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, paddingBottom: spacing.xl + 4 }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.lg }} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text, paddingHorizontal: spacing.xl - 4, marginBottom: spacing.md + 2 }}>
          {t("biblioteca.newFolder")}
        </Text>
        <View style={{ paddingHorizontal: spacing.xl - 4 }}>
          <Input
            value={name}
            onChangeText={setName}
            autoFocus
            placeholder={t("biblioteca.folderNamePlaceholder")}
            onSubmitEditing={create}
            returnKeyType="done"
          />
          <Button
            label={t("common.create")}
            onPress={create}
            disabled={!name.trim()}
            loading={saving}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    </KeyboardModal>
  );
}

export default function BibliotecaScreen() {
  const { t } = useTranslation();
  const C = useColors();
  const { orgId, isAdmin } = useAuth();
  const [docs,        setDocs]        = useState<any[]>([]);
  const [filtered,    setFiltered]    = useState<any[]>([]);
  const [query,       setQuery]       = useState("");
  const [activeType,  setActiveType]  = useState("all");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [folders,      setFolders]      = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [newFolder,    setNewFolder]    = useState(false);

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

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    // Row-level security already limits both lists to what this member may see.
    const [{ data: docData }, { data: folderData }] = await Promise.all([
      supabase
        .from("documents")
        .select("id, document_number, document_type, status, total, issue_date, folder_id, companies(name)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("folders")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name"),
    ]);
    setDocs(docData ?? []);
    setFolders((folderData ?? []) as Folder[]);
    setLoading(false);
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Filter logic
  useEffect(() => {
    let result = docs;
    if (activeFolder) result = result.filter((d) => d.folder_id === activeFolder);
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
  }, [docs, query, activeType, statusFilter, activeFolder]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const chips = Object.keys(DOC_TYPES).slice(0, 6);

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  const hasFilters = activeType !== "all" || statusFilter !== "all" || activeFolder !== null;

  const docSubtitle = (doc: any) =>
    `${doc.companies?.name ?? t("common.noCompany")} · ${t(`docTypesPlural.${doc.document_type}`, { defaultValue: doc.document_type })}`;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Sticky header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: C.bg }}>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text, marginBottom: spacing.sm + 2 }}>{t("biblioteca.title")}</Text>

        {/* Search + filter */}
        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm + 2 }}>
          <View style={{
            flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm,
            backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border,
            borderRadius: radius.md, paddingHorizontal: spacing.md,
          }}>
            <Search size={16} color={C.muted} strokeWidth={1.75} />
            <TextInput
              style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: C.text, paddingVertical: 10 }}
              placeholder={t("biblioteca.searchPlaceholder")}
              placeholderTextColor={C.muted}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                <X size={16} color={C.muted} strokeWidth={1.75} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setFilterModal(true)}
            style={{
              paddingHorizontal: spacing.md + 2, borderRadius: radius.md,
              backgroundColor: hasFilters ? C.blue : C.blueL,
              flexDirection: "row", alignItems: "center", gap: 4,
            }}
          >
            <SlidersHorizontal size={16} color={hasFilters ? "#fff" : C.blue} strokeWidth={1.75} />
            {hasFilters && <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: "#fff" }}>•</Text>}
          </TouchableOpacity>
        </View>

        {/* Folders — only admins may create them, everyone sees the ones they can reach */}
        {(folders.length > 0 || isAdmin) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", gap: 6, paddingBottom: 4, alignItems: "center" }}>
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => setNewFolder(true)}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 5,
                    paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill,
                    borderWidth: 1, borderStyle: "dashed", borderColor: C.blue, backgroundColor: C.blueL,
                  }}
                >
                  <FolderPlus size={13} color={C.blue} strokeWidth={1.75} />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.blue }}>{t("biblioteca.newFolder")}</Text>
                </TouchableOpacity>
              )}
              {folders.map((f) => {
                const active = activeFolder === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setActiveFolder(active ? null : f.id)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 5,
                      paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill,
                      backgroundColor: active ? C.blue : C.surface,
                      borderWidth: 1, borderColor: active ? C.blue : C.border,
                    }}
                  >
                    <FolderIcon size={13} color={active ? "#fff" : C.muted} strokeWidth={1.75} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: active ? "#fff" : C.muted }}>{f.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Type chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: 6, paddingBottom: 4 }}>
            {chips.map((type) => {
              const active = activeType === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setActiveType(active && type !== "all" ? "all" : type)}
                  style={{
                    paddingHorizontal: spacing.md + 2, paddingVertical: 6, borderRadius: radius.pill,
                    backgroundColor: active ? C.blue : C.surface,
                    borderWidth: 1, borderColor: active ? C.blue : C.border,
                  }}
                >
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: active ? "#fff" : C.muted }}>
                    {DOC_TYPES[type]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginBottom: spacing.sm }}>
          {t("biblioteca.docsFound", { count: filtered.length })}
        </Text>
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon={<BookOpen size={28} color={C.muted} strokeWidth={1.5} />}
            title={t("biblioteca.noResults")}
            subtitle={t("biblioteca.noResultsDesc")}
            action={hasFilters ? (
              <Button
                label={t("biblioteca.clearFilters")}
                onPress={() => { setActiveType("all"); setStatusFilter("all"); setQuery(""); }}
                size="md"
                fullWidth={false}
              />
            ) : undefined}
          />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DocRow doc={item} subtitle={docSubtitle(item)} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
          contentContainerStyle={{ backgroundColor: C.surface }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <UploadFab />

      {/* Filter modal */}
      <KeyboardModal visible={filterModal} animationType="slide" transparent onRequestClose={() => setFilterModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={() => setFilterModal(false)} />
        <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, paddingBottom: spacing.xl }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.xs }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text }}>{t("biblioteca.advancedFilters")}</Text>
            <TouchableOpacity onPress={() => { setActiveType("all"); setStatusFilter("all"); }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted }}>{t("biblioteca.clear")}</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.muted, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.8 }}>{t("biblioteca.statusLabel")}</Text>
          {["all", "pending", "paid", "overdue", "draft", "cancelled"].map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setStatusFilter(s)}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md + 2, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border }}
            >
              <Text style={{
                fontFamily: s === statusFilter ? fonts.semibold : fonts.regular, fontSize: 14,
                color: s === statusFilter ? C.blue : C.text,
              }}>
                {s === "all" ? t("common.all") : t(`status.${s}`, { defaultValue: s })}
              </Text>
              {s === statusFilter && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue }} />}
            </TouchableOpacity>
          ))}

          <View style={{ padding: spacing.lg, marginTop: spacing.xs }}>
            <Button label={t("biblioteca.applyFilters")} onPress={() => setFilterModal(false)} />
          </View>
        </View>
      </KeyboardModal>

      {orgId && (
        <NewFolderModal
          visible={newFolder}
          orgId={orgId}
          onClose={() => setNewFolder(false)}
          onCreated={load}
          C={C} t={t}
        />
      )}

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
