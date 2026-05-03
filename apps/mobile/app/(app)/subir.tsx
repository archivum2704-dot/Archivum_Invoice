import { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ChevronLeft, Camera, Image as ImageIcon, FileText, Check,
  Upload, X,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";

const C = {
  blue: "#2563EB", blueL: "#EFF6FF", blueMed: "#DBEAFE",
  green: "#16A34A", greenL: "#F0FDF4",
  red: "#DC2626",
  bg: "#F9FAFB", surface: "#FFFFFF",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
};

const DOC_TYPES = [
  { key: "invoice_received", label: "Factura recibida" },
  { key: "invoice_issued",   label: "Factura emitida" },
  { key: "delivery_note",    label: "Albarán" },
  { key: "order",            label: "Pedido" },
  { key: "receipt",          label: "Recibo" },
  { key: "quote",            label: "Presupuesto" },
  { key: "payroll",          label: "Nómina" },
  { key: "contract",         label: "Contrato" },
  { key: "other",            label: "Otro" },
];

const STATUSES = [
  { key: "draft",   label: "Borrador" },
  { key: "pending", label: "Pendiente" },
  { key: "paid",    label: "Pagado" },
];

/* ── Step indicator ─────────────────────────────────────────────────────── */
function StepIndicator({ current }: { current: number }) {
  const steps = ["Archivo", "Metadatos", "Confirmar"];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 16 }}>
      {steps.map((s, i) => {
        const done   = i + 1 < current;
        const active = i + 1 === current;
        return (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
            <View style={{ alignItems: "center", gap: 4 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
                backgroundColor: done || active ? C.blue : C.surface,
                borderWidth: done || active ? 0 : 2, borderColor: C.border,
              }}>
                {done
                  ? <Check size={14} color="#fff" />
                  : <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : C.muted }}>{i + 1}</Text>
                }
              </View>
              <Text style={{ fontSize: 10, fontWeight: active ? "700" : "400", color: active ? C.blue : C.muted }}>{s}</Text>
            </View>
            {i < steps.length - 1 && (
              <View style={{ flex: 1, height: 2, marginBottom: 14, marginHorizontal: 4, backgroundColor: i + 1 < current ? C.blue : C.border }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ── Step 1: File ───────────────────────────────────────────────────────── */
function Step1({ onNext }: { onNext: () => void }) {
  const [fileSelected, setFileSelected] = useState(false);

  return (
    <View style={{ padding: 16, gap: 16 }}>
      {/* Drop zone */}
      <TouchableOpacity
        onPress={() => setFileSelected(true)}
        style={{
          borderWidth: 2, borderStyle: "dashed", borderColor: C.blue,
          borderRadius: 16, padding: 32, alignItems: "center", gap: 12,
          backgroundColor: C.blueL,
        }}
      >
        {fileSelected
          ? <>
              <View style={{ width: 48, height: 60, backgroundColor: C.blueMed, borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
                <FileText size={24} color={C.blue} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.blue }}>factura_012025.pdf</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>PDF · 842 KB</Text>
            </>
          : <>
              <Upload size={40} color={C.blue} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.blue }}>Arrastra o selecciona</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>PDF, JPG, PNG — máx. 25 MB</Text>
            </>
        }
      </TouchableOpacity>

      {/* Source buttons */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          { icon: <Camera size={22} color={C.blue} />, label: "Cámara" },
          { icon: <ImageIcon size={22} color={C.blue} />, label: "Galería" },
          { icon: <FileText size={22} color={C.blue} />, label: "Archivos" },
        ].map((b) => (
          <TouchableOpacity
            key={b.label}
            onPress={() => setFileSelected(true)}
            style={{
              flex: 1, padding: 14, backgroundColor: C.surface,
              borderWidth: 1, borderColor: C.border, borderRadius: 12,
              alignItems: "center", gap: 6,
            }}
          >
            {b.icon}
            <Text style={{ fontSize: 12, fontWeight: "500", color: C.text }}>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={onNext}
        style={{ backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14, alignItems: "center" }}
      >
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── Step 2: Metadata ───────────────────────────────────────────────────── */
function Step2({
  onNext, onBack,
  docType, setDocType, docNumber, setDocNumber,
  companyName, setCompanyName,
  amount, setAmount, taxable, setTaxable, vatRate, setVatRate,
  issueDate, setIssueDate, dueDate, setDueDate,
  status, setStatus, notes, setNotes,
}: any) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, gap: 14 }}>
        {/* File thumb */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
          backgroundColor: C.surface, borderRadius: 12,
          shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
        }}>
          <View style={{ width: 44, height: 56, backgroundColor: C.blueL, borderRadius: 6, alignItems: "center", justifyContent: "center" }}>
            <FileText size={20} color={C.blue} />
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>factura_012025.pdf</Text>
            <Text style={{ fontSize: 12, color: C.muted }}>PDF · 842 KB · subido hace 2s</Text>
          </View>
        </View>

        {/* Doc type */}
        <View>
          <Text style={styles.label}>Tipo de documento *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {DOC_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key} onPress={() => setDocType(t.key)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: docType === t.key ? C.blue : C.border, backgroundColor: docType === t.key ? C.blue : C.surface }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "500", color: docType === t.key ? "#fff" : C.muted }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {[
          { label: "Número de documento *", value: docNumber, setter: setDocNumber, ph: "FAC-2025-0001" },
          { label: "Empresa / Cliente *",   value: companyName, setter: setCompanyName, ph: "Buscar empresa…" },
          { label: "Fecha de emisión",      value: issueDate, setter: setIssueDate, ph: "2025-01-15" },
          { label: "Fecha de vencimiento",  value: dueDate,   setter: setDueDate,   ph: "2025-02-15" },
          { label: "Importe total (€)",     value: amount,    setter: setAmount,    ph: "4280.00", keyboard: "numeric" },
          { label: "Base imponible (€)",    value: taxable,   setter: setTaxable,   ph: "3537.19", keyboard: "numeric" },
          { label: "% IVA",                 value: vatRate,   setter: setVatRate,   ph: "21", keyboard: "numeric" },
        ].map((f) => (
          <View key={f.label}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={f.ph} placeholderTextColor={C.muted}
              value={f.value} onChangeText={f.setter}
              keyboardType={f.keyboard as any ?? "default"}
            />
          </View>
        ))}

        {/* Status */}
        <View>
          <Text style={styles.label}>Estado</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {STATUSES.map((s) => (
              <TouchableOpacity
                key={s.key} onPress={() => setStatus(s.key)}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: status === s.key ? C.blue : C.border, backgroundColor: status === s.key ? C.blue : C.surface }}
              >
                <Text style={{ fontSize: 12, fontWeight: "500", color: status === s.key ? "#fff" : C.muted }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.label}>Notas</Text>
          <TextInput
            style={[styles.input, { minHeight: 60 }]}
            placeholder="Observaciones, referencias internas…" placeholderTextColor={C.muted}
            value={notes} onChangeText={setNotes} multiline
          />
        </View>

        <TouchableOpacity onPress={onNext} style={{ backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Continuar →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 13, alignItems: "center" }}>
          <Text style={{ color: C.muted, fontWeight: "500", fontSize: 15 }}>← Atrás</Text>
        </TouchableOpacity>
        <View style={{ height: 8 }} />
      </View>
    </ScrollView>
  );
}

/* ── Step 3: Confirm ────────────────────────────────────────────────────── */
function Step3({
  onSubmit, onBack, saving,
  docType, docNumber, companyName, amount, issueDate, dueDate, status, notes,
}: any) {
  const DOC_TYPE_LABELS: Record<string, string> = {
    invoice_received: "Factura recibida", invoice_issued: "Factura emitida",
    delivery_note: "Albarán", order: "Pedido", receipt: "Recibo",
    quote: "Presupuesto", payroll: "Nómina", contract: "Contrato", other: "Otro",
  };
  const STATUS_LABELS: Record<string, string> = { draft: "Borrador", pending: "Pendiente", paid: "Pagado" };

  const rows = [
    ["Tipo",       DOC_TYPE_LABELS[docType] ?? docType],
    ["Nº Documento", docNumber],
    ["Empresa",    companyName || "—"],
    ["Fecha emisión", issueDate || "—"],
    ["Vencimiento", dueDate || "—"],
    ["Importe",    amount ? `€${parseFloat(amount.replace(",", ".")).toLocaleString("es-ES", { minimumFractionDigits: 2 })}` : "—"],
    ["Estado",     STATUS_LABELS[status] ?? status],
  ];

  return (
    <View style={{ padding: 16, gap: 14 }}>
      <View style={{
        backgroundColor: C.surface, borderRadius: 14, overflow: "hidden",
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
      }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, padding: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
          Resumen
        </Text>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", padding: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontSize: 13, color: C.muted }}>{k}</Text>
            <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.blueL, borderRadius: 12, padding: 12 }}>
        <FileText size={20} color={C.blue} />
        <Text style={{ fontSize: 13, color: C.blue }}>factura_012025.pdf · 842 KB</Text>
      </View>

      {notes ? (
        <View style={{ backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Notas</Text>
          <Text style={{ fontSize: 13, color: C.text }}>{notes}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={onSubmit}
        disabled={saving}
        style={{ backgroundColor: C.green, borderRadius: 10, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <><Check size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Archivar documento</Text></>
        }
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 13, alignItems: "center" }}>
        <Text style={{ color: C.muted, fontWeight: "500", fontSize: 15 }}>← Editar datos</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
export default function SubirScreen() {
  const { orgId } = useAuth();
  const [step, setStep] = useState(1);

  // Form fields
  const [docType,     setDocType]     = useState("invoice_received");
  const [docNumber,   setDocNumber]   = useState("");
  const [companyName, setCompanyName] = useState("");
  const [amount,      setAmount]      = useState("");
  const [taxable,     setTaxable]     = useState("");
  const [vatRate,     setVatRate]     = useState("21");
  const [issueDate,   setIssueDate]   = useState("");
  const [dueDate,     setDueDate]     = useState("");
  const [status,      setStatus]      = useState("pending");
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);

  const handleSubmit = async () => {
    if (!orgId) return;
    setSaving(true);

    // Find company by name if provided
    let companyId: string | null = null;
    if (companyName.trim()) {
      const { data: comp } = await supabase
        .from("companies")
        .select("id")
        .eq("organization_id", orgId)
        .ilike("name", `%${companyName.trim()}%`)
        .limit(1)
        .single();
      companyId = comp?.id ?? null;
    }

    await supabase.from("documents").insert({
      organization_id: orgId,
      company_id:     companyId,
      document_number: docNumber.trim(),
      document_type:  docType,
      status,
      amount:          amount  ? parseFloat(amount.replace(",", "."))  : null,
      taxable_base:    taxable ? parseFloat(taxable.replace(",", ".")) : null,
      vat_rate:        vatRate ? parseFloat(vatRate.replace(",", ".")) : null,
      issue_date:      issueDate || null,
      due_date:        dueDate   || null,
      notes:           notes.trim() || null,
    });

    setSaving(false);
    Alert.alert("✓ Documento archivado", `${docNumber} archivado correctamente.`, [
      { text: "Ver biblioteca", onPress: () => router.replace("/(app)/biblioteca") },
      { text: "Subir otro",     onPress: () => { setStep(1); setDocNumber(""); setAmount(""); setCompanyName(""); setNotes(""); } },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
            <ChevronLeft size={24} color={C.blue} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Archivar documento</Text>
        </View>

        <StepIndicator current={step} />

        {step === 1 && <Step1 onNext={() => setStep(2)} />}
        {step === 2 && (
          <Step2
            onNext={() => setStep(3)} onBack={() => setStep(1)}
            docType={docType} setDocType={setDocType}
            docNumber={docNumber} setDocNumber={setDocNumber}
            companyName={companyName} setCompanyName={setCompanyName}
            amount={amount} setAmount={setAmount}
            taxable={taxable} setTaxable={setTaxable}
            vatRate={vatRate} setVatRate={setVatRate}
            issueDate={issueDate} setIssueDate={setIssueDate}
            dueDate={dueDate} setDueDate={setDueDate}
            status={status} setStatus={setStatus}
            notes={notes} setNotes={setNotes}
          />
        )}
        {step === 3 && (
          <ScrollView>
            <Step3
              onSubmit={handleSubmit} onBack={() => setStep(2)} saving={saving}
              docType={docType} docNumber={docNumber} companyName={companyName}
              amount={amount} issueDate={issueDate} dueDate={dueDate} status={status} notes={notes}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  label: { fontSize: 12, fontWeight: "500" as const, color: "#6B7280", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: "#111827", backgroundColor: "#FFFFFF",
  },
};
