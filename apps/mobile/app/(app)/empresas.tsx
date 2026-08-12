import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Plus, Search, MoreVertical, Building2, X,
  FileText, Pencil, PauseCircle, PlayCircle, Trash2,
  Lock,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Coachmark } from "@/components/Coachmark";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { BillingNotice } from "@/components/BillingNotice";
import { RequirePermission } from "@/components/RequirePermission";
import { KeyboardModal } from "@/components/KeyboardModal";
import { resolveEntitlements } from "@/lib/pricing";
import { Badge, Button, Card, EmptyState, Input } from "@/components/ui";



interface PlanInfo {
  subscription_plan: string;
  subscription_status: string;
  extra_companies_quantity: number;
}

interface Company {
  id: string;
  name: string;
  cif: string | null;
  sector: string | null;
  is_active: boolean;
  doc_count?: number;
}

// Sentinel for the "no sector" filter chip
const NO_SECTOR = "__no_sector__";

/* ── Upgrade modal ───────────────────────────────────────────────────────── */
function UpgradeModal({ visible, maxCompanies, onClose, C, t }: { visible: boolean; maxCompanies: number; onClose: () => void; C: any; t: any }) {
  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, paddingBottom: spacing.xl + 4 }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.lg }} />
        <View style={{ alignItems: "center", marginBottom: spacing.md }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
            <Lock size={26} color={C.blue} strokeWidth={1.75} />
          </View>
        </View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: 18, color: C.text, textAlign: "center", paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
          {t("empresas.limitTitle")}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted, textAlign: "center", paddingHorizontal: spacing.xl, lineHeight: 20, marginBottom: spacing.xl - 4 }}>
          {t("empresas.limitDesc", { max: maxCompanies })}
        </Text>
        <View style={{ marginHorizontal: spacing.xl, marginBottom: spacing.xl - 4, gap: spacing.sm }}>
          {[t("empresas.limitBullet1"), t("empresas.limitBullet2"), t("empresas.limitBullet3")].map((line) => (
            <View key={line} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.blue }} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.text }}>{line}</Text>
            </View>
          ))}
        </View>
        <BillingNotice style={{ marginHorizontal: spacing.xl }} />
        <TouchableOpacity onPress={onClose} style={{ marginTop: spacing.sm + 2, alignItems: "center", paddingVertical: spacing.sm + 2 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted }}>{t("common.notNow")}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardModal>
  );
}

/* ── Company form modal (create / edit) ─────────────────────────────────── */
function CompanyModal({
  visible, onClose, onSaved, orgId, initial, C, t,
}: {
  visible: boolean; onClose: () => void; onSaved: () => void;
  orgId: string; initial?: Company | null; C: any; t: any;
}) {
  const isEdit = !!initial;
  const [name,    setName]    = useState(initial?.name    ?? "");
  const [cif,     setCif]     = useState(initial?.cif     ?? "");
  const [sector,  setSector]  = useState(initial?.sector  ?? "");
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? "");
      setCif(initial?.cif ?? "");
      setSector(initial?.sector ?? "");
    }
  }, [visible, initial]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    let error: any;
    if (isEdit && initial) {
      ({ error } = await supabase.from("companies").update({ name: name.trim(), cif: cif.trim() || null, sector: sector.trim() || null }).eq("id", initial.id));
    } else {
      ({ error } = await supabase.from("companies").insert({ organization_id: orgId, name: name.trim(), cif: cif.trim() || null, sector: sector.trim() || null, is_active: true }));
    }
    setSaving(false);
    if (error) {
      Alert.alert(t("common.error"), error.message ?? t("common.unknownError"));
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, maxHeight: "75%", overflow: "hidden" }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text }}>{isEdit ? t("empresas.editCompany") : t("empresas.newCompany")}</Text>
          <TouchableOpacity onPress={onClose} style={{ backgroundColor: C.segmentBg, borderRadius: radius.sm, padding: 6 }}>
            <X size={16} color={C.muted} strokeWidth={1.75} />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {[
            { label: t("empresas.nameLabel"), value: name, setter: setName, placeholder: "Iberdrola SA" },
            { label: t("empresas.cifLabel"),  value: cif,  setter: setCif,  placeholder: "A-95075578" },
            { label: t("empresas.sectorLabel"), value: sector, setter: setSector, placeholder: "Energía" },
          ].map((f) => (
            <View key={f.label} style={{ marginBottom: spacing.md }}>
              <Input label={f.label} placeholder={f.placeholder} value={f.value} onChangeText={f.setter} />
            </View>
          ))}
          <Button
            label={isEdit ? t("empresas.saveChanges") : t("empresas.createCompany")}
            onPress={handleSave}
            disabled={saving || !name.trim()}
            loading={saving}
            style={{ marginBottom: spacing.lg }}
          />
        </ScrollView>
      </View>
    </KeyboardModal>
  );
}

/* ── Action menu modal ───────────────────────────────────────────────────── */
function ActionMenu({
  visible, company, onClose, onEdit, onToggle, onDelete, C, t,
}: {
  visible: boolean; company: Company | null; onClose: () => void;
  onEdit: () => void; onToggle: () => void; onDelete: () => void; C: any; t: any;
}) {
  if (!company) return null;
  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, paddingBottom: spacing.xl }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.sm }} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: C.text, paddingHorizontal: spacing.xl - 4, paddingBottom: spacing.sm }} numberOfLines={1}>
          {company.name}
        </Text>
        {[
          { icon: <FileText size={18} color={C.blue} strokeWidth={1.75} />,   label: t("empresas.viewDocs"),   action: () => { onClose(); router.push(`/(app)/biblioteca?empresa=${company.id}`); } },
          { icon: <Pencil size={18} color={C.text} strokeWidth={1.75} />,     label: t("common.edit"),         action: () => { onClose(); onEdit(); } },
          { icon: company.is_active
              ? <PauseCircle size={18} color={C.yellow} strokeWidth={1.75} />
              : <PlayCircle  size={18} color={C.green}  strokeWidth={1.75} />,
            label: company.is_active ? t("empresas.suspend") : t("empresas.reactivate"),
            action: () => { onClose(); onToggle(); }
          },
          { icon: <Trash2 size={18} color={C.red} strokeWidth={1.75} />, label: t("common.delete"), action: () => { onClose(); onDelete(); }, danger: true },
        ].map((item) => (
          <TouchableOpacity
            key={item.label} onPress={item.action}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md + 2, padding: spacing.md + 2, paddingHorizontal: spacing.xl - 4, borderBottomWidth: 1, borderBottomColor: C.border }}
          >
            {item.icon}
            <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: item.danger ? C.red : C.text }}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </KeyboardModal>
  );
}

/* ── Filter chip ─────────────────────────────────────────────────────────── */
function Chip({ label, active, onPress, C }: { label: string; active: boolean; onPress: () => void; C: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md + 2, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1,
        backgroundColor: active ? C.blue : C.surface, borderColor: active ? C.blue : C.border,
      }}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: active ? "#fff" : C.muted }}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Company card ────────────────────────────────────────────────────────── */
function CompanyCard({ company, onMenu, C, t }: { company: Company; onMenu: () => void; C: any; t: any }) {
  return (
    <Card
      padded={false}
      containerStyle={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm + 2 }}
    >
      {!company.is_active && <View style={{ height: 3, backgroundColor: C.yellow }} />}
      <View style={{ padding: spacing.md + 2 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", gap: spacing.sm + 2, alignItems: "center", flex: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: radius.md - 2, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: C.blue }}>{company.name[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", gap: spacing.xs + 2, alignItems: "center" }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: C.text }} numberOfLines={1}>{company.name}</Text>
                {!company.is_active && <Badge label={t("empresas.suspended")} tone="yellow" />}
              </View>
              {company.cif && (
                <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: C.muted }}>{company.cif}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={onMenu} style={{ padding: 4 }}>
            <MoreVertical size={20} color={C.muted} strokeWidth={1.75} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm + 2, paddingTop: spacing.sm + 2, borderTopWidth: 1, borderTopColor: C.border }}>
          {company.sector && (
            <View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("empresas.sector")}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.text }}>{company.sector}</Text>
            </View>
          )}
          <View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("empresas.documents")}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.text }}>{company.doc_count ?? 0}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
function EmpresasScreenContent() {
  const { t } = useTranslation();
  const C = useColors();
  const { orgId, isPlatformAdmin } = useAuth();
  const [companies,    setCompanies]    = useState<Company[]>([]);
  const [filtered,     setFiltered]     = useState<Company[]>([]);
  const [query,        setQuery]        = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [menuTarget,   setMenuTarget]   = useState<Company | null>(null);
  const [editTarget,   setEditTarget]   = useState<Company | null>(null);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [upgradeOpen,  setUpgradeOpen]  = useState(false);
  const [plan,         setPlan]         = useState<PlanInfo | null>(null);

  // Same resolver the server enforces with.
  const maxCompanies = plan
    ? resolveEntitlements(plan, { isPlatformAdmin }).maxCompanies
    : 999; // Don't block while the plan is loading

  const atLimit = plan != null && companies.length >= maxCompanies;

  const handleAddPress = () => {
    if (!orgId) {
      Alert.alert(t("common.error"), t("common.unknownError"));
      return;
    }
    if (atLimit) { setUpgradeOpen(true); }
    else         { setCreateOpen(true);  }
  };

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    const [{ data: comps }, { data: counts }, { data: orgData }] = await Promise.all([
      supabase.from("companies").select("id, name, cif, sector, is_active").eq("organization_id", orgId).order("name"),
      supabase.from("documents").select("company_id").eq("organization_id", orgId).not("company_id", "is", null),
      supabase.from("organizations").select("subscription_plan, subscription_status, extra_companies_quantity").eq("id", orgId).single(),
    ]);
    const countMap: Record<string, number> = {};
    for (const row of counts ?? []) {
      if (row.company_id) countMap[row.company_id] = (countMap[row.company_id] ?? 0) + 1;
    }
    const withCounts = (comps ?? []).map((c) => ({ ...c, doc_count: countMap[c.id] ?? 0 }));
    setCompanies(withCounts);
    if (orgData) setPlan(orgData as PlanInfo);
    setLoading(false);
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const sectors = Array.from(
    new Set(companies.map((c) => c.sector?.trim()).filter((s): s is string => !!s))
  ).sort((a, b) => a.localeCompare(b));
  const hasNoSector = companies.some((c) => !c.sector?.trim());

  useEffect(() => {
    const q = query.trim().toLowerCase();
    setFiltered(
      companies.filter((c) => {
        const matchesSearch =
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.cif ?? "").toLowerCase().includes(q) ||
          (c.sector ?? "").toLowerCase().includes(q);
        const matchesSector =
          !selectedSector ||
          (selectedSector === NO_SECTOR ? !c.sector?.trim() : c.sector?.trim() === selectedSector);
        return matchesSearch && matchesSector;
      })
    );
  }, [query, companies, selectedSector]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleToggle = async (c: Company) => {
    await supabase.from("companies").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  const handleDelete = (c: Company) => {
    Alert.alert(
      t("empresas.deleteTitle"),
      t("empresas.deleteConfirm", { name: c.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"), style: "destructive",
          onPress: async () => { await supabase.from("companies").delete().eq("id", c.id); load(); },
        },
      ]
    );
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
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
          <View>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text }}>{t("empresas.title")}</Text>
            {plan && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: atLimit ? C.red : C.muted, marginTop: 1 }}>
                {t("empresas.companiesCount", { current: companies.length, max: maxCompanies })}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleAddPress}
            style={{ width: 36, height: 36, backgroundColor: C.blue, borderRadius: radius.md - 2, alignItems: "center", justifyContent: "center" }}
          >
            <Plus size={18} color="#fff" strokeWidth={1.75} />
          </TouchableOpacity>
        </View>

        <View style={{
          flexDirection: "row", alignItems: "center", gap: spacing.sm,
          backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border, borderRadius: radius.md, paddingHorizontal: spacing.md,
        }}>
          <Search size={16} color={C.muted} strokeWidth={1.75} />
          <TextInput
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: C.text, paddingVertical: spacing.sm + 2 }}
            placeholder={t("empresas.searchPlaceholder")}
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}><X size={16} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
          )}
        </View>

        {/* Sector filter chips */}
        {sectors.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -spacing.lg, marginTop: spacing.sm + 2 }}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 6 }}
          >
            <Chip label={t("empresas.allSectors")} active={selectedSector === null} onPress={() => setSelectedSector(null)} C={C} />
            {sectors.map((s) => (
              <Chip key={s} label={s} active={selectedSector === s} onPress={() => setSelectedSector(s)} C={C} />
            ))}
            {hasNoSector && (
              <Chip label={t("empresas.noSector")} active={selectedSector === NO_SECTOR} onPress={() => setSelectedSector(NO_SECTOR)} C={C} />
            )}
          </ScrollView>
        )}
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon={<Building2 size={28} color={C.muted} strokeWidth={1.5} />}
            title={(query || selectedSector) ? t("empresas.noResults") : t("empresas.noCompanies")}
            subtitle={(query || selectedSector) ? t("empresas.tryOther") : t("empresas.addFirst")}
            action={!query && !selectedSector ? (
              <Button label={t("empresas.addCompany")} onPress={handleAddPress} size="md" fullWidth={false} />
            ) : undefined}
          />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CompanyCard company={item} onMenu={() => setMenuTarget(item)} C={C} t={t} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
          contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* First-time hint */}
      <Coachmark
        id="empresas-create-first"
        active={!loading && companies.length === 0}
        icon={<Building2 size={32} color={C.blue} />}
        title={t("coachmarks.empresasCreateFirst.title")}
        description={t("coachmarks.empresasCreateFirst.description")}
        position="bottom"
      />

      {/* Modals */}
      <UpgradeModal visible={upgradeOpen} maxCompanies={maxCompanies} onClose={() => setUpgradeOpen(false)} C={C} t={t} />
      <CompanyModal visible={createOpen} onClose={() => setCreateOpen(false)} onSaved={load} orgId={orgId!} C={C} t={t} />
      <CompanyModal visible={!!editTarget} initial={editTarget} onClose={() => setEditTarget(null)} onSaved={load} orgId={orgId!} C={C} t={t} />
      <ActionMenu
        visible={!!menuTarget} company={menuTarget} onClose={() => setMenuTarget(null)}
        onEdit={() => { setEditTarget(menuTarget); setMenuTarget(null); }}
        onToggle={() => { if (menuTarget) handleToggle(menuTarget); setMenuTarget(null); }}
        onDelete={() => { if (menuTarget) handleDelete(menuTarget); }}
        C={C} t={t}
      />
    </SafeAreaView>
  );
}

export default function EmpresasScreen() {
  return (
    <RequirePermission section="empresas">
      <EmpresasScreenContent />
    </RequirePermission>
  );
}
