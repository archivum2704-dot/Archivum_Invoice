import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Plus, Search, MoreVertical, Building2, X,
  FileText, Pencil, PauseCircle, PlayCircle, Trash2,
  ArrowRight, Lock,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Coachmark } from "@/components/Coachmark";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";

const APP_URL = "https://archivum2704-dot.vercel.app";

function isPaidActive(status: string) {
  return status === "active" || status === "trialing";
}

interface PlanInfo {
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: 20, paddingBottom: 28 }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
            <Lock size={26} color={C.blue} />
          </View>
        </View>
        <Text style={{ fontSize: 18, fontWeight: "800", color: C.text, textAlign: "center", paddingHorizontal: 24, marginBottom: 8 }}>
          {t("empresas.limitTitle")}
        </Text>
        <Text style={{ fontSize: 14, color: C.muted, textAlign: "center", paddingHorizontal: 24, lineHeight: 20, marginBottom: 20 }}>
          {t("empresas.limitDesc", { max: maxCompanies })}
        </Text>
        <View style={{ marginHorizontal: 24, marginBottom: 20, gap: 8 }}>
          {[t("empresas.limitBullet1"), t("empresas.limitBullet2"), t("empresas.limitBullet3")].map((line) => (
            <View key={line} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.blue }} />
              <Text style={{ fontSize: 13, color: C.text }}>{line}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          onPress={() => { onClose(); Linking.openURL(`${APP_URL}/configuracion/billing`); }}
          style={{ marginHorizontal: 24, backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("common.viewPlans")}</Text>
          <ArrowRight size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 10, alignItems: "center", paddingVertical: 10 }}>
          <Text style={{ fontSize: 14, color: C.muted }}>{t("common.notNow")}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: 20, maxHeight: "75%", overflow: "hidden" }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>{isEdit ? t("empresas.editCompany") : t("empresas.newCompany")}</Text>
          <TouchableOpacity onPress={onClose} style={{ backgroundColor: C.segmentBg, borderRadius: 8, padding: 6 }}>
            <X size={16} color={C.muted} />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {[
            { label: t("empresas.nameLabel"), value: name, setter: setName, placeholder: "Iberdrola SA" },
            { label: t("empresas.cifLabel"),  value: cif,  setter: setCif,  placeholder: "A-95075578" },
            { label: t("empresas.sectorLabel"), value: sector, setter: setSector, placeholder: "Energía" },
          ].map((f) => (
            <View key={f.label} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 5 }}>{f.label}</Text>
              <TextInput
                style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text, backgroundColor: C.inputBg }}
                placeholder={f.placeholder} placeholderTextColor={C.muted}
                value={f.value} onChangeText={f.setter}
              />
            </View>
          ))}
          <TouchableOpacity
            onPress={handleSave} disabled={saving || !name.trim()}
            style={{ backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 16, opacity: (saving || !name.trim()) ? 0.6 : 1 }}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              {saving ? t("common.saving") : (isEdit ? t("empresas.saveChanges") : t("empresas.createCompany"))}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: 20, paddingBottom: 24 }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 }} />
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, paddingHorizontal: 20, paddingBottom: 8 }} numberOfLines={1}>
          {company.name}
        </Text>
        {[
          { icon: <FileText size={18} color={C.blue} />,   label: t("empresas.viewDocs"),   action: () => { onClose(); router.push(`/(app)/biblioteca?empresa=${company.id}`); } },
          { icon: <Pencil size={18} color={C.text} />,     label: t("common.edit"),         action: () => { onClose(); onEdit(); } },
          { icon: company.is_active
              ? <PauseCircle size={18} color={C.yellow} />
              : <PlayCircle  size={18} color={C.green}  />,
            label: company.is_active ? t("empresas.suspend") : t("empresas.reactivate"),
            action: () => { onClose(); onToggle(); }
          },
          { icon: <Trash2 size={18} color={C.red} />, label: t("common.delete"), action: () => { onClose(); onDelete(); }, danger: true },
        ].map((item) => (
          <TouchableOpacity
            key={item.label} onPress={item.action}
            style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border }}
          >
            {item.icon}
            <Text style={{ fontSize: 15, color: item.danger ? C.red : C.text }}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

/* ── Filter chip ─────────────────────────────────────────────────────────── */
function Chip({ label, active, onPress, C }: { label: string; active: boolean; onPress: () => void; C: any }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
        backgroundColor: active ? C.blue : C.surface, borderColor: active ? C.blue : C.border,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#fff" : C.muted }}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Company card ────────────────────────────────────────────────────────── */
function CompanyCard({ company, onMenu, C, t }: { company: Company; onMenu: () => void; C: any; t: any }) {
  return (
    <View style={{
      backgroundColor: C.surface, borderRadius: 14, marginHorizontal: 16, marginBottom: 10,
      overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    }}>
      {!company.is_active && <View style={{ height: 3, backgroundColor: C.yellow }} />}
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flex: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: C.blue }}>{company.name[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }} numberOfLines={1}>{company.name}</Text>
                {!company.is_active && (
                  <View style={{ backgroundColor: C.yellowL, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: C.yellow }}>{t("empresas.suspended")}</Text>
                  </View>
                )}
              </View>
              {company.cif && (
                <Text style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>{company.cif}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={onMenu} style={{ padding: 4 }}>
            <MoreVertical size={20} color={C.muted} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
          {company.sector && (
            <View>
              <Text style={{ fontSize: 11, color: C.muted }}>{t("empresas.sector")}</Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.text }}>{company.sector}</Text>
            </View>
          )}
          <View>
            <Text style={{ fontSize: 11, color: C.muted }}>{t("empresas.documents")}</Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: C.text }}>{company.doc_count ?? 0}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
export default function EmpresasScreen() {
  const { t } = useTranslation();
  const C = useColors();
  const { orgId } = useAuth();
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

  const maxCompanies = plan
    ? (isPaidActive(plan.subscription_status) ? 20 + plan.extra_companies_quantity : 1)
    : 999; // Don't block while plan is loading

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
      supabase.from("organizations").select("subscription_status, extra_companies_quantity").eq("id", orgId).single(),
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
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.text }}>{t("empresas.title")}</Text>
            {plan && (
              <Text style={{ fontSize: 12, color: atLimit ? C.red : C.muted, marginTop: 1 }}>
                {t("empresas.companiesCount", { current: companies.length, max: maxCompanies })}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleAddPress}
            style={{ width: 36, height: 36, backgroundColor: C.blue, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
          >
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: C.inputBg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12,
        }}>
          <Search size={16} color={C.muted} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: C.text, paddingVertical: 10 }}
            placeholder={t("empresas.searchPlaceholder")}
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}><X size={16} color={C.muted} /></TouchableOpacity>
          )}
        </View>

        {/* Sector filter chips */}
        {sectors.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16, marginTop: 10 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
          <Building2 size={56} color={C.muted} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>
            {(query || selectedSector) ? t("empresas.noResults") : t("empresas.noCompanies")}
          </Text>
          <Text style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
            {(query || selectedSector) ? t("empresas.tryOther") : t("empresas.addFirst")}
          </Text>
          {!query && !selectedSector && (
            <TouchableOpacity
              onPress={handleAddPress}
              style={{ backgroundColor: C.blue, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>{t("empresas.addCompany")}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CompanyCard company={item} onMenu={() => setMenuTarget(item)} C={C} t={t} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
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
