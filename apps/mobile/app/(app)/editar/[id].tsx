import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { supabase } from "@/lib/supabase";

const C = {
  blue: "#2563EB", red: "#DC2626", redL: "#FEF2F2",
  greenL: "#F0FDF4", green: "#16A34A",
  bg: "#F9FAFB", surface: "#FFFFFF",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
};

const STATUS_OPTIONS = [
  { key: "draft",     label: "Borrador" },
  { key: "pending",   label: "Pendiente" },
  { key: "paid",      label: "Pagado" },
  { key: "overdue",   label: "Vencido" },
  { key: "cancelled", label: "Cancelado" },
];

function Field({
  label, value, onChangeText, keyboardType = "default", placeholder,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: any; placeholder?: string;
}) {
  return (
    <View style={{ padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 6 }}>{label}</Text>
      <TextInput
        style={{ fontSize: 14, color: C.text, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.surface }}
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

  useEffect(() => {
    if (!id) return;
    supabase.from("documents").select("*").eq("id", id).single().then(({ data }) => {
      if (!data) return;
      setDocNumber(data.document_number ?? "");
      setStatus(data.status ?? "pending");
      setAmount(data.amount != null ? String(data.amount) : "");
      setTaxable(data.taxable_base != null ? String(data.taxable_base) : "");
      setVatRate(data.vat_rate != null ? String(data.vat_rate) : "");
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
    await supabase.from("documents").update({
      document_number: docNumber.trim(),
      status,
      amount:       amount    ? parseFloat(amount.replace(",", "."))  : null,
      taxable_base: taxable   ? parseFloat(taxable.replace(",", ".")) : null,
      vat_rate:     vatRate   ? parseFloat(vatRate.replace(",", ".")) : null,
      issue_date:   issueDate || null,
      due_date:     dueDate   || null,
      payment_date: payDate   || null,
      notes:        notes.trim()  || null,
      description:  desc.trim()   || null,
    }).eq("id", id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancel = () => {
    Alert.alert("Marcar como cancelado", "¿Estás seguro? El estado cambiará a cancelado.", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, cancelar", style: "destructive",
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={C.blue} />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: "700", color: C.text }}>Editar documento</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: saved ? C.green : C.blue, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : saved
                ? <><Check size={14} color="#fff" /><Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Guardado</Text></>
                : <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Guardar</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Información */}
          <Text style={sectionStyle}>Información</Text>
          <View style={cardStyle}>
            <Field label="Número de documento" value={docNumber} onChangeText={setDocNumber} placeholder="FAC-2025-0001" />
            <View style={{ padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 8 }}>Estado</Text>
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
          <Text style={sectionStyle}>Fechas</Text>
          <View style={cardStyle}>
            <Field label="Fecha de emisión"    value={issueDate} onChangeText={setIssueDate} placeholder="2025-01-15" />
            <Field label="Fecha de vencimiento" value={dueDate}   onChangeText={setDueDate}   placeholder="2025-02-15" />
            <Field label="Fecha de pago"        value={payDate}   onChangeText={setPayDate}   placeholder="2025-01-20" />
          </View>

          {/* Importes */}
          <Text style={sectionStyle}>Importes</Text>
          <View style={cardStyle}>
            <Field label="Importe total (€)" value={amount}  onChangeText={setAmount}  keyboardType="numeric" placeholder="4280.00" />
            <Field label="Base imponible (€)" value={taxable} onChangeText={setTaxable} keyboardType="numeric" placeholder="3537.19" />
            <Field label="% IVA"              value={vatRate} onChangeText={setVatRate} keyboardType="numeric" placeholder="21" />
          </View>

          {/* Notas */}
          <Text style={sectionStyle}>Notas</Text>
          <View style={cardStyle}>
            <View style={{ padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 6 }}>Descripción</Text>
              <TextInput
                style={{ fontSize: 14, color: C.text, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.surface, minHeight: 60 }}
                value={desc} onChangeText={setDesc} multiline placeholder="Descripción del documento…" placeholderTextColor={C.muted}
              />
            </View>
            <View style={{ padding: 12, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "500", color: C.muted, marginBottom: 6 }}>Notas internas</Text>
              <TextInput
                style={{ fontSize: 14, color: C.text, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.surface, minHeight: 60 }}
                value={notes} onChangeText={setNotes} multiline placeholder="Notas internas…" placeholderTextColor={C.muted}
              />
            </View>
          </View>

          {/* Danger zone */}
          <View style={{ margin: 16, marginTop: 8, backgroundColor: C.redL, borderWidth: 1, borderColor: "rgba(220,38,38,.2)", borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: C.red, marginBottom: 4 }}>Zona de peligro</Text>
            <Text style={{ fontSize: 12, color: "#991B1B", marginBottom: 12 }}>Esta acción no se puede deshacer fácilmente.</Text>
            <TouchableOpacity
              onPress={handleCancel}
              style={{ borderWidth: 1, borderColor: C.red, borderRadius: 8, paddingVertical: 10, alignItems: "center" }}
            >
              <Text style={{ color: C.red, fontWeight: "600", fontSize: 13 }}>Marcar como cancelado</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const sectionStyle = {
  fontSize: 11, fontWeight: "700" as const, color: "#6B7280",
  letterSpacing: 1, textTransform: "uppercase" as const,
  paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
};

const cardStyle = {
  backgroundColor: "#FFFFFF", borderRadius: 14, marginHorizontal: 16,
  overflow: "hidden" as const, shadowColor: "#000", shadowOpacity: 0.06,
  shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
};
