import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Users, Plus, X, ArrowRight, Lock, Trash2,
  Shield, ChevronDown, Check, UserPlus,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Coachmark } from "@/components/Coachmark";
import { useTranslation } from "react-i18next";

const APP_URL = "https://archivum2704-dot.vercel.app";

const C = {
  blue: "#2563EB", blueL: "#EFF6FF",
  green: "#16A34A", greenL: "#F0FDF4",
  red:   "#DC2626", redL:  "#FEF2F2",
  bg: "#F9FAFB", surface: "#FFFFFF",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
};

type OrgRole = "owner" | "admin" | "member" | "viewer";

const ROLE_COLORS: Record<OrgRole, { bg: string; text: string; border: string }> = {
  owner:  { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  admin:  { bg: "#F0FDF4", text: "#16A34A", border: "#86EFAC" },
  member: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
  viewer: { bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
};

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Propietario", admin: "Administrador", member: "Miembro", viewer: "Visor",
};

interface Member {
  id: string;
  user_id: string;
  role: OrgRole;
  profiles: { email: string | null; first_name: string | null; last_name: string | null } | null;
}

interface PlanInfo {
  subscription_status: string;
  extra_users_quantity: number;
}

function isPaidActive(status: string) {
  return status === "active" || status === "trialing";
}

/* ── Upgrade modal ───────────────────────────────────────────────────────── */
function UpgradeModal({ visible, maxUsers, onClose }: { visible: boolean; maxUsers: number; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)" }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: 20, paddingBottom: 28 }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.blueL, alignItems: "center", justifyContent: "center" }}>
            <Lock size={26} color={C.blue} />
          </View>
        </View>
        <Text style={{ fontSize: 18, fontWeight: "800", color: C.text, textAlign: "center", paddingHorizontal: 24, marginBottom: 8 }}>
          {maxUsers === 1 ? "Límite del plan gratuito" : "Límite de usuarios alcanzado"}
        </Text>
        <Text style={{ fontSize: 14, color: C.muted, textAlign: "center", paddingHorizontal: 24, lineHeight: 20, marginBottom: 20 }}>
          {maxUsers === 1
            ? "El plan gratuito incluye 1 usuario. Actualiza a Pro para añadir hasta 5 usuarios."
            : `Has llegado a ${maxUsers} usuarios. Añade usuarios extra por 2€/usuario/mes.`}
        </Text>
        <View style={{ marginHorizontal: 24, marginBottom: 20, gap: 8 }}>
          {["Plan Gratis: 1 usuario", "Plan Pro: 5 usuarios incluidos", "+2€/mes por usuario adicional"].map((line) => (
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
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Ver planes y precios</Text>
          <ArrowRight size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 10, alignItems: "center", paddingVertical: 10 }}>
          <Text style={{ fontSize: 14, color: C.muted }}>Ahora no</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/* ── Role picker modal ───────────────────────────────────────────────────── */
function RolePicker({ visible, current, onSelect, onClose }: {
  visible: boolean; current: OrgRole; onSelect: (r: OrgRole) => void; onClose: () => void;
}) {
  const roles: OrgRole[] = ["admin", "member", "viewer"];
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)" }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: 20, paddingBottom: 28 }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 }} />
        <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, paddingHorizontal: 20, paddingBottom: 12 }}>Cambiar rol</Text>
        {roles.map((r) => {
          const rc = ROLE_COLORS[r];
          const isActive = r === current;
          return (
            <TouchableOpacity
              key={r} onPress={() => { onSelect(r); onClose(); }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}
            >
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ backgroundColor: rc.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: rc.border }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: rc.text }}>{ROLE_LABELS[r]}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {r === "admin" ? "Gestión total excepto facturación" : r === "member" ? "Acceso a empresas asignadas" : "Solo lectura"}
                </Text>
              </View>
              {isActive && <Check size={18} color={C.blue} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </Modal>
  );
}

/* ── Invite modal ────────────────────────────────────────────────────────── */
function InviteModal({ visible, orgId, token, onClose, onInvited }: {
  visible: boolean; orgId: string; token: string; onClose: () => void; onInvited: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [role,      setRole]      = useState<OrgRole>("member");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);
  const [roleOpen,  setRoleOpen]  = useState(false);

  useEffect(() => {
    if (visible) {
      setFirstName(""); setLastName(""); setEmail(""); setRole("member");
      setError(null); setSuccess(false);
    }
  }, [visible]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${APP_URL}/api/members/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), role, orgId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        const msgMap: Record<string, string> = {
          already_member:       "Este usuario ya es miembro de la organización.",
          not_authorized:       "No tienes permisos para invitar usuarios.",
          member_limit_reached: "Has alcanzado el límite de usuarios de tu plan.",
          missing_fields:       "Completa todos los campos requeridos.",
          server_error:         "Error del servidor. Inténtalo de nuevo.",
        };
        setError(msgMap[data.error] ?? data.error ?? "Error desconocido");
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); onInvited(); }, 1500);
    } catch {
      setError("Error de conexión. Comprueba tu internet.");
    }
    setLoading(false);
  };

  const rc = ROLE_COLORS[role];

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,.45)" }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: C.surface, borderRadius: 20, maxHeight: "85%", overflow: "hidden" }}>
          <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: C.text }}>Invitar usuario</Text>
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 6 }}>
              <X size={16} color={C.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 5 }}>Nombre</Text>
                <TextInput
                  style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text }}
                  placeholder="Ana" placeholderTextColor={C.muted}
                  value={firstName} onChangeText={setFirstName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 5 }}>Apellido</Text>
                <TextInput
                  style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text }}
                  placeholder="García" placeholderTextColor={C.muted}
                  value={lastName} onChangeText={setLastName}
                />
              </View>
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 5 }}>Email *</Text>
              <TextInput
                style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.text }}
                placeholder="ana@empresa.com" placeholderTextColor={C.muted}
                keyboardType="email-address" autoCapitalize="none"
                value={email} onChangeText={setEmail}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 5 }}>Rol</Text>
              <TouchableOpacity
                onPress={() => setRoleOpen(true)}
                style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <View style={{ backgroundColor: rc.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: rc.border }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: rc.text }}>{ROLE_LABELS[role]}</Text>
                </View>
                <ChevronDown size={16} color={C.muted} />
              </TouchableOpacity>
            </View>

            {error   && <Text style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>{error}</Text>}
            {success && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Check size={14} color={C.green} />
                <Text style={{ fontSize: 13, color: C.green, fontWeight: "600" }}>Invitación enviada correctamente</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleInvite}
              disabled={loading || !email.trim() || success}
              style={{ backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 16, opacity: (loading || !email.trim() || success) ? 0.6 : 1 }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Enviar invitación</Text>
              }
            </TouchableOpacity>

            <Text style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 8 }}>
              El usuario recibirá un correo para activar su cuenta.
            </Text>
          </ScrollView>
        </View>
      </Modal>
      <RolePicker visible={roleOpen} current={role} onSelect={setRole} onClose={() => setRoleOpen(false)} />
    </>
  );
}

/* ── Member card ─────────────────────────────────────────────────────────── */
function MemberCard({ member, isSelf, canManage, onRoleChange, onRemove }: {
  member: Member; isSelf: boolean; canManage: boolean;
  onRoleChange: () => void; onRemove: () => void;
}) {
  const profile = member.profiles;
  const firstName = profile?.first_name ?? "";
  const lastName  = profile?.last_name  ?? "";
  const fullName  = [firstName, lastName].filter(Boolean).join(" ") || (profile?.email ?? "Usuario");
  const initials  = ([firstName[0], lastName[0]].filter(Boolean).join("") || "U").toUpperCase();
  const rc = ROLE_COLORS[member.role];

  return (
    <View style={{
      backgroundColor: C.surface, borderRadius: 14, marginHorizontal: 16, marginBottom: 10,
      shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    }}>
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* Avatar */}
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>{initials}</Text>
          </View>

          {/* Info */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }} numberOfLines={1}>{fullName}</Text>
              {isSelf && <Text style={{ fontSize: 11, color: C.muted }}>(tú)</Text>}
            </View>
            {profile?.email && (
              <Text style={{ fontSize: 12, color: C.muted }} numberOfLines={1}>{profile.email}</Text>
            )}
          </View>

          {/* Role badge */}
          <TouchableOpacity
            onPress={canManage ? onRoleChange : undefined}
            style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: rc.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: rc.border }}
          >
            <Text style={{ fontSize: 11, fontWeight: "600", color: rc.text }}>{ROLE_LABELS[member.role]}</Text>
            {canManage && <ChevronDown size={10} color={rc.text} />}
          </TouchableOpacity>
        </View>

        {/* Actions */}
        {canManage && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
            <TouchableOpacity
              onPress={onRoleChange}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border }}
            >
              <Shield size={13} color={C.muted} />
              <Text style={{ fontSize: 12, color: C.text }}>Cambiar rol</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRemove}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: "#FECACA", backgroundColor: "#FEF2F2" }}
            >
              <Trash2 size={13} color={C.red} />
              <Text style={{ fontSize: 12, color: C.red }}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
export default function EquipoScreen() {
  const { t } = useTranslation();
  const { orgId, profile, session } = useAuth();
  const [members,      setMembers]      = useState<Member[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [plan,         setPlan]         = useState<PlanInfo | null>(null);
  const [inviteOpen,   setInviteOpen]   = useState(false);
  const [upgradeOpen,  setUpgradeOpen]  = useState(false);
  const [roleTarget,   setRoleTarget]   = useState<Member | null>(null);

  const maxUsers = plan
    ? (isPaidActive(plan.subscription_status) ? 5 + plan.extra_users_quantity : 1)
    : 1;
  const atLimit = members.length >= maxUsers;

  const currentUserId = profile?.id ?? "";
  const myMember = members.find(m => m.user_id === currentUserId);
  const isAdmin  = myMember?.role === "owner" || myMember?.role === "admin";

  const handleAddPress = () => {
    if (atLimit) { setUpgradeOpen(true); }
    else         { setInviteOpen(true);  }
  };

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    const [{ data: memberData }, { data: orgData }] = await Promise.all([
      supabase
        .from("organization_members")
        .select("id, user_id, role, profiles(email, first_name, last_name)")
        .eq("organization_id", orgId)
        .order("created_at"),
      supabase
        .from("organizations")
        .select("subscription_status, extra_users_quantity")
        .eq("id", orgId)
        .single(),
    ]);
    setMembers((memberData ?? []) as Member[]);
    if (orgData) setPlan(orgData as PlanInfo);
    setLoading(false);
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (member: Member, newRole: OrgRole) => {
    await supabase.rpc("update_member_role", {
      p_org_id:   orgId,
      p_user_id:  member.user_id,
      p_new_role: newRole,
    });
    load();
  };

  const handleRemove = (member: Member) => {
    const profile = member.profiles;
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "este usuario";
    Alert.alert(
      "Eliminar miembro",
      `¿Estás seguro de que quieres eliminar a ${name} de la organización?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar", style: "destructive",
          onPress: async () => {
            await supabase.rpc("remove_org_member", {
              p_org_id:  orgId,
              p_user_id: member.user_id,
            });
            load();
          },
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
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.text }}>Equipo</Text>
            {plan && (
              <Text style={{ fontSize: 12, color: atLimit ? C.red : C.muted, marginTop: 1 }}>
                {members.length} / {maxUsers} {maxUsers === 1 ? "usuario" : "usuarios"}
              </Text>
            )}
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={handleAddPress}
              style={{ width: 36, height: 36, backgroundColor: C.blue, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
            >
              <Plus size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {members.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
          <Users size={56} color={C.muted} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>Sin miembros</Text>
          <Text style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
            Invita a tu equipo para colaborar en Archivum.
          </Text>
          {isAdmin && (
            <TouchableOpacity
              onPress={handleAddPress}
              style={{ backgroundColor: C.blue, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Invitar usuario</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelf   = item.user_id === currentUserId;
            const canManage = isAdmin && !isSelf && item.role !== "owner";
            return (
              <MemberCard
                member={item}
                isSelf={isSelf}
                canManage={canManage}
                onRoleChange={() => setRoleTarget(item)}
                onRemove={() => handleRemove(item)}
              />
            );
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.blue} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Role legend at bottom */}
      {members.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
            Roles disponibles
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["admin", "member", "viewer"] as OrgRole[]).map((r) => {
              const rc = ROLE_COLORS[r];
              return (
                <View key={r} style={{ flex: 1, backgroundColor: rc.bg, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: rc.border }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: rc.text, marginBottom: 2 }}>{ROLE_LABELS[r]}</Text>
                  <Text style={{ fontSize: 10, color: C.muted, lineHeight: 13 }}>
                    {r === "admin" ? "Gestión total" : r === "member" ? "Acceso asignado" : "Solo lectura"}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* First-time hint */}
      <Coachmark
        id="equipo-invite-first"
        active={!loading && isAdmin && members.length <= 1}
        icon={<Users size={32} color={C.blue} />}
        title={t("coachmarks.equipoInviteFirst.title")}
        description={t("coachmarks.equipoInviteFirst.description")}
        position="bottom"
      />

      {/* Modals */}
      <UpgradeModal
        visible={upgradeOpen}
        maxUsers={maxUsers}
        onClose={() => setUpgradeOpen(false)}
      />
      <InviteModal
        visible={inviteOpen}
        orgId={orgId!}
        token={session?.access_token ?? ""}
        onClose={() => setInviteOpen(false)}
        onInvited={load}
      />
      {roleTarget && (
        <RolePicker
          visible={!!roleTarget}
          current={roleTarget.role}
          onSelect={(r) => handleRoleChange(roleTarget, r)}
          onClose={() => setRoleTarget(null)}
        />
      )}
    </SafeAreaView>
  );
}
