import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, RefreshControl,
  ActivityIndicator, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Truck, Download, ArrowRight } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { APP_URL } from "@/lib/config";
import { readJson } from "@/lib/api";
import { RequirePermission } from "@/components/RequirePermission";
import { Badge, Button, Card, EmptyState, type BadgeTone } from "@/components/ui";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { formatMoney } from "@/lib/currency";
import { getStockWarnings, type StockWarning } from "@/lib/stock";
import { confirmStockWarnings } from "@/lib/stock-warning-alert";

interface Note {
  id: string;
  full_number: string | null;
  client_name: string | null;
  total: number;
  status: string;
  issue_date: string | null;
  currency: string;
}
interface StockProduct {
  id: string; name: string; unit: string;
  track_stock: boolean; stock_qty: number; min_stock: number | null;
}

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
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    const [{ data }, { data: pr }] = await Promise.all([
      supabase
        .from("quotes")
        .select("id, full_number, client_name, total, status, issue_date, currency")
        .eq("organization_id", orgId)
        .eq("kind", "delivery_note")
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select("id, name, unit, track_stock, stock_qty, min_stock")
        .eq("organization_id", orgId),
    ]);
    setNotes((data ?? []) as unknown as Note[]);
    setProducts((pr ?? []) as unknown as StockProduct[]);
    setLoading(false);
    setRefreshing(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const doBill = async (n: Note) => {
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
  };

  const bill = (n: Note) => {
    Alert.alert(t("delivery.billTitle"), t("delivery.billBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("delivery.bill"),
        onPress: async () => {
          const { data: quoteLines } = await supabase
            .from("quote_lines").select("product_id, quantity").eq("quote_id", n.id);
          const warnings: StockWarning[] = getStockWarnings(
            (quoteLines ?? []).map(l => ({ productId: l.product_id, quantity: Number(l.quantity) })),
            products,
          );
          if (warnings.length) {
            confirmStockWarnings(t, warnings, () => doBill(n));
            return;
          }
          await doBill(n);
        },
      },
    ]);
  };

  const statusOf = (s: string): { label: string; tone: BadgeTone } =>
    s === "converted"
      ? { label: t("delivery.states.converted"), tone: "blue" }
      : { label: t("delivery.states.open"), tone: "yellow" };

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} strokeWidth={1.75} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: 22, color: C.text }}>{t("delivery.title")}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginTop: 2 }}>{t("delivery.subtitle")}</Text>
        </View>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.sm + 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.blue} />}
        ListEmptyComponent={
          <EmptyState
            icon={<Truck size={28} color={C.muted} strokeWidth={1.5} />}
            title={t("delivery.emptyTitle")}
            subtitle={t("delivery.emptyBody")}
          />
        }
        renderItem={({ item }) => {
          const st = statusOf(item.status);
          const busy = busyId === item.id;
          return (
            <Card containerStyle={{ opacity: busy ? 0.5 : 1 }} style={{ gap: spacing.sm + 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: C.text }}>{item.full_number ?? "—"}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginTop: 2 }}>
                    {item.client_name ?? "—"} · {item.issue_date ?? ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: C.text }}>{formatMoney(item.total, item.currency)}</Text>
                  <Badge label={st.label} tone={st.tone} />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button
                  label="PDF"
                  onPress={() => Linking.openURL(`${APP_URL}/api/quotes/pdf?id=${item.id}`)}
                  variant="secondary"
                  size="md"
                  fullWidth={false}
                  icon={<Download size={14} color={C.muted} strokeWidth={1.75} />}
                />

                {isAdmin && item.status !== "converted" && (
                  <Button
                    label={t("delivery.bill")}
                    onPress={() => bill(item)}
                    disabled={busy}
                    loading={busy}
                    variant="ghost"
                    size="md"
                    fullWidth={false}
                    icon={<ArrowRight size={14} color={C.blue} strokeWidth={1.75} />}
                    style={{ backgroundColor: C.blueL, borderWidth: 1, borderColor: C.blueMed }}
                  />
                )}
              </View>
            </Card>
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
