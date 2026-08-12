import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Download, ArrowRight, Receipt, ClipboardList } from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { APP_URL } from "@/lib/config";
import { readJson } from "@/lib/api";
import { SendEmailButton } from "@/components/SendEmailButton";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { Card, Button, Badge, type BadgeTone } from "@/components/ui";

interface Quote {
  id: string; full_number: string | null; issue_date: string | null; valid_until: string | null; status: string;
  issuer_name: string | null; issuer_cif: string | null; issuer_logo_url: string | null;
  client_name: string | null; client_cif: string | null;
  subtotal: number; discount_pct: number | null; discount_amount: number;
  tax_amount: number; retention_pct: number | null; retention_amount: number; total: number;
  notes: string | null; converted_invoice_id: string | null;
  kind: string; source_quote_id: string | null;
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
  const [opening, setOpening] = useState(false);
  // The screen is shared by quotes and delivery notes; each links to the other.
  const [related, setRelated] = useState<{ id: string; full_number: string | null } | null>(null);
  // Quotes snapshot the client's name but not their email.
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const isNote = quote?.kind === "delivery_note";

  const fmtEur = (n: number) => `${Number(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  useEffect(() => {
    (async () => {
      const { data: q } = await supabase.from("quotes").select("*").eq("id", id).single();
      const { data: ln } = await supabase.from("quote_lines").select("*").eq("quote_id", id).order("position");
      setQuote((q as Quote) ?? null); setLines((ln as Line[]) ?? []);
      if (q) {
        const { data: rel } = (q as any).kind === "delivery_note"
          ? await supabase.from("quotes").select("id, full_number").eq("id", (q as any).source_quote_id).maybeSingle()
          : await supabase.from("quotes").select("id, full_number").eq("source_quote_id", (q as any).id).maybeSingle();
        setRelated((rel as any) ?? null);
        if ((q as any).client_company_id) {
          const { data: c } = await supabase
            .from("companies").select("email").eq("id", (q as any).client_company_id).maybeSingle();
          setClientEmail((c as any)?.email ?? null);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  const sharePdf = async () => {
    const { data } = await supabase.storage.from("documents").createSignedUrl(`${orgId}/quotes/${id}.pdf`, 3600);
    if (data?.signedUrl) Linking.openURL(data.signedUrl);
    else Alert.alert(t("common.error"), t("quoting.pdfUnavailable"));
  };

  const convert = () => {
    Alert.alert(t("delivery.billTitle"), t("delivery.billBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("delivery.bill"), onPress: async () => {
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

  // Quotes finalized before albaranes existed have no note. Opening one here is
  // the only way those reach an invoice, since billing runs off the note.
  const openNote = async () => {
    setOpening(true);
    try {
      const res = await fetch(`${APP_URL}/api/quotes/delivery-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ quoteId: id }),
      });
      const json = await readJson(res);
      if (!res.ok) { Alert.alert(t("common.error"), json.detail ?? json.error ?? ""); setOpening(false); return; }
      router.replace(`/(app)/presupuesto/${json.id}`);
    } catch (e) { Alert.alert(t("common.error"), String(e)); setOpening(false); }
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.blue} /></View></SafeAreaView>;
  if (!quote) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}><Text style={{ color: C.muted, padding: spacing.xl }}>{t("quoting.notFound")}</Text></SafeAreaView>;

  const statusTone: BadgeTone = quote.status === "accepted" ? "green"
    : quote.status === "rejected" ? "red"
    : quote.status === "open" ? "yellow"
    : "blue";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.lg }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={C.text} strokeWidth={1.75} /></TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: C.text, flex: 1 }}>{quote.full_number ?? t("quoting.title")}</Text>
        <Badge label={t(`quoting.status.${quote.status}`)} tone={statusTone} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card style={{ gap: spacing.md }}>
          {/* Issuer */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            {!!quote.issuer_logo_url && (
              <Image source={{ uri: quote.issuer_logo_url }} style={{ width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.border }} resizeMode="contain" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: C.text }}>{quote.issuer_name}</Text>
              {!!quote.issuer_cif && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>CIF: {quote.issuer_cif}</Text>}
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginTop: 2 }}>{t("invoicing.issueDate")}: {quote.issue_date ?? "—"}</Text>
              {!!quote.valid_until && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>{t("quoting.validUntil")}: {quote.valid_until}</Text>}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: C.border }} />
          {/* Client */}
          <View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, textTransform: "uppercase" }}>{isNote ? t("delivery.noteFor") : t("quoting.quoteFor")}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: C.text, marginTop: 2 }}>{quote.client_name ?? "—"}</Text>
            {!!quote.client_cif && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>CIF: {quote.client_cif}</Text>}
          </View>

          <View style={{ height: 1, backgroundColor: C.border }} />
          {/* Lines */}
          {lines.map(l => (
            <View key={l.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: fonts.regular, color: C.text, flex: 1, fontSize: 13 }}>{Number(l.quantity)} × {l.description}</Text>
              <Text style={{ fontFamily: fonts.semibold, color: C.text, fontSize: 13 }}>{fmtEur(l.line_total)}</Text>
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
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>{quote.notes}</Text>
            </>
          )}
          <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: C.muted }}>{isNote ? t("delivery.disclaimer") : t("quoting.disclaimer")}</Text>
        </Card>

        {/* Actions */}
        <View style={{ gap: spacing.sm + 2 }}>
          <Button
            label={t("quoting.pdf")}
            onPress={sharePdf}
            variant="secondary"
            icon={<Download size={18} color={C.text} strokeWidth={1.75} />}
          />

          <SendEmailButton kind="quote" id={id} defaultTo={clientEmail} />

          {!isNote && !!related && (
            <Button
              label={t("delivery.goToNote", { number: related.full_number ?? "" })}
              onPress={() => router.replace(`/(app)/presupuesto/${related.id}`)}
              icon={<ArrowRight size={18} color="#fff" strokeWidth={1.75} />}
            />
          )}

          {!isNote && !related && quote.status !== "converted" && canManage && (
            <Button
              label={t("delivery.openNote")}
              onPress={openNote}
              loading={opening}
              icon={<ClipboardList size={18} color="#fff" strokeWidth={1.75} />}
            />
          )}

          {isNote && quote.status !== "converted" && canManage && (
            <Button
              label={t("delivery.bill")}
              onPress={convert}
              loading={converting}
              icon={<ArrowRight size={18} color="#fff" strokeWidth={1.75} />}
            />
          )}

          {quote.status === "converted" && !!quote.converted_invoice_id && (
            <Button
              label={t("quoting.viewInvoice")}
              onPress={() => router.push(`/(app)/factura/${quote.converted_invoice_id}`)}
              icon={<Receipt size={18} color="#fff" strokeWidth={1.75} />}
            />
          )}
        </View>
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
