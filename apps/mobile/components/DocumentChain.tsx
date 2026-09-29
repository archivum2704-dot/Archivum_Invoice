import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ClipboardList, Truck, Receipt, ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { quoteStatusKey } from "@/lib/quote-status";

type Kind = "quote" | "delivery_note" | "invoice";
type Step = { id: string; number: string | null; labelKey: string; route: string } | null;
type Chain = { quote: Step; note: Step; invoice: Step };

/**
 * Follow the Pedido → Albarán → Factura links from any one of them.
 * Espejo de `apps/web/components/document-chain.tsx` (WEB-007).
 */
async function loadChain(kind: Kind, id: string): Promise<Chain> {
  const cols = "id, full_number, status, kind, source_quote_id, converted_invoice_id";
  let quote: any = null, note: any = null, invoiceId: string | null = null;

  if (kind === "invoice") {
    invoiceId = id;
    ({ data: note } = await supabase.from("quotes").select(cols).eq("converted_invoice_id", id).eq("kind", "delivery_note").maybeSingle());
  } else if (kind === "delivery_note") {
    ({ data: note } = await supabase.from("quotes").select(cols).eq("id", id).maybeSingle());
  } else {
    ({ data: quote } = await supabase.from("quotes").select(cols).eq("id", id).maybeSingle());
    ({ data: note } = await supabase.from("quotes").select(cols).eq("source_quote_id", id).eq("kind", "delivery_note").maybeSingle());
  }
  if (note && !quote && note.source_quote_id) {
    ({ data: quote } = await supabase.from("quotes").select(cols).eq("id", note.source_quote_id).maybeSingle());
  }
  if (note?.converted_invoice_id) invoiceId = note.converted_invoice_id;

  let invoice: any = null;
  // select("*"): works whether or not the payment/sent columns exist yet.
  if (invoiceId) ({ data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle());

  return {
    quote: quote ? { id: quote.id, number: quote.full_number, labelKey: `quoteStatus.${quoteStatusKey("quote", quote.status)}`, route: `/(app)/presupuesto/${quote.id}` } : null,
    note: note ? { id: note.id, number: note.full_number, labelKey: `quoteStatus.${quoteStatusKey("delivery_note", note.status)}`, route: `/(app)/presupuesto/${note.id}` } : null,
    invoice: invoice ? {
      id: invoice.id, number: invoice.full_number,
      labelKey: invoice.payment_date ? "invoicing.states.paid" : invoice.sent_at ? "invoicing.states.sent" : "invoicing.states.issued",
      route: `/(app)/factura/${invoice.id}`,
    } : null,
  };
}

export function DocumentChain({ kind, id }: { kind: Kind; id: string }) {
  const { t } = useTranslation();
  const C = useColors();
  const [chain, setChain] = useState<Chain | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadChain(kind, id).then(c => { if (!cancelled) setChain(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, [kind, id]);

  if (!chain) return null;
  // An invoice issued directly, with no order behind it, has no chain.
  if (kind === "invoice" && !chain.note && !chain.quote) return null;

  const steps = [
    { key: "quote" as const, title: t("chain.quote"), Icon: ClipboardList, step: chain.quote },
    { key: "delivery_note" as const, title: t("chain.note"), Icon: Truck, step: chain.note },
    { key: "invoice" as const, title: t("chain.invoice"), Icon: Receipt, step: chain.invoice },
  ];

  return (
    <View style={{ gap: 6 }}>
      {steps.map((s, i) => {
        const current = s.key === kind;
        const body = (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: spacing.sm,
            paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radius.md,
            borderWidth: 1, borderStyle: s.step ? "solid" : "dashed",
            borderColor: current ? C.blue : C.border,
            backgroundColor: current ? C.blueL : C.surface,
          }}>
            <s.Icon size={16} color={current ? C.blue : C.muted} strokeWidth={1.75} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: s.step ? C.text : C.muted }}>{s.title}</Text>
            <Text style={{ flex: 1, fontFamily: fonts.mono, fontSize: 12, color: s.step ? C.text : C.muted }} numberOfLines={1}>
              {s.step?.number ?? (s.key === "invoice" ? t("chain.notInvoiced") : "—")}
            </Text>
            {!!s.step && <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>{t(s.step.labelKey)}</Text>}
            {!!s.step && !current && <ChevronRight size={15} color={C.muted} strokeWidth={1.75} />}
          </View>
        );
        return (
          <View key={s.key}>
            {s.step && !current
              ? <TouchableOpacity onPress={() => router.push(s.step!.route as any)}>{body}</TouchableOpacity>
              : body}
            {i < steps.length - 1 && <View style={{ width: 1, height: 6, backgroundColor: C.border, marginLeft: spacing.md + 7, marginTop: 6 }} />}
          </View>
        );
      })}
    </View>
  );
}
