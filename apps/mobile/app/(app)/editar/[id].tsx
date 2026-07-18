import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/colors";
import { useTranslation } from "react-i18next";

function Field({
  label, value, onChangeText, keyboardType = "default", placeholder, C,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: any; placeholder?: string; C: any;
}) {
  return (
    <View style={{ padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 6 }}>{label}</Text>
      <TextInput
        style={{ fontSize: 14, color: C.text, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.inputBg }}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
      />
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
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    const baseAmount = taxable ? parseFloat(taxable.replace(",", ".")) : null;
    const rate       = vatRate ? parseFloat(vatRate.replace(",", ".")) : null;
    const taxAmount  = baseAmount != null && rate != null ? baseAmount * rate / 100 : null;
    const totalVal   = amount ? parseFloat(amount.replace(",", ".")) : (baseAmount != null ? baseAmount + (taxAmount ?? 0) : null);

    await supabase.from("documents").update({
      document_number: docNumber.trim(),
      status,
      total:        totalVal,
      subtotal:     baseAmount,
      tax_rate:     rate,
      tax_amount:   taxAmount,
      issue_date:   issueDate || null,
      due_date:     dueDate   || null,
      payment_date: payDate   || null,
      notes:        notes.trim()  || null,
      description:  desc.trim()   || null,
      updated_at:   new Date().toISOString(),
    }).eq("id", id);
    setSaving(false);
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
    fontSize: 11, fontWeight: "700" as const, color: C.muted,
    letterSpacing: 1, textTransform: "uppercase" as const,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  };

  const cardStyle = {
    backgroundColor: C.surface, borderRadius: 14, marginHorizontal: 16,
    overflow: "hidden" as const, shadowColor: "#000", shadowOpacity: 0.06,
    shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={C.blue} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: C.text }}>{t("editar.title")}</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: saved ? C.green : C.blue, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : saved
                ? <><Check size={14} color="#fff" /><Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>{t("editar.saved")}</Text></>
                : <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>{t("common.save")}</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Información */}
          <Text style={sectionStyle}>{t("editar.information")}</Text>
          <View style={cardStyle}>
            <Field C={C} label={t("editar.docNumber")} value={docNumber} onChangeText={setDocNumber} placeholder="FAC-2025-0001" />
            <View style={{ padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 8 }}>{t("editar.status")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setStatus(opt.key)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                      borderWidth: 1,
                      borderColor: status === opt.key ? C.blue : C.border,
                      backgroundColor: status === opt.key ? C.blue : C.surface,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "500", color: status === opt.key ? "#fff" : C.muted }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Fechas */}
          <Text style={sectionStyle}>{t("editar.dates")}</Text>
          <View style={cardStyle}>
            <Field C={C} label={t("editar.issueDate")}   value={issueDate} onChangeText={setIssueDate} placeholder="2025-01-15" />
            <Field C={C} label={t("editar.dueDate")}     value={dueDate}   onChangeText={setDueDate}   placeholder="2025-02-15" />
            <Field C={C} label={t("editar.paymentDate")} value={payDate}   onChangeText={setPayDate}   placeholder="2025-01-20" />
          </View>

          {/* Importes */}
          <Text style={sectionStyle}>{t("editar.amounts")}</Text>
          <View style={cardStyle}>
            <Field C={C} label={t("editar.total")} value={amount}  onChangeText={setAmount}  keyboardType="numeric" placeholder="4280.00" />
            <Field C={C} label={t("editar.subtotal")} value={taxable} onChangeText={setTaxable} keyboardType="numeric" placeholder="3537.19" />
            <Field C={C} label={t("editar.taxRate")} value={vatRate} onChangeText={setVatRate} keyboardType="numeric" placeholder="21" />
          </View>

          {/* Notas */}
          <Text style={sectionStyle}>{t("editar.notes")}</Text>
          <View style={cardStyle}>
            <View style={{ padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 6 }}>{t("editar.description")}</Text>
              <TextInput
                style={{ fontSize: 14, color: C.text, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.inputBg, minHeight: 60 }}
                value={desc} onChangeText={setDesc} multiline placeholder="..." placeholderTextColor={C.muted}
              />
            </View>
            <View style={{ padding: 12, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 6 }}>{t("editar.notes")}</Text>
              <TextInput
                style={{ fontSize: 14, color: C.text, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.inputBg, minHeight: 60 }}
                value={notes} onChangeText={setNotes} multiline placeholder="..." placeholderTextColor={C.muted}
              />
            </View>
          </View>

          {/* Danger zone */}
          <View style={{ margin: 16, marginTop: 8, backgroundColor: C.redL, borderWidth: 1, borderColor: "rgba(220,38,38,.2)", borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: C.red, marginBottom: 4 }}>{t("editar.dangerZone")}</Text>
            <Text style={{ fontSize: 12, color: C.red, marginBottom: 12, opacity: 0.8 }}>{t("editar.dangerHint")}</Text>
            <TouchableOpacity
              onPress={handleCancel}
              style={{ borderWidth: 1, borderColor: C.red, borderRadius: 8, paddingVertical: 10, alignItems: "center" }}
            >
              <Text style={{ color: C.red, fontWeight: "600", fontSize: 13 }}>{t("editar.markCancelled")}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
