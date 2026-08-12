import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Users, Plus, X, Lock, Trash2,
  Shield, ChevronDown, Check,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Coachmark } from "@/components/Coachmark";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { BillingNotice } from "@/components/BillingNotice";
import { APP_URL } from "@/lib/config";
import { resolveEntitlements } from "@/lib/pricing";
import { RequirePermission } from "@/components/RequirePermission";
import { KeyboardModal } from "@/components/KeyboardModal";
import { readJson } from "@/lib/api";
import { Badge, type BadgeTone, Button, Card, EmptyState, Input } from "@/components/ui";


type OrgRole = "owner" | "admin" | "member" | "viewer";

const ROLE_TONE: Record<OrgRole, BadgeTone> = {
  owner: "blue", admin: "green", member: "yellow", viewer: "neutral",
};

function getRoleColors(C: any): Record<OrgRole, { bg: string; text: string; border: string }> {
  return {
    owner:  { bg: C.blueL, text: C.blue, border: C.blueMed },
    admin:  { bg: C.greenL, text: C.green, border: C.green },
    member: { bg: C.yellowL, text: C.yellow, border: C.yellow },
    viewer: { bg: C.segmentBg, text: C.muted, border: C.border },
  };
}

interface Member {
  id: string;
  user_id: string;
  role: OrgRole;
  profiles: { email: string | null; first_name: string | null; last_name: string | null } | null;
}

interface PlanInfo {
  subscription_status: string;
  extra_users_quantity: number;
  subscription_plan: string;
}

/* ── Upgrade modal ───────────────────────────────────────────────────────── */
function UpgradeModal({ visible, maxUsers, onClose, C, t }: { visible: boolean; maxUsers: number; onClose: () => void; C: any; t: any }) {
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
          {maxUsers === 1 ? t("equipo.limitFree") : t("equipo.limitReached")}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted, textAlign: "center", paddingHorizontal: spacing.xl, lineHeight: 20, marginBottom: spacing.xl - 4 }}>
          {maxUsers === 1 ? t("equipo.limitDescFree") : t("equipo.limitDescPaid", { max: maxUsers })}
        </Text>
        <View style={{ marginHorizontal: spacing.xl, marginBottom: spacing.xl - 4, gap: spacing.sm }}>
          {[t("equipo.limitBullet1"), t("equipo.limitBullet2"), t("equipo.limitBullet3")].map((line) => (
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

/* ── Role picker modal ───────────────────────────────────────────────────── */
function RolePicker({ visible, current, onSelect, onClose, C, t }: {
  visible: boolean; current: OrgRole; onSelect: (r: OrgRole) => void; onClose: () => void; C: any; t: any;
}) {
  const roles: OrgRole[] = ["admin", "member", "viewer"];
  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, paddingBottom: spacing.xl + 4 }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.sm }} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: C.text, paddingHorizontal: spacing.xl - 4, paddingBottom: spacing.md }}>{t("equipo.changeRole")}</Text>
        {roles.map((r) => {
          const isActive = r === current;
          return (
            <TouchableOpacity
              key={r} onPress={() => { onSelect(r); onClose(); }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl - 4, paddingVertical: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: C.border }}
            >
              <View>
                <Badge label={t(`equipo.roles.${r}`)} tone={ROLE_TONE[r]} />
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginTop: spacing.xs + 2 }}>
                  {t(`equipo.roleDesc.${r}`)}
                </Text>
              </View>
              {isActive && <Check size={18} color={C.blue} strokeWidth={1.75} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </KeyboardModal>
  );
}

/* ── Invite modal ────────────────────────────────────────────────────────── */
function InviteModal({ visible, orgId, token, onClose, onInvited, C, t }: {
  visible: boolean; orgId: string; token: string; onClose: () => void; onInvited: () => void; C: any; t: any;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [role,      setRole]      = useState<OrgRole>("member");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);
  const [created,   setCreated]   = useState<{
    email: string; password: string; accessCode: string | null; emailSent: boolean;
  } | null>(null);
  const [copied,    setCopied]    = useState(false);
  const [roleOpen,  setRoleOpen]  = useState(false);

  useEffect(() => {
    if (visible) {
      setFirstName(""); setLastName(""); setEmail(""); setRole("member");
      setError(null); setSuccess(false); setCreated(null); setCopied(false);
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
      const data = await readJson(res);
      if (!res.ok || !data.success) {
        const errKey = data.error ?? "server_error";
        setError(t(`equipo.invite.errors.${errKey}`, { defaultValue: t("common.unknownError") }));
        setLoading(false);
        return;
      }
      // New user → show generated credentials so the admin can share them.
      if (data.password) {
        setCreated({
          email: data.email, password: data.password,
          accessCode: data.accessCode ?? null, emailSent: !!data.emailSent,
        });
        onInvited();
      } else {
        setSuccess(true);
        setTimeout(() => { setSuccess(false); onClose(); onInvited(); }, 1500);
      }
    } catch {
      setError(t("equipo.invite.errors.connection"));
    }
    setLoading(false);
  };

  const copyCreds = async () => {
    if (!created) return;
    await Clipboard.setStringAsync([
      `${t("equipo.invite.emailLabel")}: ${created.email}`,
      `${t("equipo.invite.passwordLabel")}: ${created.password}`,
      created.accessCode ? `${t("equipo.invite.accessCodeLabel")}: ${created.accessCode}` : null,
    ].filter(Boolean).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
        <View style={{ backgroundColor: C.surface, borderRadius: radius.xl, maxHeight: "85%", overflow: "hidden" }}>
          <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: C.text }}>{t("equipo.invite.title")}</Text>
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: C.segmentBg, borderRadius: radius.sm, padding: 6 }}>
              <X size={16} color={C.muted} strokeWidth={1.75} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", gap: spacing.sm + 2, marginBottom: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input label={t("equipo.invite.firstName")} placeholder="Ana" value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={{ flex: 1 }}>
                <Input label={t("equipo.invite.lastName")} placeholder="García" value={lastName} onChangeText={setLastName} />
              </View>
            </View>

            <View style={{ marginBottom: spacing.md }}>
              <Input
                label={t("equipo.invite.email")}
                placeholder="ana@empresa.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={{ marginBottom: spacing.xl - 4 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text, marginBottom: 6 }}>{t("equipo.invite.role")}</Text>
              <TouchableOpacity
                onPress={() => setRoleOpen(true)}
                style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: radius.md, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.md - 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.inputBg }}
              >
                <Badge label={t(`equipo.roles.${role}`)} tone={ROLE_TONE[role]} />
                <ChevronDown size={16} color={C.muted} strokeWidth={1.75} />
              </TouchableOpacity>
            </View>

            {error   && <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.red, marginBottom: spacing.md }}>{error}</Text>}
            {success && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs + 2, marginBottom: spacing.md }}>
                <Check size={14} color={C.green} strokeWidth={1.75} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.green }}>{t("equipo.invite.success")}</Text>
              </View>
            )}

            {created && (
              <View style={{ backgroundColor: C.blueL, borderRadius: radius.md, padding: spacing.md + 2, marginBottom: spacing.lg - 2, gap: spacing.sm + 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: C.text }}>{t("equipo.invite.createdTitle")}</Text>
                <View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("equipo.invite.emailLabel")}</Text>
                  <Text selectable style={{ fontFamily: fonts.semibold, fontSize: 14, color: C.text }}>{created.email}</Text>
                </View>
                <View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("equipo.invite.passwordLabel")}</Text>
                  <Text selectable style={{ fontFamily: fonts.bold, fontSize: 15, color: C.text }}>{created.password}</Text>
                </View>
                {!!created.accessCode && (
                  <View>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("equipo.invite.accessCodeLabel")}</Text>
                    <Text selectable style={{ fontFamily: fonts.extrabold, fontSize: 18, color: C.text, letterSpacing: 3 }}>
                      {created.accessCode}
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, marginTop: spacing.xs }}>{t("equipo.invite.accessCodeHint")}</Text>
                  </View>
                )}
                {/* Whether the email actually went out. An admin who assumes it
                    did will not pass the credentials on, locking the user out. */}
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: created.emailSent ? C.green : C.yellow }}>
                  {created.emailSent
                    ? t("equipo.invite.emailSent", { email: created.email })
                    : t("equipo.invite.emailNotSent")}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t("equipo.invite.createdHint")}</Text>
              </View>
            )}

            {created ? (
              <View style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
                <Button label={copied ? t("common.copied") : t("equipo.invite.copyCreds")} onPress={copyCreds} />
                <Button label={t("common.done")} onPress={onClose} variant="secondary" />
              </View>
            ) : (
              <Button
                label={t("equipo.invite.send")}
                onPress={handleInvite}
                disabled={loading || !email.trim() || success}
                loading={loading}
                style={{ marginBottom: spacing.lg }}
              />
            )}

            {!created && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, textAlign: "center", marginBottom: spacing.sm }}>
              {t("equipo.invite.emailHint")}
            </Text>
            )}
          </ScrollView>
        </View>
      </KeyboardModal>
      <RolePicker visible={roleOpen} current={role} onSelect={setRole} onClose={() => setRoleOpen(false)} C={C} t={t} />
    </>
  );
}

/* ── Member card ─────────────────────────────────────────────────────────── */
function MemberCard({ member, isSelf, canManage, onRoleChange, onRemove, C, t }: {
  member: Member; isSelf: boolean; canManage: boolean;
  onRoleChange: () => void; onRemove: () => void; C: any; t: any;
}) {
  const profile = member.profiles;
  const firstName = profile?.first_name ?? "";
  const lastName  = profile?.last_name  ?? "";
  const fullName  = [firstName, lastName].filter(Boolean).join(" ") || (profile?.email ?? "Usuario");
  const initials  = ([firstName[0], lastName[0]].filter(Boolean).join("") || "U").toUpperCase();

  return (
    <Card containerStyle={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm + 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: "#fff" }}>{initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: C.text }} numberOfLines={1}>{fullName}</Text>
            {isSelf && <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>({t("common.you")})</Text>}
          </View>
          {profile?.email && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }} numberOfLines={1}>{profile.email}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={canManage ? onRoleChange : undefined}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
        >
          <Badge label={t(`equipo.roles.${member.role}`)} tone={ROLE_TONE[member.role]} />
          {canManage && <ChevronDown size={10} color={C.muted} strokeWidth={1.75} />}
        </TouchableOpacity>
      </View>

      {canManage && (
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm + 2, paddingTop: spacing.sm + 2, borderTopWidth: 1, borderTopColor: C.border }}>
          <TouchableOpacity
            onPress={onRoleChange}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs + 2, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1, borderColor: C.border }}
          >
            <Shield size={13} color={C.muted} strokeWidth={1.75} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.text }}>{t("equipo.changeRole")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onRemove}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs + 2, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1, borderColor: C.redL, backgroundColor: C.redL }}
          >
            <Trash2 size={13} color={C.red} strokeWidth={1.75} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.red }}>{t("equipo.removeMember")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
function EquipoScreenContent() {
  const { t } = useTranslation();
  const C = useColors();
  const { orgId, profile, session, isPlatformAdmin } = useAuth();
  const [members,      setMembers]      = useState<Member[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [plan,         setPlan]         = useState<PlanInfo | null>(null);
  const [inviteOpen,   setInviteOpen]   = useState(false);
  const [upgradeOpen,  setUpgradeOpen]  = useState(false);
  const [roleTarget,   setRoleTarget]   = useState<Member | null>(null);

  // Same resolver the server enforces with, so the counter and the refusal
  // can never disagree.
  const maxUsers = plan
    ? resolveEntitlements(plan, { isPlatformAdmin }).maxUsers
    : 999; // Don't block while the plan is loading
  const atLimit = plan != null && members.length >= maxUsers;

  const currentUserId = profile?.id ?? "";
  const myMember = members.find(m => m.user_id === currentUserId);
  // Allow admin actions if user is owner/admin in members list,
  // OR if they are the org creator (only member or no members found)
  const isAdmin  = myMember?.role === "owner" || myMember?.role === "admin"
    || (members.length <= 1 && !!orgId);

  const handleAddPress = () => {
    if (!orgId) {
      Alert.alert(t("common.error"), t("common.unknownError"));
      return;
    }
    if (atLimit) { setUpgradeOpen(true); }
    else         { setInviteOpen(true);  }
  };

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    const [{ data: memberData }, { data: orgData }] = await Promise.all([
      supabase
        .from("organization_members")
        .select("id, user_id, role, profiles:profiles!organization_members_user_id_fkey(email, first_name, last_name)")
        .eq("organization_id", orgId)
        .order("joined_at"),
      supabase
        .from("organizations")
        .select("subscription_status, extra_users_quantity, subscription_plan")
        .eq("id", orgId)
        .single(),
    ]);
    setMembers((memberData ?? []) as unknown as Member[]);
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
    const prof = member.profiles;
    const name = [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || prof?.email || "este usuario";
    Alert.alert(
      t("equipo.removeMember"),
      t("equipo.removeConfirm", { name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"), style: "destructive",
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
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text }}>{t("equipo.title")}</Text>
            {plan && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: atLimit ? C.red : C.muted, marginTop: 1 }}>
                {t("equipo.usersCount", { current: members.length, max: maxUsers })}
              </Text>
            )}
          </View>
          {isAdmin && (
            <TouchableOpacity
              onPress={handleAddPress}
              style={{ width: 36, height: 36, backgroundColor: C.blue, borderRadius: radius.md - 2, alignItems: "center", justifyContent: "center" }}
            >
              <Plus size={18} color="#fff" strokeWidth={1.75} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {members.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon={<Users size={28} color={C.muted} strokeWidth={1.5} />}
            title={t("equipo.noMembers")}
            subtitle={t("equipo.inviteHint")}
            action={isAdmin ? (
              <Button label={t("equipo.inviteUser")} onPress={handleAddPress} size="md" fullWidth={false} />
            ) : undefined}
          />
        </View>
      ) : (
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelf   = item.user_id === currentUserId;
            const canManage = isAdmin && !isSelf && item.role !== "owner";
            return (
              <MemberCard
                member={item} isSelf={isSelf} canManage={canManage}
                onRoleChange={() => setRoleTarget(item)}
                onRemove={() => handleRemove(item)}
                C={C} t={t}
              />
            );
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.blue} />}
          contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Role legend at bottom */}
      {members.length > 0 && (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.xs }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: spacing.sm }}>
            {t("equipo.availableRoles")}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {(["admin", "member", "viewer"] as OrgRole[]).map((r) => {
              const rc = getRoleColors(C)[r];
              return (
                <View key={r} style={{ flex: 1, backgroundColor: rc.bg, borderRadius: radius.sm, padding: spacing.sm, borderWidth: 1, borderColor: rc.border }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: rc.text, marginBottom: 2 }}>{t(`equipo.roles.${r}`)}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: C.muted, lineHeight: 13 }}>
                    {t(`equipo.roleLegend.${r}`)}
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
      <UpgradeModal visible={upgradeOpen} maxUsers={maxUsers} onClose={() => setUpgradeOpen(false)} C={C} t={t} />
      <InviteModal
        visible={inviteOpen} orgId={orgId!} token={session?.access_token ?? ""}
        onClose={() => setInviteOpen(false)} onInvited={load} C={C} t={t}
      />
      {roleTarget && (
        <RolePicker
          visible={!!roleTarget} current={roleTarget.role}
          onSelect={(r) => handleRoleChange(roleTarget, r)}
          onClose={() => setRoleTarget(null)} C={C} t={t}
        />
      )}
    </SafeAreaView>
  );
}

export default function EquipoScreen() {
  return (
    <RequirePermission section="equipo">
      <EquipoScreenContent />
    </RequirePermission>
  );
}
