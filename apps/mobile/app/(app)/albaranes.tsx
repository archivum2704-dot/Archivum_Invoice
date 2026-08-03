import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, RefreshControl,
  ActivityIndicator, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Truck, Download, ArrowRight, FileText } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { APP_URL } from "@/lib/config";
import { readJson } from "@/lib/api";
import { RequirePermission } from "@/components/RequirePermission";

interface Note {
  id: string;
  full_number: string | null;
  client_name: string | null;
  total: number;
  status: string;
  issue_date: string | null;
}

const fmtEur = (n: number) =>
  `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/**
 * Albaranes — the step between a quote and its invoice.
 *
 * One is opened automatically when a quote is finalized, so nothing is created
 * here. Billing happens only from this screen, which keeps a single path from
 * a quote to an invoice.
 */
function AlbaranesContent() {
  const { t } = useTranslation();
  const C = useColors();
  const { orgId, session, isAdmin } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    const { data } = await supabase
      .from("quotes")
      .select("id, full_number, client_name, total, status, issue_date")
      .eq("organization_id", orgId)
      .eq("kind", "delivery_note")
      .order("created_at", { ascending: false });
    setNotes((data ?? []) as unknown as Note[]);
    setLoading(false);
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const bill = (n: Note) => {
    Alert.alert(t("delivery.billTitle"), t("delivery.billBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("delivery.bill"),
        onPress: async () => {
          setBusyId(n.id);
          try {
            const res = await fetch(`${APP_URL}/api/quotes/convert`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
              body: JSON.stringify({ quoteId: n.id }),
            });
            const json = await readJson(res);
            if (!res.ok) { Alert.alert(t("common.error"), json.detail ?? json.error ?? ""); return; }
            await load();
            router.push(`/(app)/factura/${json.invoiceId}`);
          } catch (e) {
            Alert.alert(t("common.error"), String(e));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const statusOf = (s: string) =>
    s === "converted"
      ? { label: t("delivery.states.converted"), color: C.blue }
      : { label: t("delivery.states.open"), color: C.yellow };

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: C.text }}>{t("delivery.title")}</Text>
          <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t("delivery.subtitle")}</Text>
        </View>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.blue} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 60, gap: 10 }}>
            <FileText size={38} color={C.muted} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{t("delivery.emptyTitle")}</Text>
            <Text style={{ fontSize: 12, color: C.muted, textAlign: "center", paddingHorizontal: 30 }}>
              {t("delivery.emptyBody")}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const st = statusOf(item.status);
          const busy = busyId === item.id;
          return (
            <View style={{
              backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border,
              padding: 14, gap: 10, opacity: busy ? 0.5 : 1,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: C.text }}>{item.full_number ?? "—"}</Text>
                  <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {item.client_name ?? "—"} · {item.issue_date ?? ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>{fmtEur(item.total)}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: st.color }}>{st.label}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`${APP_URL}/api/quotes/pdf?id=${item.id}`)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
                >
                  <Download size={14} color={C.muted} />
                  <Text style={{ fontSize: 12, color: C.text }}>PDF</Text>
                </TouchableOpacity>

                {isAdmin && item.status !== "converted" && (
                  <TouchableOpacity
                    onPress={() => bill(item)}
                    disabled={busy}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: C.blueMed, backgroundColor: C.blueL, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
                  >
                    {busy ? <ActivityIndicator size="small" color={C.blue} /> : <ArrowRight size={14} color={C.blue} />}
                    <Text style={{ fontSize: 12, fontWeight: "600", color: C.blue }}>{t("delivery.bill")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

export default function AlbaranesScreen() {
  return (
    <RequirePermission section="albaranes">
      <AlbaranesContent />
    </RequirePermission>
  );
}
