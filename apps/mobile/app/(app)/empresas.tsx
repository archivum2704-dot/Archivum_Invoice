import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Plus, Search, MoreVertical, Building2, X,
  FileText, Pencil, PauseCircle, PlayCircle, Trash2,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";

const C = {
  blue: "#2563EB", blueL: "#EFF6FF",
  green: "#16A34A", greenL: "#F0FDF4",
  yellow: "#D97706", yellowL: "#FFFBEB",
  red: "#DC2626", redL: "#FEF2F2",
  bg: "#F9FAFB", surface: "#FFFFFF",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
};

interface Company {
  id: string;
  name: string;
  cif: string | null;
  sector: string | null;
  is_active: boolean;
  doc_count?: number;
}

/* ── Company form modal (create / edit) ─────────────────────────────────── */
function CompanyModal({
  visible, onClose, onSaved, orgId, initial,
}: {
  visible: boolean; onClose: () => void; onSaved: () => void;
  orgId: string; initial?: Company | null;
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
    if (isEdit && initial) {
      await supabase.from("companies").update({ name: name.trim(), cif: cif.trim() || null, sector: sector.trim() || null }).eq("id", initial.id);
    } else {
      await supabase.from("companies").insert({ organization_id: orgId, name: name.trim(), cif: cif.trim() || null, sector: sector.trim() || null, is_active: true });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)" }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: 20, maxHeight: "75%", overflow: "hidden" }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>{isEdit ? "Editar empresa" : "Nueva empresa"}</Text>
          <TouchableOpacity onPress={onClose} style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }}>
            <X size={16} color={C.muted} />
          </TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          {[
            { label: "Nombre *", value: name, setter: setName, placeholder: "Iberdrola SA" },
            { label: "CIF/NIF",  value: cif,  setter: setCif,  placeholder: "A-95075578" },
            { label: "Sector",   value: sector, setter: setSector, placeholder: "Energía" },
          ].map((f) => (
            <View key={f.label} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 5 }}>{f.label}</Text>
              <TextInput
                style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text, backgroundColor: C.surface }}
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
              {saving ? "Guardando…" : (isEdit ? "Guardar cambios" : "Crear empresa")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ── Action menu modal ───────────────────────────────────────────────────── */
function ActionMenu({
  visible, company, onClose, onEdit, onToggle, onDelete,
}: {
  visible: boolean; company: Company | null; onClose: () => void;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  if (!company) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)" }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: 20, paddingBottom: 24 }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 }} />
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, paddingHorizontal: 20, paddingBottom: 8 }} numberOfLines={1}>
          {company.name}
        </Text>
        {[
          { icon: <FileText size={18} color={C.blue} />,   label: "Ver documentos",   action: () => { onClose(); router.push(`/(app)/biblioteca?empresa=${company.id}`); } },
          { icon: <Pencil size={18} color={C.text} />,     label: "Editar",            action: () => { onClose(); onEdit(); } },
          { icon: company.is_active
              ? <PauseCircle size={18} color={C.yellow} />
              : <PlayCircle  size={18} color={C.green}  />,
            label: company.is_active ? "Suspender" : "Reactivar",
            action: () => { onClose(); onToggle(); }
          },
          { icon: <Trash2 size={18} color={C.red} />,     label: "Eliminar",          action: () => { onClose(); onDelete(); }, danger: true },
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

/* ── Company card ────────────────────────────────────────────────────────── */
function CompanyCard({ company, onMenu }: { company: Company; onMenu: () => void }) {
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
                    <Text style={{ fontSize: 10, fontWeight: "600", color: C.yellow }}>Suspendida</Text>
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
              <Text style={{ fontSize: 11, color: C.muted }}>Sector</Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: C.text }}>{company.sector}</Text>
            </View>
          )}
          <View>
            <Text style={{ fontSize: 11, color: C.muted }}>Documentos</Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: C.text }}>{company.doc_count ?? 0}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
export default function EmpresasScreen() {
  const { orgId } = useAuth();
  const [companies,   setCompanies]   = useState<Company[]>([]);
  const [filtered,    setFiltered]    = useState<Company[]>([]);
  const [query,       setQuery]       = useState("");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [menuTarget,  setMenuTarget]  = useState<Company | null>(null);
  const [editTarget,  setEditTarget]  = useState<Company | null>(null);
  const [createOpen,  setCreateOpen]  = useState(false);

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    const [{ data: comps }, { data: counts }] = await Promise.all([
      supabase.from("companies").select("id, name, cif, sector, is_active").eq("organization_id", orgId).order("name"),
      supabase.from("documents").select("company_id").eq("organization_id", orgId).not("company_id", "is", null),
    ]);
    const countMap: Record<string, number> = {};
    for (const row of counts ?? []) {
      if (row.company_id) countMap[row.company_id] = (countMap[row.company_id] ?? 0) + 1;
    }
    const withCounts = (comps ?? []).map((c) => ({ ...c, doc_count: countMap[c.id] ?? 0 }));
    setCompanies(withCounts);
    setLoading(false);
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!query.trim()) { setFiltered(companies); return; }
    const q = query.toLowerCase();
    setFiltered(companies.filter((c) => c.name.toLowerCase().includes(q) || c.cif?.toLowerCase().includes(q)));
  }, [query, companies]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleToggle = async (c: Company) => {
    await supabase.from("companies").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  const handleDelete = (c: Company) => {
    Alert.alert(
      "Eliminar empresa",
      `¿Estás seguro de que quieres eliminar "${c.name}"? Sus documentos quedarán sin empresa asignada.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar", style: "destructive",
          onPress: async () => { await supabase.from("companies").delete().eq("id", c.id); load(); },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: C.text }}>Empresas</Text>
          <TouchableOpacity
            onPress={() => setCreateOpen(true)}
            style={{ width: 36, height: 36, backgroundColor: C.blue, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
          >
            <Plus size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12,
        }}>
          <Search size={16} color={C.muted} />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: C.text, paddingVertical: 10 }}
            placeholder="Buscar empresa, CIF…"
            placeholderTextColor={C.muted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
          <Building2 size={56} color={C.muted} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>
            {query ? "Sin resultados" : "Sin empresas"}
          </Text>
          <Text style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
            {query ? "Prueba otro término de búsqueda." : "Añade tu primera empresa para comenzar."}
          </Text>
          {!query && (
            <TouchableOpacity
              onPress={() => setCreateOpen(true)}
              style={{ backgroundColor: C.blue, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Añadir empresa</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CompanyCard company={item} onMenu={() => setMenuTarget(item)} />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modals */}
      <CompanyModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={load}
        orgId={orgId!}
      />
      <CompanyModal
        visible={!!editTarget}
        initial={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={load}
        orgId={orgId!}
      />
      <ActionMenu
        visible={!!menuTarget}
        company={menuTarget}
        onClose={() => setMenuTarget(null)}
        onEdit={() => { setEditTarget(menuTarget); setMenuTarget(null); }}
        onToggle={() => { if (menuTarget) handleToggle(menuTarget); setMenuTarget(null); }}
        onDelete={() => { if (menuTarget) handleDelete(menuTarget); }}
      />
    </SafeAreaView>
  );
}
