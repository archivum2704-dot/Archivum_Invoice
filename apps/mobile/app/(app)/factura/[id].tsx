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
import { SendEmailButton } from "@/components/SendEmailButton";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { Card, Button } from "@/components/ui";
import { formatMoney, needsExchangeRate, toEur } from "@/lib/currency";


interface Invoice {
  id: string; full_number: string | null; issue_date: string | null; state: string; kind: string;
  issuer_name: string | null; issuer_cif: string | null; issuer_logo_url: string | null;
  client_name: string | null; client_cif: string | null;
  subtotal: number; discount_pct: number | null; discount_amount: number;
  tax_amount: number; retention_pct: number | null; retention_amount: number; total: number;
  currency: string; exchange_rate: number | null;
  huella: string | null; qr_url: string | null;
  rectifies_invoice_id: string | null;
  // Si el registro llegó o no a la AEAT. Sin esto la leyenda VERI*FACTU
  // afirmaba que la factura era verificable allí sin saber si lo era.
  verifactu_status: string | null; aeat_csv: string | null;
  aeat_error: string | null; submitted_at: string | null;
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
  // The invoice snapshots the client's name and CIF but not their email, so the
  // address to send it to comes from the client record.
  const [clientEmail, setClientEmail] = useState<string | null>(null);

  const copyHuella = async () => {
    if (!invoice?.huella) return;
    await Clipboard.setStringAsync(invoice.huella);
    setHuellaCopied(true);
    setTimeout(() => setHuellaCopied(false), 1800);
  };

  const fmtEur = (n: number) => formatMoney(Number(n) || 0, invoice?.currency ?? "EUR");

  const load = async () => {
    const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).single();
    const { data: ln } = await supabase.from("invoice_lines").select("*").eq("invoice_id", id).order("position");
    const { data: rec } = await supabase.from("invoices")
      .select("id, full_number").eq("rectifies_invoice_id", id).maybeSingle();
    setRectifiedBy(rec ?? null);
    if (inv?.client_company_id) {
      const { data: c } = await supabase
        .from("companies").select("email").eq("id", inv.client_company_id).maybeSingle();
      setClientEmail((c as { email: string | null } | null)?.email ?? null);
    }
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
  if (!invoice) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Text style={{ color: C.muted, padding: spacing.xl }}>{t("invoicing.notFound")}</Text></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.lg }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} strokeWidth={1.75} /></TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: C.text }}>{invoice.full_number}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {invoice.kind === "rectifying" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.redL, borderRadius: radius.md, padding: spacing.md }}>
            <Ban size={16} color={C.red} strokeWidth={1.75} /><Text style={{ fontFamily: fonts.regular, color: C.text, fontSize: 13, flex: 1 }}>{t("invoicing.rectificativeBanner")}</Text>
          </View>
        )}

        {!!rectifiedBy && (
          <TouchableOpacity
            onPress={() => router.replace(`/(app)/factura/${rectifiedBy.id}`)}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.redL, borderRadius: radius.md, padding: spacing.md }}
          >
            <Ban size={16} color={C.red} strokeWidth={1.75} />
            <Text style={{ fontFamily: fonts.regular, color: C.text, fontSize: 13, flex: 1 }}>
              {t("invoicing.rectifiedBanner", { number: rectifiedBy.full_number ?? "" })}
            </Text>
            <ChevronRight size={16} color={C.muted} strokeWidth={1.75} />
          </TouchableOpacity>
        )}

        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            {!!invoice.issuer_logo_url && (
              <Image source={{ uri: invoice.issuer_logo_url }} style={{ width: 44, height: 44, borderRadius: radius.sm + 2, borderWidth: 1, borderColor: C.border }} resizeMode="contain" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: C.text }}>{invoice.issuer_name}</Text>
              {!!invoice.issuer_cif && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>CIF: {invoice.issuer_cif}</Text>}
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginTop: 2 }}>{t("invoicing.issueDate")}: {invoice.issue_date}</Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: C.border }} />
          <View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, textTransform: "uppercase" }}>{t("invoicing.billTo")}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: C.text, marginTop: 2 }}>{invoice.client_name}</Text>
            {!!invoice.client_cif && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>CIF: {invoice.client_cif}</Text>}
          </View>

          <View style={{ height: 1, backgroundColor: C.border }} />
          {lines.map(l => (
            <View key={l.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: fonts.regular, color: C.text, flex: 1, fontSize: 13 }}>{Number(l.quantity)} × {l.description}</Text>
              <Text style={{ fontFamily: fonts.semibold, color: C.text, fontSize: 13 }}>{fmtEur(l.line_total)}</Text>
            </View>
          ))}

          <View style={{ height: 1, backgroundColor: C.border }} />
          <Row label={t("invoicing.subtotal")} value={fmtEur(invoice.subtotal)} C={C} />
          {Number(invoice.discount_amount) !== 0 && <Row label={`${t("invoicing.discount")} (${Number(invoice.discount_pct) || 0}%)`} value={`−${fmtEur(invoice.discount_amount)}`} C={C} />}
          <Row label={t("invoicing.iva")} value={fmtEur(invoice.tax_amount)} C={C} />
          {Number(invoice.retention_amount) !== 0 && <Row label={`${t("invoicing.retention")} (${Number(invoice.retention_pct) || 0}%)`} value={`−${fmtEur(invoice.retention_amount)}`} C={C} />}
          <Row label={t("invoicing.total")} value={fmtEur(invoice.total)} C={C} bold />
          {needsExchangeRate(invoice.currency) && invoice.exchange_rate != null && (
            <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: C.muted, textAlign: "right" }}>
              1 {invoice.currency} = {Number(invoice.exchange_rate).toFixed(4).replace(".", ",")} € · {formatMoney(toEur(Number(invoice.total), invoice.currency, invoice.exchange_rate), "EUR")}
            </Text>
          )}
        </Card>

        {/* Verifactu block. Igual que en web: sin huella no hay registro que
            cotejar, y la leyenda afirmaria algo que no existe. */}
        {!!invoice.huella && (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md + 2 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={16} color={C.green} strokeWidth={1.75} /><Text style={{ fontFamily: fonts.extrabold, color: C.text, letterSpacing: 0.5 }}>VERI*FACTU</Text>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: C.muted, marginTop: 4 }}>{t("invoicing.verifactuFooter")}</Text>
            {/* La leyenda de arriba dice que la factura es verificable en la
                AEAT, y hasta que el registro se acepta no lo es. Se dice sin
                rodeos, igual que en la web: quien factura desde el móvil no
                debería ser el último en enterarse de un rechazo. */}
            <Text style={{
              fontFamily: fonts.semibold, fontSize: 10, marginTop: 4,
              color: invoice.verifactu_status === "sent" ? C.green
                : invoice.verifactu_status === "error" ? C.red
                : C.yellow,
            }}>
              {invoice.verifactu_status === "sent"
                ? `${t("invoicing.aeatSent")}${invoice.aeat_csv ? ` · CSV ${invoice.aeat_csv}` : ""}`
                : invoice.verifactu_status === "error"
                  ? `${t("invoicing.aeatError")}${invoice.aeat_error ? `: ${invoice.aeat_error}` : ""}`
                  : t("invoicing.aeatPending")}
            </Text>
            {!!invoice.huella && (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 4 }}>
                <Text style={{ flex: 1, fontSize: 9, color: C.muted, fontFamily: fonts.mono }}>{t("invoicing.fingerprint")}: {invoice.huella}</Text>
                <TouchableOpacity onPress={copyHuella} hitSlop={8}>
                  {huellaCopied ? <Check size={14} color={C.green} strokeWidth={1.75} /> : <Copy size={14} color={C.muted} strokeWidth={1.75} />}
                </TouchableOpacity>
              </View>
            )}
          </View>
          {!!invoice.qr_url && (
            <View style={{ backgroundColor: "#fff", padding: 6, borderRadius: radius.sm }}>
              <QRCode value={invoice.qr_url} size={84} />
            </View>
          )}
        </Card>
        )}

        <SendEmailButton kind="invoice" id={id} defaultTo={clientEmail} />

        {canRectify && (
          <Button
            label={t("invoicing.rectify")}
            onPress={rectify}
            loading={rectifying}
            variant="secondary"
            icon={<Ban size={18} color={C.text} strokeWidth={1.75} />}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, C, bold }: any) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontFamily: bold ? fonts.bold : fonts.regular, color: bold ? C.text : C.muted, fontSize: bold ? 16 : 14 }}>{label}</Text>
      <Text style={{ fontFamily: bold ? fonts.bold : fonts.regular, color: C.text, fontSize: bold ? 16 : 14 }}>{value}</Text>
    </View>
  );
}
