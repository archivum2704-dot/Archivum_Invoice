import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useColors, type Colors } from "@/lib/colors";
import { useTranslation } from "react-i18next";
import { DateField } from "@/components/DateField";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { Button, Card, Input } from "@/components/ui";
import { PaymentMethodPicker } from "@/components/PaymentMethodPicker";
import { findDocumentNumberConflict, numberConflictMessage } from "@/lib/document-number";

/** Same label treatment as Input, but the value comes from the calendar. */
function DateRow({ label, value, onChange, C }: {
  label: string; value: string; onChange: (v: string) => void; C: Colors;
}) {
  return (
    <View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text, marginBottom: spacing.xs + 2 }}>{label}</Text>
      <DateField value={value || null} onChange={(v) => onChange(v ?? "")} />
    </View>
  );
}

export default function EditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const C = useColors();
  const { t } = useTranslation();
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  // Fields
  const [docNumber, setDocNumber] = useState("");
  const [status,    setStatus]    = useState("pending");
  const [amount,    setAmount]    = useState("");
  const [taxable,   setTaxable]   = useState("");
  const [vatRate,   setVatRate]   = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate,   setDueDate]   = useState("");
  const [payDate,   setPayDate]   = useState("");
  const [notes,     setNotes]     = useState("");
  const [desc,      setDesc]      = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [docMeta,   setDocMeta]   = useState<{ orgId: string; type: string; companyId: string | null } | null>(null);
  // Set when this document is the archived PDF of an invoice issued in
  // Facturación: its number, amounts and date are frozen by VeriFactu.
  const [linkedInvoice, setLinkedInvoice] = useState<string | null>(null);

  const STATUS_OPTIONS = [
    { key: "draft",     label: t("status.draft") },
    { key: "pending",   label: t("status.pending") },
    { key: "paid",      label: t("status.paid") },
    { key: "overdue",   label: t("status.overdue") },
    { key: "cancelled", label: t("status.cancelled") },
  ];

  useEffect(() => {
    if (!id) return;
    supabase.from("documents").select("*").eq("id", id).single().then(({ data }) => {
      if (!data) return;
      setDocNumber(data.document_number ?? "");
      setStatus(data.status ?? "pending");
      setAmount(data.total != null ? String(data.total) : "");
      setTaxable(data.subtotal != null ? String(data.subtotal) : "");
      setVatRate(data.tax_rate != null ? String(data.tax_rate) : "");
      setIssueDate(data.issue_date ?? "");
      setDueDate(data.due_date ?? "");
      setPayDate(data.payment_date ?? "");
      setNotes(data.notes ?? "");
      setDesc(data.description ?? "");
      setPayMethod(data.payment_method ?? "");
      setDocMeta({ orgId: data.organization_id, type: data.document_type, companyId: data.company_id ?? null });
      setLoading(false);
    });
    supabase.from("invoices").select("full_number").eq("document_id", id).maybeSingle()
      .then(({ data }) => setLinkedInvoice((data as { full_number: string | null } | null)?.full_number ?? null));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    const baseAmount = taxable ? parseFloat(taxable.replace(",", ".")) : null;
    const rate       = vatRate ? parseFloat(vatRate.replace(",", ".")) : null;
    const taxAmount  = baseAmount != null && rate != null ? baseAmount * rate / 100 : null;
    const totalVal   = amount ? parseFloat(amount.replace(",", ".")) : (baseAmount != null ? baseAmount + (taxAmount ?? 0) : null);

    if (!linkedInvoice && docMeta) {
      const conflict = await findDocumentNumberConflict({
        orgId: docMeta.orgId, number: docNumber, documentType: docMeta.type, companyId: docMeta.companyId, excludeDocumentId: id,
      });
      if (conflict) { setSaving(false); Alert.alert(t("common.error"), numberConflictMessage(conflict, docMeta.type)); return; }
    }

    const { error } = await supabase.from("documents").update({
      // An invoice archive keeps the invoice's fiscal data untouched.
      ...(linkedInvoice ? {} : {
        document_number: docNumber.trim(),
        total:        totalVal,
        subtotal:     baseAmount,
        tax_rate:     rate,
        tax_amount:   taxAmount,
        issue_date:   issueDate || null,
      }),
      status,
      due_date:     dueDate   || null,
      payment_date: payDate   || null,
      payment_method: payMethod || null,
      notes:        notes.trim()  || null,
      description:  desc.trim()   || null,
      updated_at:   new Date().toISOString(),
    }).eq("id", id);
    setSaving(false);
    if (error) { Alert.alert(t("common.error"), error.message ?? t("editar.saveError")); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancel = () => {
    Alert.alert(t("editar.markCancelledTitle"), t("editar.markCancelledConfirm"), [
      { text: t("common.no"), style: "cancel" },
      {
        text: t("common.yes"), style: "destructive",
        onPress: async () => {
          await supabase.from("documents").update({ status: "cancelled" }).eq("id", id);
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  const sectionStyle = {
    fontFamily: fonts.bold, fontSize: 11, color: C.muted,
    letterSpacing: 1, textTransform: "uppercase" as const,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm - 2,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={C.blue} strokeWidth={1.75} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: C.text }}>{t("editar.title")}</Text>
          <Button
            label={t(saved ? "editar.saved" : "common.save")}
            onPress={handleSave}
            disabled={saving}
            loading={saving}
            icon={saved ? <Check size={14} color="#fff" strokeWidth={1.75} /> : undefined}
            size="md"
            fullWidth={false}
            style={saved ? { backgroundColor: C.green } : undefined}
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!!linkedInvoice && (
            <Card containerStyle={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.text }}>
                {t("editar.invoiceArchiveLocked", { number: linkedInvoice })}
              </Text>
            </Card>
          )}
          {/* Información */}
          <Text style={sectionStyle}>{t("editar.information")}</Text>
          <Card containerStyle={{ marginHorizontal: spacing.lg }} style={{ gap: spacing.md }}>
            <Input label={t("editar.docNumber")} value={docNumber} onChangeText={setDocNumber} placeholder="Nº" editable={!linkedInvoice} />
            <View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text, marginBottom: spacing.sm }}>{t("editar.status")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 }}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setStatus(opt.key)}
                    style={{
                      paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: status === opt.key ? C.blue : C.border,
                      backgroundColor: status === opt.key ? C.blue : C.surface,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: status === opt.key ? "#fff" : C.muted }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Card>

          {/* Fechas */}
          <Text style={sectionStyle}>{t("editar.dates")}</Text>
          <Card containerStyle={{ marginHorizontal: spacing.lg }} style={{ gap: spacing.md }}>
            {linkedInvoice
              ? <Input label={t("editar.issueDate")} value={issueDate} editable={false} />
              : <DateRow C={C} label={t("editar.issueDate")}   value={issueDate} onChange={setIssueDate} />}
            <DateRow C={C} label={t("editar.dueDate")}     value={dueDate}   onChange={setDueDate} />
            <DateRow C={C} label={t("editar.paymentDate")} value={payDate}   onChange={setPayDate} />
            <PaymentMethodPicker label={t("editar.paymentMethod")} value={payMethod} onChange={setPayMethod} />
          </Card>

          {/* Importes */}
          <Text style={sectionStyle}>{t("editar.amounts")}</Text>
          <Card containerStyle={{ marginHorizontal: spacing.lg }} style={{ gap: spacing.md }}>
            <Input label={t("editar.total")} value={amount} onChangeText={setAmount} editable={!linkedInvoice} keyboardType="numeric" placeholder="4280.00" />
            <Input label={t("editar.subtotal")} value={taxable} onChangeText={setTaxable} editable={!linkedInvoice} keyboardType="numeric" placeholder="3537.19" />
            <Input label={t("editar.taxRate")} value={vatRate} onChangeText={setVatRate} editable={!linkedInvoice} keyboardType="numeric" placeholder="21" />
          </Card>

          {/* Notas */}
          <Text style={sectionStyle}>{t("editar.notes")}</Text>
          <Card containerStyle={{ marginHorizontal: spacing.lg }} style={{ gap: spacing.md }}>
            <Input
              label={t("editar.description")}
              value={desc} onChangeText={setDesc} multiline placeholder="..."
              style={{ minHeight: 60, textAlignVertical: "top" }}
            />
            <Input
              label={t("editar.notes")}
              value={notes} onChangeText={setNotes} multiline placeholder="..."
              style={{ minHeight: 60, textAlignVertical: "top" }}
            />
          </Card>

          {/* Danger zone */}
          <View style={{ margin: spacing.lg, marginTop: spacing.sm, backgroundColor: C.redL, borderWidth: 1, borderColor: "rgba(220,38,38,.2)", borderRadius: radius.lg, padding: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: C.red, marginBottom: spacing.xs }}>{t("editar.dangerZone")}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.red, marginBottom: spacing.md, opacity: 0.8 }}>{t("editar.dangerHint")}</Text>
            <Button label={t("editar.markCancelled")} onPress={handleCancel} variant="danger" size="md" />
          </View>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
