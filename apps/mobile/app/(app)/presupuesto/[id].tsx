import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Download, ArrowRight, Receipt } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { APP_URL } from "@/lib/config";
import { readJson } from "@/lib/api";

interface Quote {
  id: string; full_number: string | null; issue_date: string | null; valid_until: string | null; status: string;
  issuer_name: string | null; issuer_cif: string | null; issuer_logo_url: string | null;
  client_name: string | null; client_cif: string | null;
  subtotal: number; discount_pct: number | null; discount_amount: number;
  tax_amount: number; retention_pct: number | null; retention_amount: number; total: number;
  notes: string | null; converted_invoice_id: string | null;
}
interface Line { id: string; description: string; quantity: number; unit_price: number; line_total: number; }

export default function PresupuestoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const C = useColors();
  const { session, orgId, isAdmin, isPaid, isPlatformAdmin } = useAuth();
  const canManage = isAdmin && (isPaid || isPlatformAdmin);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const fmtEur = (n: number) => `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  useEffect(() => {
    (async () => {
      const { data: q } = await supabase.from("quotes").select("*").eq("id", id).single();
      const { data: ln } = await supabase.from("quote_lines").select("*").eq("quote_id", id).order("position");
      setQuote((q as Quote) ?? null); setLines((ln as Line[]) ?? []); setLoading(false);
    })();
  }, [id]);

  const sharePdf = async () => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(`${orgId}/quotes/${id}.pdf`, 3600);
    if (data?.signedUrl) Linking.openURL(data.signedUrl);
    else Alert.alert(t("common.error"), t("quoting.pdfUnavailable"));
  };

  const convert = () => {
    Alert.alert(t("quoting.convertTitle"), t("quoting.convertBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("quoting.convert"), onPress: async () => {
        setConverting(true);
        try {
          const res = await fetch(`${APP_URL}/api/quotes/convert`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
            body: JSON.stringify({ quoteId: id }),
          });
          const json = await readJson(res);
          if (!res.ok) { Alert.alert(t("common.error"), json.detail ?? json.error ?? ""); setConverting(false); return; }
          router.replace(`/(app)/factura/${json.invoiceId}`);
        } catch (e) { Alert.alert(t("common.error"), String(e)); setConverting(false); }
      } },
    ]);
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.blue} /></View></SafeAreaView>;
  if (!quote) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Text style={{ color: C.muted, padding: 24 }}>{t("quoting.notFound")}</Text></SafeAreaView>;

  const statusColor = quote.status === "accepted" ? C.green : quote.status === "rejected" ? C.red : C.blue;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} /></TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "700", color: C.text, flex: 1 }}>{quote.full_number ?? t("quoting.title")}</Text>
        <Text style={{ fontSize: 12, fontWeight: "700", color: statusColor }}>{t(`quoting.status.${quote.status}`)}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 }}>
          {/* Issuer */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {!!quote.issuer_logo_url && (
              <Image source={{ uri: quote.issuer_logo_url }} style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.border }} resizeMode="contain" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{quote.issuer_name}</Text>
              {!!quote.issuer_cif && <Text style={{ fontSize: 12, color: C.muted }}>CIF: {quote.issuer_cif}</Text>}
              <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t("invoicing.issueDate")}: {quote.issue_date ?? "—"}</Text>
              {!!quote.valid_until && <Text style={{ fontSize: 12, color: C.muted }}>{t("quoting.validUntil")}: {quote.valid_until}</Text>}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: C.border }} />
          {/* Client */}
          <View>
            <Text style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>{t("quoting.quoteFor")}</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, marginTop: 2 }}>{quote.client_name ?? "—"}</Text>
            {!!quote.client_cif && <Text style={{ fontSize: 12, color: C.muted }}>CIF: {quote.client_cif}</Text>}
          </View>

          <View style={{ height: 1, backgroundColor: C.border }} />
          {/* Lines */}
          {lines.map(l => (
            <View key={l.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: C.text, flex: 1, fontSize: 13 }}>{Number(l.quantity)} × {l.description}</Text>
              <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }}>{fmtEur(l.line_total)}</Text>
            </View>
          ))}

          <View style={{ height: 1, backgroundColor: C.border }} />
          {/* Totals */}
          <Row label={t("invoicing.subtotal")} value={fmtEur(quote.subtotal)} C={C} />
          {Number(quote.discount_amount) !== 0 && <Row label={`${t("invoicing.discount")} (${Number(quote.discount_pct) || 0}%)`} value={`−${fmtEur(quote.discount_amount)}`} C={C} />}
          <Row label={t("invoicing.iva")} value={fmtEur(quote.tax_amount)} C={C} />
          {Number(quote.retention_amount) !== 0 && <Row label={`${t("invoicing.retention")} (${Number(quote.retention_pct) || 0}%)`} value={`−${fmtEur(quote.retention_amount)}`} C={C} />}
          <Row label={t("invoicing.total")} value={fmtEur(quote.total)} C={C} bold />

          {!!quote.notes && (
            <>
              <View style={{ height: 1, backgroundColor: C.border }} />
              <Text style={{ fontSize: 12, color: C.muted }}>{quote.notes}</Text>
            </>
          )}
          <Text style={{ fontSize: 10, color: C.muted }}>{t("quoting.disclaimer")}</Text>
        </View>

        {/* Actions */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity onPress={sharePdf} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14 }}>
            <Download size={18} color={C.text} /><Text style={{ color: C.text, fontWeight: "600", fontSize: 15 }}>{t("quoting.pdf")}</Text>
          </TouchableOpacity>

          {quote.status !== "converted" && canManage && (
            <TouchableOpacity onPress={convert} disabled={converting} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.blue, borderRadius: 12, paddingVertical: 15, opacity: converting ? 0.6 : 1 }}>
              {converting ? <ActivityIndicator color="#fff" /> : <ArrowRight size={18} color="#fff" />}
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("quoting.convert")}</Text>
            </TouchableOpacity>
          )}

          {quote.status === "converted" && !!quote.converted_invoice_id && (
            <TouchableOpacity onPress={() => router.push(`/(app)/factura/${quote.converted_invoice_id}`)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.blue, borderRadius: 12, paddingVertical: 15 }}>
              <Receipt size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("quoting.viewInvoice")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, C, bold }: any) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: bold ? C.text : C.muted, fontWeight: bold ? "700" : "400", fontSize: bold ? 16 : 14 }}>{label}</Text>
      <Text style={{ color: C.text, fontWeight: bold ? "700" : "400", fontSize: bold ? 16 : 14 }}>{value}</Text>
    </View>
  );
}
