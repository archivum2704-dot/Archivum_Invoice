import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ShieldCheck, Ban, Copy, Check, ChevronRight } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { APP_URL } from "@/lib/config";
import { readJson } from "@/lib/api";


interface Invoice {
  id: string; full_number: string | null; issue_date: string | null; state: string; kind: string;
  issuer_name: string | null; issuer_cif: string | null; issuer_logo_url: string | null;
  client_name: string | null; client_cif: string | null;
  subtotal: number; discount_pct: number | null; discount_amount: number;
  tax_amount: number; retention_pct: number | null; retention_amount: number; total: number;
  huella: string | null; qr_url: string | null;
  rectifies_invoice_id: string | null;
}
interface Line { id: string; description: string; quantity: number; unit_price: number; tax_rate: number; line_total: number; }

export default function FacturaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const C = useColors();
  const { session, orgId, isAdmin, isPaid, isPlatformAdmin } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [rectifying, setRectifying] = useState(false);
  // The credit note that annuls this invoice, if one was already issued.
  const [rectifiedBy, setRectifiedBy] = useState<{ id: string; full_number: string | null } | null>(null);
  const [huellaCopied, setHuellaCopied] = useState(false);

  const copyHuella = async () => {
    if (!invoice?.huella) return;
    await Clipboard.setStringAsync(invoice.huella);
    setHuellaCopied(true);
    setTimeout(() => setHuellaCopied(false), 1800);
  };

  const fmtEur = (n: number) => `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const load = async () => {
    const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).single();
    const { data: ln } = await supabase.from("invoice_lines").select("*").eq("invoice_id", id).order("position");
    const { data: rec } = await supabase.from("invoices")
      .select("id, full_number").eq("rectifies_invoice_id", id).maybeSingle();
    setRectifiedBy(rec ?? null);
    setInvoice(inv as Invoice); setLines((ln as Line[]) ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  // Once annulled it cannot be annulled again — the server refuses it, and
  // offering the button anyway only produces an error.
  const canRectify = invoice?.state === "issued" && invoice?.kind !== "rectifying"
    && !rectifiedBy && isAdmin && (isPaid || isPlatformAdmin);

  const rectify = () => {
    Alert.alert(t("invoicing.rectify"), t("invoicing.rectifyConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("invoicing.rectify"), style: "destructive", onPress: async () => {
        setRectifying(true);
        try {
          const res = await fetch(`${APP_URL}/api/invoices/rectify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
            body: JSON.stringify({ orgId, invoiceId: id }),
          });
          const json = await readJson(res);
          if (!res.ok) { Alert.alert(t("common.error"), json.error ?? ""); setRectifying(false); return; }
          router.replace(`/(app)/factura/${json.id}`);
        } catch (e) { Alert.alert(t("common.error"), String(e)); setRectifying(false); }
      } },
    ]);
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.blue} /></View></SafeAreaView>;
  if (!invoice) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Text style={{ color: C.muted, padding: 24 }}>{t("invoicing.notFound")}</Text></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} /></TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>{invoice.full_number}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {invoice.kind === "rectifying" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.redL, borderRadius: 12, padding: 12 }}>
            <Ban size={16} color={C.red} /><Text style={{ color: C.text, fontSize: 13, flex: 1 }}>{t("invoicing.rectificativeBanner")}</Text>
          </View>
        )}

        {!!rectifiedBy && (
          <TouchableOpacity
            onPress={() => router.replace(`/(app)/factura/${rectifiedBy.id}`)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.redL, borderRadius: 12, padding: 12 }}
          >
            <Ban size={16} color={C.red} />
            <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>
              {t("invoicing.rectifiedBanner", { number: rectifiedBy.full_number ?? "" })}
            </Text>
            <ChevronRight size={16} color={C.muted} />
          </TouchableOpacity>
        )}

        <View style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {!!invoice.issuer_logo_url && (
              <Image source={{ uri: invoice.issuer_logo_url }} style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.border }} resizeMode="contain" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: C.text }}>{invoice.issuer_name}</Text>
              {!!invoice.issuer_cif && <Text style={{ fontSize: 12, color: C.muted }}>CIF: {invoice.issuer_cif}</Text>}
              <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t("invoicing.issueDate")}: {invoice.issue_date}</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: C.border }} />
          <View>
            <Text style={{ fontSize: 11, color: C.muted, textTransform: "uppercase" }}>{t("invoicing.billTo")}</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.text, marginTop: 2 }}>{invoice.client_name}</Text>
            {!!invoice.client_cif && <Text style={{ fontSize: 12, color: C.muted }}>CIF: {invoice.client_cif}</Text>}
          </View>

          <View style={{ height: 1, backgroundColor: C.border }} />
          {lines.map(l => (
            <View key={l.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: C.text, flex: 1, fontSize: 13 }}>{Number(l.quantity)} × {l.description}</Text>
              <Text style={{ color: C.text, fontWeight: "600", fontSize: 13 }}>{fmtEur(l.line_total)}</Text>
            </View>
          ))}

          <View style={{ height: 1, backgroundColor: C.border }} />
          <Row label={t("invoicing.subtotal")} value={fmtEur(invoice.subtotal)} C={C} />
          {Number(invoice.discount_amount) !== 0 && <Row label={`${t("invoicing.discount")} (${Number(invoice.discount_pct) || 0}%)`} value={`−${fmtEur(invoice.discount_amount)}`} C={C} />}
          <Row label={t("invoicing.iva")} value={fmtEur(invoice.tax_amount)} C={C} />
          {Number(invoice.retention_amount) !== 0 && <Row label={`${t("invoicing.retention")} (${Number(invoice.retention_pct) || 0}%)`} value={`−${fmtEur(invoice.retention_amount)}`} C={C} />}
          <Row label={t("invoicing.total")} value={fmtEur(invoice.total)} C={C} bold />
        </View>

        {/* Verifactu block */}
        <View style={{ backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={16} color={C.green} /><Text style={{ fontWeight: "800", color: C.text, letterSpacing: 0.5 }}>VERI*FACTU</Text>
            </View>
            <Text style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{t("invoicing.verifactuFooter")}</Text>
            {!!invoice.huella && (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 4 }}>
                <Text style={{ flex: 1, fontSize: 9, color: C.muted, fontFamily: "monospace" }}>{t("invoicing.fingerprint")}: {invoice.huella}</Text>
                <TouchableOpacity onPress={copyHuella} hitSlop={8}>
                  {huellaCopied ? <Check size={14} color={C.green} /> : <Copy size={14} color={C.muted} />}
                </TouchableOpacity>
              </View>
            )}
          </View>
          {!!invoice.qr_url && (
            <View style={{ backgroundColor: "#fff", padding: 6, borderRadius: 8 }}>
              <QRCode value={invoice.qr_url} size={84} />
            </View>
          )}
        </View>

        {canRectify && (
          <TouchableOpacity onPress={rectify} disabled={rectifying} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, opacity: rectifying ? 0.6 : 1 }}>
            {rectifying ? <ActivityIndicator color={C.text} /> : <Ban size={18} color={C.text} />}
            <Text style={{ color: C.text, fontWeight: "600" }}>{t("invoicing.rectify")}</Text>
          </TouchableOpacity>
        )}
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
